"""Simulator control and job status endpoints."""

from __future__ import annotations

import random
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import require_api_key
from app.db.session import get_db
from app.models.observation import Simulation
from app.models.zone import CoastalZone
from app.schemas.buoy import ScenarioStartIn, SimulationJobCreated, SimulationJobOut
from app.services.serializers import simulation_out
from app.services.simulator import GENERATOR_VERSION, run_manual_scenario, simulator

router = APIRouter(prefix="/simulator", tags=["simulator"])

ACCEPTANCE_NOTE = (
    "Permintaan diterima. Skenario replay mengisi jendela waktu terpilih dan menggantikan "
    "pembacaan sebelumnya di dalam jendela tersebut agar deret waktu buoy tetap koheren. "
    "Jumlah pembacaan yang digantikan dicatat pada catatan tugas."
)


@router.post(
    "/scenarios",
    response_model=SimulationJobCreated,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(require_api_key)],
    summary="Start a manual scenario burst or the automatic interval simulator",
)
async def start_scenario(
    payload: ScenarioStartIn,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
) -> SimulationJobCreated:
    zone = db.scalar(select(CoastalZone).where(CoastalZone.zone_code == payload.zone_code.upper()))
    if zone is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coastal zone not found")

    if payload.mode == "auto":
        result = await simulator.start(
            scenario=payload.scenario,
            interval_seconds=payload.interval_seconds,
            zone_code=payload.zone_code.upper(),
        )
        simulation_id = result.get("simulation_id")
        if not simulation_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Automatic simulator did not create a session. Check server logs.",
            )
        simulation = db.get(Simulation, uuid.UUID(simulation_id))
        if simulation is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Automatic simulator session was not persisted.",
            )
        return SimulationJobCreated(
            job=simulation_out(simulation, zone),
            acceptance_note=ACCEPTANCE_NOTE
            + f" Automatic mode posts one observation every {payload.interval_seconds}s.",
        )

    seed = payload.random_seed if payload.random_seed is not None else random.randint(0, 2**31 - 1)
    simulation = Simulation(
        scenario=payload.scenario,
        mode="manual",
        status="queued",
        random_seed=seed,
        generator_version=GENERATOR_VERSION,
        zone_id=zone.id,
        interval_seconds=payload.interval_seconds,
        notes=payload.notes,
    )
    db.add(simulation)
    db.commit()
    db.refresh(simulation)

    background.add_task(
        run_manual_scenario,
        simulation.id,
        buoy_code=payload.buoy_code,
        count=payload.observations,
        interval_seconds=payload.interval_seconds,
    )
    return SimulationJobCreated(job=simulation_out(simulation, zone), acceptance_note=ACCEPTANCE_NOTE)


@router.post(
    "/backfill",
    dependencies=[Depends(require_api_key)],
    summary="Generate recent telemetry for one zone or all zones (scheduled refresh)",
)
def backfill(payload: ScenarioStartIn, db: Session = Depends(get_db)) -> dict:
    """Synchronous backfill used by scheduled refreshes on serverless deployments.

    Unlike ``/scenarios`` this writes the observations before returning, so it is
    safe to call from an external scheduler without relying on background tasks.
    """
    zone_code = payload.zone_code.upper()
    if zone_code == "ALL":
        zones = list(db.scalars(select(CoastalZone).order_by(CoastalZone.zone_code)))
    else:
        zone = db.scalar(select(CoastalZone).where(CoastalZone.zone_code == zone_code))
        if zone is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coastal zone not found")
        zones = [zone]

    results = []
    for index, zone in enumerate(zones):
        seed = payload.random_seed + index * 101 if payload.random_seed is not None else random.randint(0, 2**31 - 1)
        simulation = Simulation(
            scenario=payload.scenario,
            mode="manual",
            status="queued",
            random_seed=seed,
            generator_version=GENERATOR_VERSION,
            zone_id=zone.id,
            interval_seconds=payload.interval_seconds,
            notes=payload.notes or "Penyegaran telemetri terjadwal",
        )
        db.add(simulation)
        db.commit()
        db.refresh(simulation)
        run_manual_scenario(
            simulation.id,
            buoy_code=payload.buoy_code,
            count=payload.observations,
            interval_seconds=payload.interval_seconds,
        )
        db.refresh(simulation)
        results.append(
            {
                "zone_code": zone.zone_code,
                "job_id": str(simulation.id),
                "status": simulation.status,
                "observations": payload.observations,
            }
        )

    return {
        "zones": results,
        "scenario": payload.scenario,
        "interval_seconds": payload.interval_seconds,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/jobs/{job_id}", response_model=SimulationJobOut, summary="Simulation job status")
def job_status(job_id: uuid.UUID, db: Session = Depends(get_db)) -> SimulationJobOut:
    simulation = db.get(Simulation, job_id)
    if simulation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Simulation job not found")
    zone = db.get(CoastalZone, simulation.zone_id) if simulation.zone_id else None
    return simulation_out(simulation, zone)


@router.get("/status", summary="Automatic simulator status (public, read-only)")
def simulator_status() -> dict:
    return simulator.status()


@router.post(
    "/tick",
    dependencies=[Depends(require_api_key)],
    summary="Force one automatic simulator tick (demo/testing)",
)
async def tick() -> dict:
    try:
        return await simulator.tick_now() if simulator.running else await simulator.start()
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc


@router.post("/stop", dependencies=[Depends(require_api_key)], summary="Stop the automatic simulator")
async def stop() -> dict:
    return await simulator.stop()

"""Idempotent demo seed: coastal zones, virtual buoys, backfilled telemetry and model registry."""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timedelta, timezone

from shapely.geometry import MultiPolygon, Point, box
from sqlalchemy import func, select

from app.core.config import settings
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.analytics import MLModel
from app.models.observation import BuoyObservation, Simulation
from app.models.zone import BuoyDevice, CoastalZone
from app.schemas.buoy import BuoyObservationIn
from app.services.ingestion import ingest_observation
from app.services.simulator import GENERATOR_VERSION, generate_series
from app.services.status_service import (
    SATELLITE_SOURCE_NAME,
    TRAINING_SOURCE_NAME,
    get_or_create_source,
)

logger = logging.getLogger(__name__)

ZONE_DEFINITIONS = [
    {
        "zone_code": "JKT-BAY",
        "zone_name": "Teluk Jakarta",
        "description": "Area pemantauan Teluk Jakarta, mencakup bagian dalam teluk dan "
        "pendekatan menuju Tanjung Priok. Poligon zona untuk pemantauan.",
        "bounds": (106.72, -6.15, 107.00, -5.88),
        "buoy": {"buoy_code": "BUOY-001", "longitude": 106.850, "latitude": -6.105},
    },
    {
        "zone_code": "SMR-UTC",
        "zone_name": "Pantai Semarang",
        "description": "Area pemantauan di lepas Semarang, Jawa Tengah, termasuk pendekatan "
        "pelabuhan dan kawasan pesisir dataran rendah.",
        "bounds": (110.30, -6.99, 110.55, -6.90),
        "buoy": {"buoy_code": "BUOY-002", "longitude": 110.420, "latitude": -6.945},
    },
    {
        "zone_code": "MKS-STR",
        "zone_name": "Selat Makassar",
        "description": "Area pemantauan di selatan Selat Makassar, koridor pelayaran "
        "antarpulau yang sibuk.",
        "bounds": (117.30, -3.40, 117.65, -3.05),
        "buoy": {"buoy_code": "BUOY-003", "longitude": 117.480, "latitude": -3.220},
    },
]

BOUNDARY_NOTE = (
    "Poligon zona pemantauan PantauPesisir."
)


def ensure_schema() -> None:
    """Bootstrap tables for the demo database.

    Production deployments should run the Alembic migration (``alembic upgrade head``);
    this is an idempotent safety net for local/demo environments.
    """
    Base.metadata.create_all(bind=engine)


def seed_if_empty() -> dict:
    with SessionLocal() as db:
        existing = db.scalar(select(func.count(CoastalZone.id))) or 0
        if existing:
            # Keeping the labels in sync matters for existing demo databases: a renamed
            # zone should not keep showing its old name to citizens forever.
            _sync_zone_definitions(db)
            _ensure_reference_rows(db)
            return {"seeded": False, "zones": int(existing)}

        zone_rows: list[tuple[CoastalZone, BuoyDevice]] = []
        for definition in ZONE_DEFINITIONS:
            zone = CoastalZone(
                zone_code=definition["zone_code"],
                zone_name=definition["zone_name"],
                description=definition["description"],
                boundary=MultiPolygon([box(*definition["bounds"])]),
                boundary_note=BOUNDARY_NOTE,
            )
            db.add(zone)
            db.flush()
            buoy_definition = definition["buoy"]
            buoy = BuoyDevice(
                buoy_code=buoy_definition["buoy_code"],
                zone_id=zone.id,
                location=Point(buoy_definition["longitude"], buoy_definition["latitude"]),
                device_status="active",
                source_type="simulated",
            )
            db.add(buoy)
            db.flush()
            zone_rows.append((zone, buoy))
        db.commit()

        if settings.seed_demo_observations:
            _backfill(db, zone_rows)

        _ensure_reference_rows(db)
        return {"seeded": True, "zones": len(zone_rows)}


def _sync_zone_definitions(db) -> None:
    """Apply renamed zone labels/descriptions to an already-seeded database."""
    changed = False
    for definition in ZONE_DEFINITIONS:
        zone = db.scalar(
            select(CoastalZone).where(CoastalZone.zone_code == definition["zone_code"])
        )
        if zone is None:
            continue
        if zone.zone_name != definition["zone_name"]:
            zone.zone_name = definition["zone_name"]
            changed = True
        if zone.description != definition["description"]:
            zone.description = definition["description"]
            changed = True
    if changed:
        db.commit()


def _backfill(db, zone_rows: list[tuple[CoastalZone, BuoyDevice]]) -> None:
    interval_seconds = 300
    count = max(6, int((settings.seed_backfill_hours * 3600) / interval_seconds))
    end_at = datetime.now(timezone.utc).replace(microsecond=0)
    total = 0
    for index, (zone, buoy) in enumerate(zone_rows):
        simulation = Simulation(
            scenario="normal",
            mode="seed",
            status="running",
            random_seed=20261118 + index,
            generator_version=GENERATOR_VERSION,
            zone_id=zone.id,
            interval_seconds=interval_seconds,
            started_at=end_at - timedelta(seconds=interval_seconds * count),
            notes="Initial demo backfill (synthetic telemetry, deterministic seed).",
        )
        # Pick a deterministic seed whose normal window contains no injected spike, so
        # the demo baseline reads as genuinely normal before any scenario is triggered.
        series: list[dict] = []
        for attempt in range(40):
            candidate_seed = simulation.random_seed + attempt
            series = generate_series(
                zone_code=zone.zone_code,
                scenario="normal",
                count=count,
                interval_seconds=interval_seconds,
                seed=candidate_seed,
                end_at=end_at,
            )
            if not any(row.get("anomaly_injected") for row in series[-24:]):
                simulation.random_seed = candidate_seed
                break
        db.add(simulation)
        db.flush()
        written = 0
        for snapshot in series:
            payload = BuoyObservationIn(
                simulation_id=simulation.id,
                buoy_code=buoy.buoy_code,
                observed_at=snapshot["observed_at"],
                latitude=float(buoy.location.y),
                longitude=float(buoy.location.x),
                parameters={
                    key: snapshot[key]
                    for key in (
                        "wave_height_m",
                        "wave_period_s",
                        "wave_direction_deg",
                        "wind_speed_mps",
                        "wind_direction_deg",
                        "sea_temperature_c",
                        "air_pressure_hpa",
                    )
                },
                source_type="simulated",
                scenario="normal",
                generator_version=GENERATOR_VERSION,
            )
            outcome = ingest_observation(db, payload, commit=False)
            if outcome.observation and not outcome.duplicate:
                written += 1
        simulation.observations_count = written
        simulation.status = "completed"
        simulation.ended_at = end_at
        db.commit()
        total += written
    logger.info("Seeded %s synthetic observations", total)


def _ensure_reference_rows(db) -> None:
    _register_model(db)
    training = get_or_create_source(
        db,
        source_name=TRAINING_SOURCE_NAME,
        source_type="historical_dataset",
        metadata={
            "label": "NOAA NDBC stdmet historis (data latih model)",
            "access": "Arsip historis publik, tanpa autentikasi",
            "note": "Observasi historis nyata, hanya dipakai untuk pelatihan model secara offline.",
            "stations": ["51002", "41010"],
            "years": "2022-2024",
            "license": "Public domain (U.S. federal government work)",
        },
    )
    training.status = "archived"
    satellite = get_or_create_source(
        db,
        source_name=SATELLITE_SOURCE_NAME,
        source_type="satellite",
        metadata={
            "label": "Copernicus Sentinel-2 L2A (metadata STAC + pratinjau)",
            "provider": "copernicus-stac",
            "access": "Pencarian STAC tanpa autentikasi; unduhan pratinjau",
            "note": "Citra optik bersifat kontekstual dan bukan pengukuran tinggi gelombang.",
        },
    )
    if satellite.status == "unknown":
        satellite.status = "not_synced"
    db.commit()


def _register_model(db) -> None:
    if not settings.model_artifact_path.exists():
        return
    metrics_path = settings.model_artifact_path.with_suffix(".metrics.json")
    metrics = json.loads(metrics_path.read_text(encoding="utf-8")) if metrics_path.exists() else {}
    existing = db.scalar(select(MLModel).where(MLModel.model_version == settings.ml_model_version))
    if existing is not None:
        return
    db.add(
        MLModel(
            model_name="pantaupesisir-anomaly-isolation-forest",
            model_version=settings.ml_model_version,
            algorithm="IsolationForest",
            model_uri=str(settings.model_artifact_path),
            feature_schema=metrics.get("feature_names", []),
            training_dataset="NOAA NDBC stdmet historis, stasiun 51002 + 41010, 2022-2024",
            training_period=(
                f"{metrics['train_period'][0][:10]} hingga {metrics['train_period'][1][:10]}"
                if metrics.get("train_period")
                else "2022-2024"
            ),
            metrics=metrics,
            is_active=True,
        )
    )
    db.flush()

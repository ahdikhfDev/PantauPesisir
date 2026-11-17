"""Shared ingestion path used by the API router, simulator and seed script."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.observation import BuoyObservation
from app.models.zone import BuoyDevice, CoastalZone
from app.schemas.buoy import BuoyObservationIn
from app.services.status_service import record_buoy_ingest
from app.services.validation import validate_observation


class UnknownBuoyError(LookupError):
    def __init__(self, buoy_code: str) -> None:
        super().__init__(f"Buoy {buoy_code} is not registered")
        self.buoy_code = buoy_code


@dataclass
class IngestionOutcome:
    observation: BuoyObservation | None
    duplicate: bool
    validation_status: str
    errors: list[dict] = field(default_factory=list)
    buoy: BuoyDevice | None = None
    zone: CoastalZone | None = None


def default_idempotency_key(payload: BuoyObservationIn) -> str:
    if payload.source_type == "simulated":
        return f"{payload.buoy_code}:{payload.observed_at.isoformat()}:{payload.generator_version}"
    return f"{payload.buoy_code}:{payload.observed_at.isoformat()}"


def ingest_observation(db: Session, payload: BuoyObservationIn, *, commit: bool = True) -> IngestionOutcome:
    from shapely.geometry import Point

    buoy = db.scalar(select(BuoyDevice).where(BuoyDevice.buoy_code == payload.buoy_code))
    if buoy is None:
        raise UnknownBuoyError(payload.buoy_code)
    zone = db.get(CoastalZone, buoy.zone_id)
    if zone is None:
        raise UnknownBuoyError(payload.buoy_code)

    idempotency_key = payload.idempotency_key or default_idempotency_key(payload)

    existing = db.scalar(
        select(BuoyObservation).where(BuoyObservation.idempotency_key == idempotency_key)
    )
    if existing is None:
        existing = db.scalar(
            select(BuoyObservation).where(
                BuoyObservation.buoy_id == buoy.id,
                BuoyObservation.observed_at == payload.observed_at,
            )
        )
    if existing is not None:
        return IngestionOutcome(
            observation=existing,
            duplicate=True,
            validation_status=existing.validation_status,
            errors=[],
            buoy=buoy,
            zone=zone,
        )

    status, errors = validate_observation(
        payload=payload.model_dump(),
        buoy=buoy,
        zone=zone,
    )

    parameters = payload.parameters
    observation = BuoyObservation(
        buoy_id=buoy.id,
        simulation_id=payload.simulation_id,
        observed_at=payload.observed_at,
        received_at=datetime.now(timezone.utc),
        processed_at=datetime.now(timezone.utc),
        wave_height_m=parameters.wave_height_m,
        wave_period_s=parameters.wave_period_s,
        wave_direction_deg=parameters.wave_direction_deg,
        wind_speed_mps=parameters.wind_speed_mps,
        wind_direction_deg=parameters.wind_direction_deg,
        sea_temperature_c=parameters.sea_temperature_c,
        air_pressure_hpa=parameters.air_pressure_hpa,
        location=Point(payload.longitude, payload.latitude),
        source_type=payload.source_type,
        scenario=payload.scenario,
        generator_version=payload.generator_version,
        validation_status=status,
        validation_errors=errors or None,
        idempotency_key=idempotency_key,
    )
    db.add(observation)
    db.flush()

    record_buoy_ingest(
        db,
        observed_at=observation.observed_at,
        received_at=observation.received_at,
        source_type=observation.source_type,
        valid=status == "valid",
        buoy_code=buoy.buoy_code,
    )
    if commit:
        db.commit()
        db.refresh(observation)

    return IngestionOutcome(
        observation=observation,
        duplicate=False,
        validation_status=status,
        errors=errors,
        buoy=buoy,
        zone=zone,
    )

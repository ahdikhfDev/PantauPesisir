"""Simulation sessions and buoy observations."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKey, UtcDateTime, utcnow
from app.db.types import Geometry

JSONType = JSON().with_variant(JSONB, "postgresql")


class Simulation(UUIDPrimaryKey, Base):
    __tablename__ = "simulations"

    scenario: Mapped[str] = mapped_column(String(24), nullable=False)
    mode: Mapped[str] = mapped_column(String(16), default="manual", nullable=False)
    status: Mapped[str] = mapped_column(String(24), default="queued", nullable=False)
    random_seed: Mapped[int] = mapped_column(Integer, nullable=False)
    generator_version: Mapped[str] = mapped_column(String(24), default="1.0.0", nullable=False)
    zone_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("coastal_zones.id"), index=True)
    interval_seconds: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    observations_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column(UtcDateTime)
    ended_at: Mapped[datetime | None] = mapped_column(UtcDateTime)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=utcnow, nullable=False)


class BuoyObservation(UUIDPrimaryKey, Base):
    __tablename__ = "buoy_observations"
    __table_args__ = (
        UniqueConstraint("buoy_id", "observed_at", name="uq_buoy_observations_buoy_time"),
        Index("ix_buoy_observations_zone_time", "observed_at"),
        Index("ix_buoy_observations_source_time", "source_type", "observed_at"),
    )

    buoy_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("buoy_devices.id"), nullable=False)
    simulation_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("simulations.id"), index=True)
    observed_at: Mapped[datetime] = mapped_column(UtcDateTime, nullable=False, index=True)
    received_at: Mapped[datetime] = mapped_column(UtcDateTime, default=utcnow, nullable=False)
    processed_at: Mapped[datetime | None] = mapped_column(UtcDateTime)

    wave_height_m: Mapped[float] = mapped_column(Float, nullable=False)
    wave_period_s: Mapped[float] = mapped_column(Float, nullable=False)
    wave_direction_deg: Mapped[float] = mapped_column(Float, nullable=False)
    wind_speed_mps: Mapped[float] = mapped_column(Float, nullable=False)
    wind_direction_deg: Mapped[float] = mapped_column(Float, nullable=False)
    sea_temperature_c: Mapped[float] = mapped_column(Float, nullable=False)
    air_pressure_hpa: Mapped[float] = mapped_column(Float, nullable=False)

    location: Mapped[object] = mapped_column(Geometry("POINT", 4326), nullable=False)
    source_type: Mapped[str] = mapped_column(String(24), default="simulated", nullable=False)
    scenario: Mapped[str] = mapped_column(String(24), default="normal", nullable=False)
    generator_version: Mapped[str] = mapped_column(String(24), default="1.0.0", nullable=False)
    validation_status: Mapped[str] = mapped_column(String(24), default="valid", nullable=False)
    validation_errors: Mapped[list[dict] | None] = mapped_column(JSONType)
    idempotency_key: Mapped[str] = mapped_column(String(160), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=utcnow, nullable=False)

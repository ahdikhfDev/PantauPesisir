"""Coastal zones and buoy devices."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDPrimaryKey, UtcDateTime, utcnow
from app.db.types import Geometry


class CoastalZone(UUIDPrimaryKey, Base):
    __tablename__ = "coastal_zones"

    zone_code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    zone_name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    # Approximate prototype monitoring polygon in SRID 4326 (lon, lat order).
    boundary: Mapped[Any] = mapped_column(Geometry("MULTIPOLYGON", 4326), nullable=False)
    # Shown in the UI so users never mistake the prototype polygon for an official boundary.
    boundary_note: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        default="Approximate prototype monitoring area, not an official administrative boundary.",
    )
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=utcnow, nullable=False)

    buoys: Mapped[list["BuoyDevice"]] = relationship(back_populates="zone")

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<CoastalZone {self.zone_code}>"


class BuoyDevice(UUIDPrimaryKey, Base):
    __tablename__ = "buoy_devices"

    buoy_code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    zone_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("coastal_zones.id"), nullable=False, index=True)
    location: Mapped[Any] = mapped_column(Geometry("POINT", 4326), nullable=False)
    device_status: Mapped[str] = mapped_column(String(24), default="active", nullable=False)
    source_type: Mapped[str] = mapped_column(String(24), default="simulated", nullable=False)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=utcnow, nullable=False)

    zone: Mapped[CoastalZone] = relationship(back_populates="buoys")

    def __repr__(self) -> str:  # pragma: no cover - debug helper
        return f"<BuoyDevice {self.buoy_code}>"

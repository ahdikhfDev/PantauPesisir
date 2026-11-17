"""Satellite dataset metadata and acquisition jobs."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Float, ForeignKey, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKey, UtcDateTime, utcnow
from app.db.types import Geometry

JSONType = JSON().with_variant(JSONB, "postgresql")


class SatelliteDataset(UUIDPrimaryKey, Base):
    __tablename__ = "satellite_datasets"
    __table_args__ = (
        UniqueConstraint("provider", "product_id", name="uq_satellite_datasets_provider_product"),
    )

    zone_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("coastal_zones.id"), index=True)
    provider: Mapped[str] = mapped_column(String(64), nullable=False)
    collection: Mapped[str] = mapped_column(String(64), nullable=False)
    product_id: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    acquired_at: Mapped[datetime] = mapped_column(UtcDateTime, nullable=False, index=True)
    downloaded_at: Mapped[datetime | None] = mapped_column(UtcDateTime)
    processed_at: Mapped[datetime | None] = mapped_column(UtcDateTime)
    footprint: Mapped[Any] = mapped_column(Geometry("POLYGON", 4326), nullable=False)
    asset_uri: Mapped[str | None] = mapped_column(Text)
    thumbnail_uri: Mapped[str | None] = mapped_column(Text)
    cloud_cover_percent: Mapped[float | None] = mapped_column(Float)
    resolution_m: Mapped[float | None] = mapped_column(Float)
    crs: Mapped[str | None] = mapped_column(String(64))
    metadata_json: Mapped[dict | None] = mapped_column("metadata", JSONType)
    license: Mapped[str | None] = mapped_column(String(255))
    attribution: Mapped[str | None] = mapped_column(Text)
    processing_status: Mapped[str] = mapped_column(String(32), default="metadata_only", nullable=False)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=utcnow, nullable=False)


class SatelliteJob(UUIDPrimaryKey, Base):
    __tablename__ = "satellite_jobs"

    provider: Mapped[str] = mapped_column(String(64), nullable=False)
    zone_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("coastal_zones.id"), index=True)
    query_parameters: Mapped[dict] = mapped_column(JSONType, default=dict, nullable=False)
    status: Mapped[str] = mapped_column(String(24), default="queued", nullable=False)
    datasets_found: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    datasets_stored: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    used_cache: Mapped[bool] = mapped_column(default=False, nullable=False)
    warnings: Mapped[list[str] | None] = mapped_column(JSONType)
    started_at: Mapped[datetime | None] = mapped_column(UtcDateTime)
    completed_at: Mapped[datetime | None] = mapped_column(UtcDateTime)
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=utcnow, nullable=False)

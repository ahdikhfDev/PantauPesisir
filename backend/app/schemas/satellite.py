"""Satellite connector schemas."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, Field, model_validator

from app.schemas.common import ORMModel


class SatelliteSyncIn(BaseModel):
    provider: str = Field(default="copernicus-stac", max_length=64)
    zone_id: uuid.UUID | None = None
    zone_code: str | None = Field(default="JKT-BAY", max_length=32)
    date_from: date
    date_to: date
    collection: str = Field(default="sentinel-2-l2a", max_length=64)
    max_cloud_cover_percent: float = Field(default=40.0, ge=0, le=100)
    max_products: int = Field(default=4, ge=1, le=12)

    @model_validator(mode="after")
    def _check_range(self) -> "SatelliteSyncIn":
        if self.date_to < self.date_from:
            raise ValueError("date_to must be on or after date_from")
        if (self.date_to - self.date_from).days > 366:
            raise ValueError("date range is limited to 366 days per sync")
        if not self.zone_id and not self.zone_code:
            raise ValueError("zone_id or zone_code is required")
        return self


class SatelliteDatasetOut(ORMModel):
    id: uuid.UUID
    zone_id: uuid.UUID | None = None
    provider: str
    collection: str
    product_id: str
    acquired_at: datetime
    downloaded_at: datetime | None = None
    processed_at: datetime | None = None
    footprint: dict
    asset_uri: str | None = None
    thumbnail_uri: str | None = None
    thumbnail_url: str | None = None
    cloud_cover_percent: float | None = None
    resolution_m: float | None = None
    crs: str | None = None
    license: str | None = None
    attribution: str | None = None
    processing_status: str
    created_at: datetime
    metadata: dict | None = None


class SatelliteJobOut(ORMModel):
    id: uuid.UUID
    provider: str
    zone_id: uuid.UUID | None = None
    query_parameters: dict
    status: str
    datasets_found: int
    datasets_stored: int
    used_cache: bool
    warnings: list[str] | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    error_message: str | None = None
    created_at: datetime


class SatelliteSyncResponse(BaseModel):
    job: SatelliteJobOut
    acceptance_note: str

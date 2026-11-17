"""Coastal zone, data-source health and dashboard overview schemas."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.schemas.buoy import BuoyDeviceOut


class ZoneOut(BaseModel):
    id: uuid.UUID
    zone_code: str
    zone_name: str
    description: str | None = None
    boundary: dict[str, Any]
    boundary_note: str
    centroid: dict[str, float] | None = None
    buoys: list[BuoyDeviceOut] = []
    created_at: datetime


class DataSourceStatusOut(BaseModel):
    source_name: str
    source_type: str
    status: str
    last_observed_at: datetime | None = None
    last_received_at: datetime | None = None
    last_success_at: datetime | None = None
    last_error: str | None = None
    age_seconds: int | None = None
    metadata: dict | None = None
    updated_at: datetime


class DataSourcesResponse(BaseModel):
    items: list[DataSourceStatusOut]
    generated_at: datetime


class SystemHealthOut(BaseModel):
    status: str
    version: str
    environment: str
    demo_mode: bool
    database: dict[str, Any]
    model: dict[str, Any]
    simulator: dict[str, Any]
    satellite_provider: dict[str, Any]
    counts: dict[str, int]
    generated_at: datetime


class DashboardOverview(BaseModel):
    generated_at: datetime
    zones: list[ZoneOut]
    latest_observations: list[dict]
    latest_prediction: dict | None = None
    alert_counts: dict[str, int]
    recent_alerts: list[dict]
    data_freshness: dict[str, Any]
    simulator: dict[str, Any]
    satellite: dict[str, Any]
    provenance_notice: str

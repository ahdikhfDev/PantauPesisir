"""Alert lifecycle schemas."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import AlertSeverity, AlertStatus


class AlertOut(BaseModel):
    id: uuid.UUID
    prediction_id: uuid.UUID | None = None
    zone_id: uuid.UUID
    zone_code: str | None = None
    zone_name: str | None = None
    severity: AlertSeverity
    title: str
    description: str
    status: AlertStatus
    source: str
    created_at: datetime
    acknowledged_at: datetime | None = None
    acknowledged_by: str | None = None
    resolved_at: datetime | None = None


class AlertListResponse(BaseModel):
    items: list[AlertOut]
    total: int
    counts_by_status: dict[str, int]
    counts_by_severity: dict[str, int]


class AlertPatchIn(BaseModel):
    status: AlertStatus
    note: str | None = Field(default=None, max_length=500)
    actor: str | None = Field(default=None, max_length=80)

"""Shared schema primitives, enums and error shapes."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Any, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field

ScenarioName = Literal["normal", "warning", "extreme"]
RiskLevel = Literal["low", "moderate", "high"]
AlertSeverity = Literal["info", "moderate", "high"]
AlertStatus = Literal["open", "acknowledged", "resolved"]
ValidationStatus = Literal["valid", "invalid", "quarantined"]
SourceType = Literal["simulated", "observed", "historical"]


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("timestamp must include a timezone offset (UTC, e.g. 2026-11-18T03:00:00Z)")
    return value.astimezone(timezone.utc)


UtcDatetime = Annotated[datetime, AfterValidator(_as_utc)]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class PageMeta(BaseModel):
    page: int = 1
    page_size: int = 50
    total: int = 0
    has_next: bool = False


class Paginated(BaseModel):
    meta: PageMeta
    items: list[Any]


class ErrorResponse(BaseModel):
    error: str
    detail: str | None = None
    request_id: str | None = None


class GeoJSON(BaseModel):
    type: str
    coordinates: Any = Field(description="GeoJSON coordinates in lon/lat (SRID 4326).")


class HealthResponse(BaseModel):
    status: str
    version: str
    environment: str
    database: str
    model_loaded: bool
    simulator_running: bool
    generated_at: str

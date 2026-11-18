"""Analytics request/response schemas."""

from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import RiskLevel


class AnalyticsRunIn(BaseModel):
    zone_id: uuid.UUID | None = None
    zone_code: str | None = Field(default="JKT-BAY", max_length=32)
    window_minutes: int = Field(default=60, ge=10, le=1440)
    model_version: str | None = Field(default=None, max_length=64)
    create_alert: bool = True


class ContributingFactor(BaseModel):
    feature: str
    label: str
    value: float
    unit: str
    baseline_mean: float
    deviation_sigma: float
    direction: str


class PredictionOut(BaseModel):
    id: uuid.UUID
    zone_id: uuid.UUID
    zone_code: str | None = None
    zone_name: str | None = None
    model_version: str
    model_name: str | None = None
    algorithm: str | None = None
    analysis_started_at: datetime
    analysis_ended_at: datetime
    observation_window_start: datetime | None = None
    observation_window_end: datetime | None = None
    windows_evaluated: int
    input_observation_count: int
    input_observation_ids: list[str] = []
    matched_satellite_dataset_ids: list[str] = []
    anomaly_detected: bool
    anomaly_score: float
    anomaly_threshold: float
    risk_score: float | None = None
    risk_level: RiskLevel | None = None
    risk_method: str | None = None
    contributing_factors: list[dict] = []
    explanation: str
    recommendation: str
    caveats: list[str] = []
    data_quality_summary: dict | None = None
    is_simulated: bool
    created_at: datetime
    alert_id: uuid.UUID | None = None


class AnalyticsRunResponse(BaseModel):
    prediction: PredictionOut
    acceptance_note: str = (
        "Hasil analisis risiko untuk zona terpilih, dihitung dari telemetri valid pada jendela "
        "waktu yang diminta."
    )

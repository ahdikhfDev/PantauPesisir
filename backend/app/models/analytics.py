"""ML model registry and AI analysis results."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Float, ForeignKey, JSON, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKey, UtcDateTime, utcnow

JSONType = JSON().with_variant(JSONB, "postgresql")


class MLModel(UUIDPrimaryKey, Base):
    __tablename__ = "ml_models"

    model_name: Mapped[str] = mapped_column(String(80), nullable=False)
    model_version: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    algorithm: Mapped[str] = mapped_column(String(80), nullable=False)
    model_uri: Mapped[str] = mapped_column(Text, nullable=False)
    feature_schema: Mapped[list[dict] | dict] = mapped_column(JSONType, nullable=False)
    training_dataset: Mapped[str] = mapped_column(Text, nullable=False)
    training_period: Mapped[str] = mapped_column(String(80), nullable=False)
    metrics: Mapped[dict | None] = mapped_column(JSONType)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=utcnow, nullable=False)


class AIPrediction(UUIDPrimaryKey, Base):
    __tablename__ = "ai_predictions"

    zone_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("coastal_zones.id"), nullable=False, index=True)
    model_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("ml_models.id"), index=True)
    model_version: Mapped[str] = mapped_column(String(64), nullable=False)
    analysis_started_at: Mapped[datetime] = mapped_column(UtcDateTime, nullable=False)
    analysis_ended_at: Mapped[datetime] = mapped_column(UtcDateTime, nullable=False)
    observation_window_start: Mapped[datetime | None] = mapped_column(UtcDateTime)
    observation_window_end: Mapped[datetime | None] = mapped_column(UtcDateTime)
    input_observation_ids: Mapped[list[str] | None] = mapped_column(JSONType)
    matched_satellite_dataset_ids: Mapped[list[str] | None] = mapped_column(JSONType)
    windows_evaluated: Mapped[int] = mapped_column(default=0, nullable=False)

    anomaly_detected: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    anomaly_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    anomaly_threshold: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    risk_score: Mapped[float | None] = mapped_column(Float)
    risk_level: Mapped[str | None] = mapped_column(String(16))
    contributing_factors: Mapped[list[dict] | None] = mapped_column(JSONType)
    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    recommendation: Mapped[str] = mapped_column(Text, nullable=False)
    caveats: Mapped[list[str] | None] = mapped_column(JSONType)
    data_quality_summary: Mapped[dict | None] = mapped_column(JSONType)
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=utcnow, nullable=False)

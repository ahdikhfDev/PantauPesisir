"""Data-source health tracking."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKey, UtcDateTime, utcnow

JSONType = JSON().with_variant(JSONB, "postgresql")


class DataSourceStatus(UUIDPrimaryKey, Base):
    __tablename__ = "data_source_status"

    source_name: Mapped[str] = mapped_column(String(80), unique=True, nullable=False)
    source_type: Mapped[str] = mapped_column(String(40), nullable=False)
    status: Mapped[str] = mapped_column(String(24), default="unknown", nullable=False)
    last_observed_at: Mapped[datetime | None] = mapped_column(UtcDateTime)
    last_received_at: Mapped[datetime | None] = mapped_column(UtcDateTime)
    last_success_at: Mapped[datetime | None] = mapped_column(UtcDateTime)
    last_error: Mapped[str | None] = mapped_column(Text)
    metadata_json: Mapped[dict | None] = mapped_column("metadata", JSONType)
    updated_at: Mapped[datetime] = mapped_column(
        UtcDateTime, default=utcnow, onupdate=utcnow, nullable=False
    )

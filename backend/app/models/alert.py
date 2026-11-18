"""Alert lifecycle."""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDPrimaryKey, UtcDateTime, utcnow


class Alert(UUIDPrimaryKey, Base):
    __tablename__ = "alerts"

    prediction_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("ai_predictions.id"), index=True
    )
    zone_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("coastal_zones.id"), nullable=False, index=True)
    severity: Mapped[str] = mapped_column(String(16), nullable=False)
    title: Mapped[str] = mapped_column(String(160), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(24), default="open", nullable=False, index=True)
    source: Mapped[str] = mapped_column(String(32), default="analytics", nullable=False)
    created_at: Mapped[datetime] = mapped_column(UtcDateTime, default=utcnow, nullable=False)
    acknowledged_at: Mapped[datetime | None] = mapped_column(UtcDateTime)
    acknowledged_by: Mapped[str | None] = mapped_column(String(80))
    resolved_at: Mapped[datetime | None] = mapped_column(UtcDateTime)

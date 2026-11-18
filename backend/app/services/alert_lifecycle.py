"""Alert expiry shared by the public listing and system counts."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.alert import Alert


def expire_stale_alerts(db: Session) -> int:
    """Close notifications older than the configured lifetime.

    Public pages have no account or acknowledgement flow, so notifications are
    time-bound and expire on their own instead of waiting for an operator.
    """
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=settings.alert_ttl_hours)
    result = db.execute(
        update(Alert)
        .where(
            Alert.status.in_(("open", "acknowledged")),
            Alert.created_at < cutoff,
        )
        .values(status="resolved", resolved_at=now)
    )
    if result.rowcount:
        db.commit()
    return int(result.rowcount or 0)

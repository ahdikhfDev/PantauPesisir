"""Prototype alert lifecycle endpoints."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import require_api_key
from app.db.session import get_db
from app.models.alert import Alert
from app.models.zone import CoastalZone
from app.schemas.alerts import AlertListResponse, AlertOut, AlertPatchIn
from app.services.serializers import alert_out

router = APIRouter(prefix="/alerts", tags=["alerts"])

ALLOWED_TRANSITIONS = {
    ("open", "acknowledged"),
    ("open", "resolved"),
    ("acknowledged", "resolved"),
    ("acknowledged", "open"),
}


@router.get("", response_model=AlertListResponse, summary="List prototype alerts")
def list_alerts(
    status_filter: str | None = Query(default=None, alias="status", pattern="^(open|acknowledged|resolved)$"),
    severity: str | None = Query(default=None, pattern="^(info|moderate|high)$"),
    zone_code: str | None = Query(default=None, max_length=32),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> AlertListResponse:
    stmt = select(Alert, CoastalZone).join(CoastalZone, Alert.zone_id == CoastalZone.id)
    count_stmt = select(func.count(Alert.id)).join(CoastalZone, Alert.zone_id == CoastalZone.id)
    if status_filter:
        stmt = stmt.where(Alert.status == status_filter)
        count_stmt = count_stmt.where(Alert.status == status_filter)
    if severity:
        stmt = stmt.where(Alert.severity == severity)
        count_stmt = count_stmt.where(Alert.severity == severity)
    if zone_code:
        stmt = stmt.where(CoastalZone.zone_code == zone_code.upper())
        count_stmt = count_stmt.where(CoastalZone.zone_code == zone_code.upper())

    rows = db.execute(stmt.order_by(Alert.created_at.desc()).offset(offset).limit(limit)).all()
    total = int(db.scalar(count_stmt) or 0)

    by_status = {
        row[0]: int(row[1])
        for row in db.execute(select(Alert.status, func.count(Alert.id)).group_by(Alert.status))
    }
    by_severity = {
        row[0]: int(row[1])
        for row in db.execute(select(Alert.severity, func.count(Alert.id)).group_by(Alert.severity))
    }
    return AlertListResponse(
        items=[alert_out(alert, zone) for alert, zone in rows],
        total=total,
        counts_by_status=by_status,
        counts_by_severity=by_severity,
    )


@router.patch(
    "/{alert_id}",
    response_model=AlertOut,
    dependencies=[Depends(require_api_key)],
    summary="Acknowledge or resolve a prototype alert",
)
def update_alert(alert_id: uuid.UUID, payload: AlertPatchIn, db: Session = Depends(get_db)) -> AlertOut:
    alert = db.get(Alert, alert_id)
    if alert is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    if payload.status == alert.status:
        zone = db.get(CoastalZone, alert.zone_id)
        return alert_out(alert, zone)
    if (alert.status, payload.status) not in ALLOWED_TRANSITIONS:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot move alert from '{alert.status}' to '{payload.status}'. "
            "Resolved alerts cannot be reopened.",
        )

    now = datetime.now(timezone.utc)
    actor = (payload.actor or "operator").strip()[:80]
    if payload.status == "acknowledged":
        alert.acknowledged_at = now
        alert.acknowledged_by = actor
    elif payload.status == "resolved":
        alert.resolved_at = now
        if alert.acknowledged_at is None:
            alert.acknowledged_at = now
            alert.acknowledged_by = actor
    elif payload.status == "open":
        alert.acknowledged_at = None
        alert.acknowledged_by = None
    if payload.note:
        alert.description = f"{alert.description}\n\nOperator note ({actor}): {payload.note.strip()[:500]}"
    alert.status = payload.status
    db.commit()
    db.refresh(alert)
    zone = db.get(CoastalZone, alert.zone_id)
    return alert_out(alert, zone)

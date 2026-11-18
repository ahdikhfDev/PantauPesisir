"""Alert lifecycle endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.alert import Alert
from app.models.zone import CoastalZone
from app.schemas.alerts import AlertListResponse
from app.services.alert_lifecycle import expire_stale_alerts
from app.services.serializers import alert_out

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("", response_model=AlertListResponse, summary="List alerts")
def list_alerts(
    status_filter: str | None = Query(default=None, alias="status", pattern="^(open|acknowledged|resolved)$"),
    severity: str | None = Query(default=None, pattern="^(info|moderate|high)$"),
    zone_code: str | None = Query(default=None, max_length=32),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> AlertListResponse:
    expire_stale_alerts(db)
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

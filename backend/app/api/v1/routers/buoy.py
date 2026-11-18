"""Read-only buoy endpoints used by the dashboard."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.observation import BuoyObservation
from app.models.zone import BuoyDevice, CoastalZone
from app.schemas.buoy import BuoyHistoryResponse, BuoyLatestResponse
from app.services.serializers import observation_out

router = APIRouter(prefix="/buoy", tags=["buoy"])

STALE_AFTER_SECONDS = settings.freshness_window_seconds
# Upper bound on rows scanned when a caller asks for a downsampled series.
HISTORY_SAMPLE_SCAN = 5000


@router.get("/latest", response_model=BuoyLatestResponse, summary="Latest valid observation per buoy")
def latest_observations(
    zone_code: str | None = Query(default=None, max_length=32),
    buoy_code: str | None = Query(default=None, max_length=32),
    db: Session = Depends(get_db),
) -> BuoyLatestResponse:
    latest = (
        select(
            BuoyObservation.buoy_id.label("buoy_id"),
            func.max(BuoyObservation.observed_at).label("max_observed_at"),
        )
        .where(BuoyObservation.validation_status == "valid")
        .group_by(BuoyObservation.buoy_id)
        .subquery()
    )
    stmt = (
        select(BuoyObservation, BuoyDevice, CoastalZone)
        .join(BuoyDevice, BuoyObservation.buoy_id == BuoyDevice.id)
        .join(CoastalZone, BuoyDevice.zone_id == CoastalZone.id)
        .join(
            latest,
            and_(
                BuoyObservation.buoy_id == latest.c.buoy_id,
                BuoyObservation.observed_at == latest.c.max_observed_at,
            ),
        )
        .order_by(BuoyObservation.observed_at.desc())
    )
    if zone_code:
        stmt = stmt.where(CoastalZone.zone_code == zone_code.upper())
    if buoy_code:
        stmt = stmt.where(BuoyDevice.buoy_code == buoy_code.upper())

    rows = db.execute(stmt).all()
    now = datetime.now(timezone.utc)
    items = [observation_out(obs, buoy, zone, now=now) for obs, buoy, zone in rows]
    stale = all(item.data_age_seconds > STALE_AFTER_SECONDS for item in items) if items else True
    return BuoyLatestResponse(items=items, stale=stale, stale_after_seconds=STALE_AFTER_SECONDS)


@router.get("/history", response_model=BuoyHistoryResponse, summary="Paginated observation history")
def observation_history(
    zone_code: str | None = Query(default=None, max_length=32),
    buoy_code: str | None = Query(default=None, max_length=32),
    observed_from: datetime | None = Query(default=None, description="ISO 8601 UTC lower bound"),
    observed_to: datetime | None = Query(default=None, description="ISO 8601 UTC upper bound"),
    source_type: str | None = Query(default=None, pattern="^(simulated|observed|historical)$"),
    validation_status: str | None = Query(default=None, pattern="^(valid|invalid|quarantined)$"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=100, ge=1, le=500),
    max_points: int | None = Query(
        default=None,
        ge=2,
        le=2000,
        description="Return at most this many evenly sampled points for charting",
    ),
    db: Session = Depends(get_db),
) -> BuoyHistoryResponse:
    """Stored observations, newest first.

    ``max_points`` exists for trend charts: a seven-day window can hold thousands of
    rows, so the caller asks for a bounded, evenly spaced sample instead of paging.
    It samples across the window (it does not keep every spike) and reports the true
    ``total`` so the caller can still say how many readings exist.
    """
    filters = []
    if zone_code:
        filters.append(CoastalZone.zone_code == zone_code.upper())
    if buoy_code:
        filters.append(BuoyDevice.buoy_code == buoy_code.upper())
    if observed_from:
        filters.append(BuoyObservation.observed_at >= _aware(observed_from))
    if observed_to:
        filters.append(BuoyObservation.observed_at <= _aware(observed_to))
    if source_type:
        filters.append(BuoyObservation.source_type == source_type)
    if validation_status:
        filters.append(BuoyObservation.validation_status == validation_status)

    count_stmt = (
        select(func.count(BuoyObservation.id))
        .join(BuoyDevice, BuoyObservation.buoy_id == BuoyDevice.id)
        .join(CoastalZone, BuoyDevice.zone_id == CoastalZone.id)
        .where(*filters)
    )
    total = int(db.scalar(count_stmt) or 0)

    if max_points:
        # Scan a bounded slice of the newest rows, then sample it evenly.
        sample_stmt = (
            select(BuoyObservation, BuoyDevice, CoastalZone)
            .join(BuoyDevice, BuoyObservation.buoy_id == BuoyDevice.id)
            .join(CoastalZone, BuoyDevice.zone_id == CoastalZone.id)
            .where(*filters)
            .order_by(BuoyObservation.observed_at.desc())
            .limit(HISTORY_SAMPLE_SCAN)
        )
        sampled = db.execute(sample_stmt).all()
        if len(sampled) > max_points:
            step = len(sampled) / max_points
            sampled = [sampled[min(int(index * step), len(sampled) - 1)] for index in range(max_points)]
        now = datetime.now(timezone.utc)
        sampled_items = [observation_out(obs, buoy, zone, now=now) for obs, buoy, zone in sampled]
        return BuoyHistoryResponse(
            items=sampled_items,
            page=1,
            page_size=len(sampled_items),
            total=total,
            has_next=False,
        )

    stmt = (
        select(BuoyObservation, BuoyDevice, CoastalZone)
        .join(BuoyDevice, BuoyObservation.buoy_id == BuoyDevice.id)
        .join(CoastalZone, BuoyDevice.zone_id == CoastalZone.id)
        .where(*filters)
        .order_by(BuoyObservation.observed_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = db.execute(stmt).all()
    now = datetime.now(timezone.utc)
    items = [observation_out(obs, buoy, zone, now=now) for obs, buoy, zone in rows]
    return BuoyHistoryResponse(
        items=items,
        page=page,
        page_size=page_size,
        total=total,
        has_next=page * page_size < total,
    )


@router.get("/{observation_id}", summary="Fetch a single stored observation")
def get_observation(observation_id: str, db: Session = Depends(get_db)):
    import uuid as uuid_module

    try:
        key = uuid_module.UUID(observation_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid observation id") from exc
    row = db.execute(
        select(BuoyObservation, BuoyDevice, CoastalZone)
        .join(BuoyDevice, BuoyObservation.buoy_id == BuoyDevice.id)
        .join(CoastalZone, BuoyDevice.zone_id == CoastalZone.id)
        .where(BuoyObservation.id == key)
    ).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Observation not found")
    obs, buoy, zone = row
    return observation_out(obs, buoy, zone)


def _aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)

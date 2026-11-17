"""Satellite sync, dataset catalogue and thumbnail serving."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import require_api_key
from app.db.session import get_db
from app.models.health import DataSourceStatus
from app.models.satellite import SatelliteDataset, SatelliteJob
from app.models.zone import CoastalZone
from app.schemas.satellite import (
    SatelliteDatasetOut,
    SatelliteJobOut,
    SatelliteSyncIn,
    SatelliteSyncResponse,
)
from app.services.satellite.service import (
    create_job,
    provider_description,
    run_job,
    satellite_summary,
    thumbnail_path_for,
)
from app.services.serializers import dataset_out
from app.services.status_service import SATELLITE_SOURCE_NAME

router = APIRouter(prefix="/satellite", tags=["satellite"])

ACCEPTANCE_NOTE = (
    "Satellite acquisition queued. Only catalogue metadata and a quicklook thumbnail are stored; "
    "full Sentinel-2 raster download requires a Copernicus account. Optical imagery is contextual "
    "and is not a wave-height measurement."
)


@router.post(
    "/sync",
    response_model=SatelliteSyncResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[Depends(require_api_key)],
    summary="Queue a satellite metadata + quicklook acquisition",
)
def sync_satellite(
    payload: SatelliteSyncIn,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
) -> SatelliteSyncResponse:
    zone = None
    if payload.zone_id:
        zone = db.get(CoastalZone, payload.zone_id)
    elif payload.zone_code:
        zone = db.scalar(select(CoastalZone).where(CoastalZone.zone_code == payload.zone_code.upper()))
    if zone is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coastal zone not found")

    job = create_job(db, payload, zone)
    background.add_task(run_job, job.id)
    db.refresh(job)
    return SatelliteSyncResponse(job=SatelliteJobOut.model_validate(job), acceptance_note=ACCEPTANCE_NOTE)


@router.get("/jobs/{job_id}", response_model=SatelliteJobOut, summary="Satellite job status")
def satellite_job(job_id: uuid.UUID, db: Session = Depends(get_db)) -> SatelliteJobOut:
    job = db.get(SatelliteJob, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Satellite job not found")
    return SatelliteJobOut.model_validate(job)


@router.get("/datasets", response_model=list[SatelliteDatasetOut], summary="Stored satellite metadata")
def list_datasets(
    zone_code: str | None = Query(default=None, max_length=32),
    zone_id: uuid.UUID | None = Query(default=None),
    limit: int = Query(default=24, ge=1, le=100),
    db: Session = Depends(get_db),
) -> list[SatelliteDatasetOut]:
    stmt = select(SatelliteDataset)
    if zone_id:
        stmt = stmt.where(SatelliteDataset.zone_id == zone_id)
    if zone_code:
        stmt = stmt.join(CoastalZone, SatelliteDataset.zone_id == CoastalZone.id).where(
            CoastalZone.zone_code == zone_code.upper()
        )
    rows = db.scalars(stmt.order_by(SatelliteDataset.acquired_at.desc()).limit(limit))
    return [dataset_out(row) for row in rows]


@router.get("/datasets/{dataset_id}", response_model=SatelliteDatasetOut, summary="Satellite dataset detail")
def dataset_detail(dataset_id: uuid.UUID, db: Session = Depends(get_db)) -> SatelliteDatasetOut:
    dataset = db.get(SatelliteDataset, dataset_id)
    if dataset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    return dataset_out(dataset)


@router.get("/datasets/{dataset_id}/thumbnail", summary="Cached provider quicklook image")
def dataset_thumbnail(dataset_id: uuid.UUID, db: Session = Depends(get_db)) -> FileResponse:
    dataset = db.get(SatelliteDataset, dataset_id)
    if dataset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Dataset not found")
    path = thumbnail_path_for(dataset)
    if path is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No cached quicklook for this dataset. Run a satellite sync while the provider is reachable.",
        )
    media_type = "image/png" if path.suffix.lower() == ".png" else "image/jpeg"
    return FileResponse(path, media_type=media_type, headers={"Cache-Control": "public, max-age=86400"})


@router.get("/provider", summary="Configured satellite provider and local cache summary")
def provider_info(db: Session = Depends(get_db)) -> dict:
    source = db.scalar(
        select(DataSourceStatus).where(DataSourceStatus.source_name == SATELLITE_SOURCE_NAME)
    )
    description = provider_description()
    description["source_status"] = source.status if source else "not_synced"
    description["last_error"] = source.last_error if source else None
    description["summary"] = satellite_summary(db)
    return description

"""Satellite acquisition orchestration with cached fallback."""

from __future__ import annotations

import logging
import re
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.health import DataSourceStatus
from app.models.satellite import SatelliteDataset, SatelliteJob
from app.models.zone import CoastalZone
from app.schemas.satellite import SatelliteSyncIn
from app.services.satellite.base import SatelliteProvider, SatelliteProviderError, SatelliteProduct
from app.services.satellite.copernicus_stac import CopernicusStacProvider
from app.services.status_service import (
    SATELLITE_SOURCE_NAME,
    get_or_create_source,
    record_satellite_failure,
    record_satellite_success,
)

logger = logging.getLogger(__name__)


def build_provider(provider_name: str | None = None) -> SatelliteProvider:
    name = (provider_name or settings.satellite_provider).lower()
    if name in {"copernicus", "copernicus-stac", "copernicus_stac", "cdse"}:
        return CopernicusStacProvider(
            settings.satellite_api_base_url, timeout=settings.satellite_timeout_seconds
        )
    raise SatelliteProviderError(
        f"Unknown satellite provider '{name}'. Supported: copernicus-stac.", kind="config"
    )


def provider_description() -> dict:
    description = build_provider().describe()
    return {
        "provider": description.provider,
        "name": description.name,
        "access": description.access,
        "dataset": description.dataset,
        "license": description.license,
        "note": description.note,
        "docs_url": description.docs_url,
        "api_base_url": settings.satellite_api_base_url,
        "default_collection": settings.satellite_collection,
    }


def cached_datasets(db: Session, zone_id: uuid.UUID, limit: int = 12) -> list[SatelliteDataset]:
    return list(
        db.scalars(
            select(SatelliteDataset)
            .where(SatelliteDataset.zone_id == zone_id)
            .order_by(SatelliteDataset.acquired_at.desc())
            .limit(limit)
        )
    )


def create_job(db: Session, payload: SatelliteSyncIn, zone: CoastalZone) -> SatelliteJob:
    provider = build_provider(payload.provider)
    query = {
        "collection": payload.collection,
        "date_from": payload.date_from.isoformat(),
        "date_to": payload.date_to.isoformat(),
        "max_cloud_cover_percent": payload.max_cloud_cover_percent,
        "max_products": payload.max_products,
        "bbox": list(zone.boundary.bounds),
        "api_base_url": settings.satellite_api_base_url,
        "provider": provider.name,
    }
    job = SatelliteJob(
        provider=provider.name,
        zone_id=zone.id,
        query_parameters=query,
        status="queued",
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def run_job(job_id: uuid.UUID) -> None:
    """Background worker. Always leaves a persisted terminal status."""
    with SessionLocal() as db:
        job = db.get(SatelliteJob, job_id)
        if job is None:
            logger.error("satellite job %s vanished", job_id)
            return
        zone = db.get(CoastalZone, job.zone_id) if job.zone_id else None
        if zone is None:
            job.status = "failed"
            job.error_message = "Coastal zone not found for this job"
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
            return

        job.status = "running"
        job.started_at = datetime.now(timezone.utc)
        db.commit()

        query = job.query_parameters or {}
        try:
            provider = build_provider(job.provider)
            products = provider.search(
                bounds=tuple(query["bbox"]),  # type: ignore[arg-type]
                date_from=date.fromisoformat(query["date_from"]),
                date_to=date.fromisoformat(query["date_to"]),
                collection=query.get("collection", settings.satellite_collection),
                max_cloud_cover_percent=float(query.get("max_cloud_cover_percent", 40.0)),
                limit=int(query.get("max_products", 4)),
            )
            job.datasets_found = len(products)
            warnings: list[str] = []
            stored = 0
            for product in products:
                try:
                    thumbnail = _download_thumbnail(provider, product)
                except SatelliteProviderError as exc:
                    thumbnail = None
                    warnings.append(f"{product.product_id}: thumbnail unavailable ({exc.kind})")
                created = upsert_product(db, zone, product, thumbnail)
                if created:
                    stored += 1
            job.datasets_stored = stored
            job.status = "completed"
            job.warnings = warnings or None
            job.completed_at = datetime.now(timezone.utc)
            latest = max((product.acquired_at for product in products), default=None)
            record_satellite_success(
                db,
                acquired_at=latest,
                stored=stored,
                used_cache=False,
                provider=provider.name,
            )
        except SatelliteProviderError as exc:
            logger.warning("satellite sync failed: %s", exc)
            cached = cached_datasets(db, zone.id, limit=1)
            job.status = "completed_with_fallback" if cached else "failed"
            job.used_cache = bool(cached)
            job.error_message = f"{exc.kind}: {exc}"
            job.warnings = [
                "Provider unavailable. Showing previously cached satellite metadata; "
                "acquisition dates are unchanged."
            ] if cached else ["Provider unavailable and no cached datasets exist for this zone."]
            job.completed_at = datetime.now(timezone.utc)
            record_satellite_failure(db, f"{exc.kind}: {exc}")
        except Exception as exc:  # noqa: BLE001 - never leave a running job behind
            logger.exception("unexpected satellite job failure")
            job.status = "failed"
            job.error_message = f"unexpected_error: {exc}"
            job.completed_at = datetime.now(timezone.utc)
            record_satellite_failure(db, f"unexpected_error: {exc}")
        db.commit()


def upsert_product(
    db: Session,
    zone: CoastalZone,
    product: SatelliteProduct,
    thumbnail: bytes | None,
) -> bool:
    existing = db.scalar(
        select(SatelliteDataset).where(
            SatelliteDataset.provider == product.provider,
            SatelliteDataset.product_id == product.product_id,
        )
    )
    thumbnail_path: Path | None = None
    if thumbnail:
        thumbnail_path = _cache_dir() / f"{_safe_name(product.product_id)}.jpg"
        thumbnail_path.write_bytes(thumbnail)

    if existing is not None:
        if thumbnail_path is not None:
            existing.thumbnail_uri = str(thumbnail_path)
            existing.processing_status = "thumbnail_cached"
            existing.downloaded_at = datetime.now(timezone.utc)
        if existing.zone_id is None:
            existing.zone_id = zone.id
        return False

    dataset = SatelliteDataset(
        zone_id=zone.id,
        provider=product.provider,
        collection=product.collection,
        product_id=product.product_id,
        acquired_at=product.acquired_at,
        downloaded_at=datetime.now(timezone.utc) if thumbnail_path else None,
        footprint=product.footprint,
        asset_uri=product.asset_uri,
        thumbnail_uri=str(thumbnail_path) if thumbnail_path else None,
        cloud_cover_percent=product.cloud_cover_percent,
        resolution_m=product.resolution_m,
        crs=product.crs,
        metadata_json=product.metadata,
        license=product.license,
        attribution=product.attribution,
        processing_status="thumbnail_cached" if thumbnail_path else "metadata_only",
    )
    db.add(dataset)
    db.flush()
    return True


def thumbnail_path_for(dataset: SatelliteDataset) -> Path | None:
    if not dataset.thumbnail_uri:
        return None
    path = Path(dataset.thumbnail_uri).resolve()
    cache_root = _cache_dir().resolve()
    if cache_root not in path.parents:
        return None
    return path if path.exists() else None


def satellite_summary(db: Session, zone_id: uuid.UUID | None = None) -> dict:
    stmt = select(SatelliteDataset)
    if zone_id:
        stmt = stmt.where(SatelliteDataset.zone_id == zone_id)
    rows = list(db.scalars(stmt.order_by(SatelliteDataset.acquired_at.desc()).limit(200)))
    latest_acquired = rows[0].acquired_at if rows else None
    total = db.scalar(select(func.count(SatelliteDataset.id))) or 0
    source = db.scalar(
        select(DataSourceStatus).where(DataSourceStatus.source_name == SATELLITE_SOURCE_NAME)
    )
    last_job = db.scalar(select(SatelliteJob).order_by(SatelliteJob.created_at.desc()).limit(1))
    return {
        "dataset_count": int(total),
        "latest_acquired_at": latest_acquired.isoformat() if latest_acquired else None,
        "source_status": source.status if source else "unknown",
        "last_error": source.last_error if source else None,
        "last_job_status": last_job.status if last_job else None,
        "cache_note": (
            "Satellite records shown are historical acquisitions retrieved from the provider, "
            "not live imagery. Quicklooks are cached locally."
        ),
    }


def _download_thumbnail(provider: SatelliteProvider, product: SatelliteProduct) -> bytes | None:
    if not product.thumbnail_url:
        return None
    return provider.fetch_thumbnail(product.thumbnail_url)


def _cache_dir() -> Path:
    path = Path(settings.satellite_cache_dir)
    path.mkdir(parents=True, exist_ok=True)
    return path


def _safe_name(value: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", value)[:120]
    return cleaned or uuid.uuid4().hex


def default_date_range(days: int = 30) -> tuple[date, date]:
    today = datetime.now(timezone.utc).date()
    return today - timedelta(days=days), today

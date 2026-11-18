"""Data-source status bookkeeping (freshness, errors, provenance metadata)."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.health import DataSourceStatus

BUOY_SOURCE_NAME = "telemetry-buoy"
SATELLITE_SOURCE_NAME = "copernicus-sentinel-2-stac"
MODEL_SOURCE_NAME = "pantaupesisir-anomaly-model"
TRAINING_SOURCE_NAME = "noaa-ndbc-training-archive"


def get_or_create_source(
    db: Session, *, source_name: str, source_type: str, metadata: dict | None = None
) -> DataSourceStatus:
    row = db.scalar(select(DataSourceStatus).where(DataSourceStatus.source_name == source_name))
    if row is None:
        row = DataSourceStatus(
            source_name=source_name,
            source_type=source_type,
            status="unknown",
            metadata_json=metadata or {},
        )
        db.add(row)
        db.flush()
    return row


def record_buoy_ingest(
    db: Session,
    *,
    observed_at: datetime,
    received_at: datetime,
    source_type: str,
    valid: bool,
    buoy_code: str,
) -> DataSourceStatus:
    row = get_or_create_source(
        db,
        source_name=BUOY_SOURCE_NAME,
        source_type="simulated" if source_type == "simulated" else "observation",
        metadata={
            "label": "Telemetri buoy",
            "source_type": source_type,
            "generator_version": "1.0.0",
            "note": "Pembacaan buoy yang divalidasi sebelum disimpan ke basis data.",
        },
    )
    row.status = "online" if valid else "degraded"
    row.last_observed_at = observed_at
    row.last_received_at = received_at
    if valid:
        row.last_success_at = received_at
    else:
        row.last_error = f"Catatan terakhir dari {buoy_code} gagal validasi kelayakan."
    metadata = dict(row.metadata_json or {})
    metadata["last_buoy_code"] = buoy_code
    row.metadata_json = metadata
    row.updated_at = datetime.now(timezone.utc)
    return row


def record_satellite_success(
    db: Session, *, acquired_at: datetime | None, stored: int, used_cache: bool, provider: str
) -> DataSourceStatus:
    row = get_or_create_source(
        db,
        source_name=SATELLITE_SOURCE_NAME,
        source_type="satellite",
        metadata={
            "label": "Copernicus Sentinel-2 L2A (metadata STAC + pratinjau)",
            "provider": provider,
            "access": "Pencarian STAC tanpa autentikasi; unduhan pratinjau thumbnail",
            "note": "Citra hanya konteks. Bukan pengukuran tinggi gelombang.",
        },
    )
    now = datetime.now(timezone.utc)
    row.status = "online" if not used_cache else "stale_cache"
    row.last_success_at = now
    if acquired_at is not None:
        row.last_observed_at = acquired_at
    row.last_error = None
    metadata = dict(row.metadata_json or {})
    metadata["last_sync_datasets_stored"] = stored
    metadata["last_sync_at"] = now.isoformat()
    metadata["used_cache"] = used_cache
    row.metadata_json = metadata
    row.updated_at = now
    return row


def record_satellite_failure(db: Session, error: str) -> DataSourceStatus:
    row = get_or_create_source(
        db, source_name=SATELLITE_SOURCE_NAME, source_type="satellite", metadata={}
    )
    row.status = "unavailable"
    row.last_error = error[:500]
    row.updated_at = datetime.now(timezone.utc)
    return row


def record_model_loaded(db: Session, *, version: str, artifact: str, metrics: dict | None) -> DataSourceStatus:
    row = get_or_create_source(
        db,
        source_name=MODEL_SOURCE_NAME,
        source_type="derived_model",
        metadata={"label": "Detektor anomali Isolation Forest", "note": "Bukan detektor tsunami."},
    )
    now = datetime.now(timezone.utc)
    row.status = "online"
    row.last_success_at = now
    row.last_error = None
    metadata = dict(row.metadata_json or {})
    metadata.update({"model_version": version, "artifact": artifact})
    if metrics:
        metadata["metrics"] = metrics
    row.metadata_json = metadata
    row.updated_at = now
    return row

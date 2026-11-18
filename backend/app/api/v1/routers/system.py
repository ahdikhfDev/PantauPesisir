"""System health, data-source status and dashboard overview."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import and_, func, select, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.ml.inference import model_availability
from app.models.alert import Alert
from app.models.analytics import AIPrediction
from app.models.health import DataSourceStatus
from app.models.observation import BuoyObservation
from app.models.satellite import SatelliteDataset
from app.models.zone import BuoyDevice, CoastalZone
from app.schemas.system import (
    DashboardOverview,
    DataSourceStatusOut,
    DataSourcesResponse,
    SystemHealthOut,
    ZoneOut,
)
from app.services.satellite.service import provider_description, satellite_summary
from app.services.serializers import (
    alert_out,
    observation_out,
    prediction_out,
    source_status_out,
    zone_out,
)
from app.services.simulator import simulator
from app.services.validation import staleness_seconds

router = APIRouter(prefix="/system", tags=["system"])

PROVENANCE_NOTICE = (
    "PantauPesisir adalah konsol pemantauan pesisir. Pembacaan buoy dilengkapi status sumber dan "
    "divalidasi sebelum ditampilkan; rekaman satelit adalah akuisisi Copernicus untuk konteks "
    "pesisir; keluaran AI berasal dari model analitik terverifikasi."
)

STALE_AFTER_SECONDS = 300


@router.get("/health", response_model=SystemHealthOut, summary="Backend, database and model health")
def health(db: Session = Depends(get_db)) -> SystemHealthOut:
    database: dict = {"dialect": db.bind.dialect.name if db.bind else "unknown", "ok": False}
    try:
        db.execute(text("SELECT 1"))
        database["ok"] = True
    except Exception as exc:  # noqa: BLE001 - health endpoint must answer
        database["error"] = f"{type(exc).__name__}: {exc}"

    model = model_availability()
    model.pop("path", None)
    counts = {
        "coastal_zones": int(db.scalar(select(func.count(CoastalZone.id))) or 0),
        "buoy_devices": int(db.scalar(select(func.count(BuoyDevice.id))) or 0),
        "buoy_observations": int(db.scalar(select(func.count(BuoyObservation.id))) or 0),
        "satellite_datasets": int(db.scalar(select(func.count(SatelliteDataset.id))) or 0),
        "ai_predictions": int(db.scalar(select(func.count(AIPrediction.id))) or 0),
        "alerts_open": int(
            db.scalar(select(func.count(Alert.id)).where(Alert.status == "open")) or 0
        ),
    }
    provider = provider_description()
    overall = "ok" if database["ok"] and model.get("available") else "degraded"
    return SystemHealthOut(
        status=overall,
        version=settings.app_version,
        environment=settings.environment,
        demo_mode=settings.demo_mode,
        database=database,
        model=model,
        simulator=simulator.status(),
        satellite_provider={
            "provider": provider["provider"],
            "name": provider["name"],
            "api_base_url": provider["api_base_url"],
            "collection": provider["default_collection"],
        },
        counts=counts,
        generated_at=datetime.now(timezone.utc),
    )


@router.get("/data-sources", response_model=DataSourcesResponse, summary="Source freshness and status")
def data_sources(db: Session = Depends(get_db)) -> DataSourcesResponse:
    rows = list(db.scalars(select(DataSourceStatus).order_by(DataSourceStatus.source_name)))
    return DataSourcesResponse(
        items=[source_status_out(row) for row in rows],
        generated_at=datetime.now(timezone.utc),
    )


@router.get("/overview", response_model=DashboardOverview, summary="Aggregated dashboard overview")
def overview(db: Session = Depends(get_db)) -> DashboardOverview:
    zones = list(db.scalars(select(CoastalZone).order_by(CoastalZone.zone_name)))
    zone_outputs: list[ZoneOut] = []
    for zone in zones:
        buoys = list(db.scalars(select(BuoyDevice).where(BuoyDevice.zone_id == zone.id)))
        zone_outputs.append(zone_out(zone, buoys))

    now = datetime.now(timezone.utc)
    latest_subquery = (
        select(
            BuoyObservation.buoy_id.label("buoy_id"),
            func.max(BuoyObservation.observed_at).label("max_observed_at"),
        )
        .where(BuoyObservation.validation_status == "valid")
        .group_by(BuoyObservation.buoy_id)
        .subquery()
    )
    rows = db.execute(
        select(BuoyObservation, BuoyDevice, CoastalZone)
        .join(BuoyDevice, BuoyObservation.buoy_id == BuoyDevice.id)
        .join(CoastalZone, BuoyDevice.zone_id == CoastalZone.id)
        .join(
            latest_subquery,
            and_(
                BuoyObservation.buoy_id == latest_subquery.c.buoy_id,
                BuoyObservation.observed_at == latest_subquery.c.max_observed_at,
            ),
        )
        .order_by(BuoyObservation.observed_at.desc())
    ).all()
    latest_observations = [
        observation_out(obs, buoy, zone, now=now).model_dump(mode="json")
        for obs, buoy, zone in rows
    ]
    newest_age = min(
        (staleness_seconds(obs.observed_at, now) for obs, _, _ in rows), default=None
    )

    prediction = db.scalar(select(AIPrediction).order_by(AIPrediction.created_at.desc()).limit(1))
    latest_prediction = None
    if prediction is not None:
        zone = db.get(CoastalZone, prediction.zone_id)
        alert = db.scalar(select(Alert).where(Alert.prediction_id == prediction.id))
        latest_prediction = prediction_out(
            prediction, zone, alert_id=str(alert.id) if alert else None
        ).model_dump(mode="json")

    alert_rows = db.execute(
        select(Alert, CoastalZone)
        .join(CoastalZone, Alert.zone_id == CoastalZone.id)
        .order_by(Alert.created_at.desc())
        .limit(5)
    ).all()
    alert_counts = {
        "total": int(db.scalar(select(func.count(Alert.id))) or 0),
        "open": int(db.scalar(select(func.count(Alert.id)).where(Alert.status == "open")) or 0),
        "acknowledged": int(
            db.scalar(select(func.count(Alert.id)).where(Alert.status == "acknowledged")) or 0
        ),
        "resolved": int(
            db.scalar(select(func.count(Alert.id)).where(Alert.status == "resolved")) or 0
        ),
        "high": int(db.scalar(select(func.count(Alert.id)).where(Alert.severity == "high")) or 0),
    }

    sources = list(db.scalars(select(DataSourceStatus)))
    return DashboardOverview(
        generated_at=now,
        zones=zone_outputs,
        latest_observations=latest_observations,
        latest_prediction=latest_prediction,
        alert_counts=alert_counts,
        recent_alerts=[alert_out(alert, zone).model_dump(mode="json") for alert, zone in alert_rows],
        data_freshness={
            "newest_observation_age_seconds": newest_age,
            "stale": newest_age is None or newest_age > STALE_AFTER_SECONDS,
            "stale_after_seconds": STALE_AFTER_SECONDS,
            "sources": [source_status_out(row).model_dump(mode="json") for row in sources],
        },
        simulator=simulator.status(),
        satellite=satellite_summary(db),
        provenance_notice=PROVENANCE_NOTICE,
    )

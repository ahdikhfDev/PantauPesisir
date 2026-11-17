"""ORM -> response serialisers (geometry stays GeoJSON, never a provider path leak)."""

from __future__ import annotations

from datetime import datetime, timezone

from app.core.config import settings
from app.db.types import to_geojson
from app.models.alert import Alert
from app.models.analytics import AIPrediction, MLModel
from app.models.health import DataSourceStatus
from app.models.observation import BuoyObservation, Simulation
from app.models.satellite import SatelliteDataset
from app.models.zone import BuoyDevice, CoastalZone
from app.schemas.alerts import AlertOut
from app.schemas.analytics import PredictionOut
from app.schemas.buoy import BuoyDeviceOut, BuoyObservationOut, BuoyParameters, SimulationJobOut
from app.schemas.satellite import SatelliteDatasetOut
from app.schemas.system import DataSourceStatusOut, ZoneOut
from app.services.validation import staleness_seconds


def _point(location) -> tuple[float, float]:  # type: ignore[no-untyped-def]
    if location is None:
        return 0.0, 0.0
    return float(location.y), float(location.x)


def buoy_out(buoy: BuoyDevice, zone: CoastalZone | None = None) -> BuoyDeviceOut:
    lat, lon = _point(buoy.location)
    return BuoyDeviceOut(
        id=buoy.id,
        buoy_code=buoy.buoy_code,
        zone_id=buoy.zone_id,
        zone_code=zone.zone_code if zone else None,
        zone_name=zone.zone_name if zone else None,
        latitude=lat,
        longitude=lon,
        device_status=buoy.device_status,
        source_type=buoy.source_type,
    )


def zone_out(zone: CoastalZone, buoys: list[BuoyDevice] | None = None) -> ZoneOut:
    boundary = to_geojson(zone.boundary) or {"type": "MultiPolygon", "coordinates": []}
    centroid = None
    if zone.boundary is not None:
        point = zone.boundary.centroid
        centroid = {"latitude": float(point.y), "longitude": float(point.x)}
    return ZoneOut(
        id=zone.id,
        zone_code=zone.zone_code,
        zone_name=zone.zone_name,
        description=zone.description,
        boundary=boundary,
        boundary_note=zone.boundary_note,
        centroid=centroid,
        buoys=[buoy_out(buoy, zone) for buoy in (buoys or [])],
        created_at=zone.created_at,
    )


def observation_out(
    obs: BuoyObservation,
    buoy: BuoyDevice,
    zone: CoastalZone | None = None,
    now: datetime | None = None,
) -> BuoyObservationOut:
    lat, lon = _point(obs.location)
    return BuoyObservationOut(
        id=obs.id,
        buoy_code=buoy.buoy_code,
        zone_code=zone.zone_code if zone else None,
        simulation_id=obs.simulation_id,
        observed_at=obs.observed_at,
        received_at=obs.received_at,
        processed_at=obs.processed_at,
        parameters=BuoyParameters(
            wave_height_m=obs.wave_height_m,
            wave_period_s=obs.wave_period_s,
            wave_direction_deg=obs.wave_direction_deg,
            wind_speed_mps=obs.wind_speed_mps,
            wind_direction_deg=obs.wind_direction_deg,
            sea_temperature_c=obs.sea_temperature_c,
            air_pressure_hpa=obs.air_pressure_hpa,
        ),
        latitude=lat,
        longitude=lon,
        source_type=obs.source_type,
        scenario=obs.scenario,
        generator_version=obs.generator_version,
        validation_status=obs.validation_status,
        validation_errors=obs.validation_errors,
        data_age_seconds=staleness_seconds(obs.observed_at, now),
        idempotency_key=obs.idempotency_key,
    )


def simulation_out(sim: Simulation, zone: CoastalZone | None = None) -> SimulationJobOut:
    return SimulationJobOut(
        id=sim.id,
        scenario=sim.scenario,
        mode=sim.mode,
        status=sim.status,
        zone_code=zone.zone_code if zone else None,
        random_seed=sim.random_seed,
        generator_version=sim.generator_version,
        interval_seconds=sim.interval_seconds,
        observations_count=sim.observations_count,
        started_at=sim.started_at,
        ended_at=sim.ended_at,
        created_at=sim.created_at,
        notes=sim.notes,
    )


def dataset_out(dataset: SatelliteDataset) -> SatelliteDatasetOut:
    footprint = to_geojson(dataset.footprint) or {"type": "Polygon", "coordinates": []}
    thumbnail_url = None
    if dataset.thumbnail_uri:
        thumbnail_url = f"/satellite/datasets/{dataset.id}/thumbnail"
    return SatelliteDatasetOut(
        id=dataset.id,
        zone_id=dataset.zone_id,
        provider=dataset.provider,
        collection=dataset.collection,
        product_id=dataset.product_id,
        acquired_at=dataset.acquired_at,
        downloaded_at=dataset.downloaded_at,
        processed_at=dataset.processed_at,
        footprint=footprint,
        asset_uri=dataset.asset_uri,
        thumbnail_uri=dataset.thumbnail_uri,
        thumbnail_url=thumbnail_url,
        cloud_cover_percent=dataset.cloud_cover_percent,
        resolution_m=dataset.resolution_m,
        crs=dataset.crs,
        license=dataset.license,
        attribution=dataset.attribution,
        processing_status=dataset.processing_status,
        created_at=dataset.created_at,
        metadata=_safe_metadata(dataset.metadata_json),
    )


def prediction_out(
    prediction: AIPrediction,
    zone: CoastalZone | None = None,
    model: MLModel | None = None,
    alert_id: str | None = None,
    input_observation_count: int | None = None,
) -> PredictionOut:
    factors = prediction.contributing_factors or []
    return PredictionOut(
        id=prediction.id,
        zone_id=prediction.zone_id,
        zone_code=zone.zone_code if zone else None,
        zone_name=zone.zone_name if zone else None,
        model_version=prediction.model_version,
        model_name=model.model_name if model else None,
        algorithm=model.algorithm if model else None,
        analysis_started_at=prediction.analysis_started_at,
        analysis_ended_at=prediction.analysis_ended_at,
        observation_window_start=prediction.observation_window_start,
        observation_window_end=prediction.observation_window_end,
        windows_evaluated=prediction.windows_evaluated,
        input_observation_count=input_observation_count or len(prediction.input_observation_ids or []),
        input_observation_ids=prediction.input_observation_ids or [],
        matched_satellite_dataset_ids=prediction.matched_satellite_dataset_ids or [],
        anomaly_detected=prediction.anomaly_detected,
        anomaly_score=prediction.anomaly_score,
        anomaly_threshold=prediction.anomaly_threshold,
        risk_score=prediction.risk_score,
        risk_level=prediction.risk_level,  # type: ignore[arg-type]
        risk_method=(prediction.data_quality_summary or {}).get("risk_method"),
        contributing_factors=factors,
        explanation=prediction.explanation,
        recommendation=prediction.recommendation,
        caveats=prediction.caveats or [],
        data_quality_summary=prediction.data_quality_summary,
        is_simulated=prediction.is_simulated,
        created_at=prediction.created_at,
        alert_id=alert_id,  # type: ignore[arg-type]
    )


def alert_out(alert: Alert, zone: CoastalZone | None = None) -> AlertOut:
    return AlertOut(
        id=alert.id,
        prediction_id=alert.prediction_id,
        zone_id=alert.zone_id,
        zone_code=zone.zone_code if zone else None,
        zone_name=zone.zone_name if zone else None,
        severity=alert.severity,  # type: ignore[arg-type]
        title=alert.title,
        description=alert.description,
        status=alert.status,  # type: ignore[arg-type]
        source=alert.source,
        created_at=alert.created_at,
        acknowledged_at=alert.acknowledged_at,
        acknowledged_by=alert.acknowledged_by,
        resolved_at=alert.resolved_at,
    )


def source_status_out(row: DataSourceStatus) -> DataSourceStatusOut:
    age = None
    reference = row.last_observed_at or row.last_success_at
    if reference is not None:
        age = staleness_seconds(reference)
    return DataSourceStatusOut(
        source_name=row.source_name,
        source_type=row.source_type,
        status=row.status,
        last_observed_at=row.last_observed_at,
        last_received_at=row.last_received_at,
        last_success_at=row.last_success_at,
        last_error=row.last_error,
        age_seconds=age,
        metadata=row.metadata_json,
        updated_at=row.updated_at,
    )


def _safe_metadata(value: dict | None) -> dict | None:
    """Trim bulky provider payloads before sending them to the browser."""
    if not value:
        return None
    keep = {
        "platform",
        "instrument",
        "processing_level",
        "processing_version",
        "product_type",
        "orbit_state",
        "relative_orbit",
        "grid_code",
        "thumbnail_source",
        "thumbnail_cached_at",
        "provider_concepts",
        "collection_license",
        "retrieved_at",
    }
    return {key: value[key] for key in keep if key in value}


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

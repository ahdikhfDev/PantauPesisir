"""AI analysis orchestration: window selection, scoring, risk, alerts, explanation."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.ml.inference import (
    InsufficientDataError,
    ModelUnavailableError,
    score_window,
)
from app.ml.rubric import RUBRIC_VERSION, assess_risk
from app.models.alert import Alert
from app.models.analytics import AIPrediction, MLModel
from app.models.observation import BuoyObservation
from app.models.satellite import SatelliteDataset
from app.models.zone import BuoyDevice, CoastalZone
from app.services.time_sync import (
    align_observations_with_satellites,
    data_quality_summary,
)

CAVEATS = [
    "An anomaly score is not a probability of disaster and does not identify a tsunami.",
    "The model was trained on real NOAA NDBC observations (stations 51002 and 41010, 2022-2024) "
    "but scores simulated buoy telemetry here; a domain shift is expected.",
    "Buoy readings in this prototype are synthetic and are labelled simulated throughout the UI.",
    "Satellite quicklooks are historical optical imagery for coastal context and are not wave measurements.",
    "Prototype decision support only - never a substitute for BMKG, BPBD or official warnings.",
]


class ZoneNotFoundError(LookupError):
    pass


def resolve_zone(db: Session, zone_id: uuid.UUID | None, zone_code: str | None) -> CoastalZone:
    if zone_id:
        zone = db.get(CoastalZone, zone_id)
    elif zone_code:
        zone = db.scalar(select(CoastalZone).where(CoastalZone.zone_code == zone_code))
    else:
        zone = None
    if zone is None:
        raise ZoneNotFoundError("Coastal zone not found")
    return zone


def run_analysis(
    db: Session,
    *,
    zone: CoastalZone,
    window_minutes: int,
    model_version: str | None = None,
    create_alert: bool = True,
) -> tuple[AIPrediction, Alert | None, dict]:
    started_at = datetime.now(timezone.utc)
    observations = _load_window(db, zone.id, window_minutes)
    if len(observations) < 3:
        raise InsufficientDataError(
            f"Only {len(observations)} valid observation(s) in the last {window_minutes} minutes "
            "for this zone. Run the simulator or widen the window."
        )

    records = [_record(obs) for obs in observations]
    score = score_window(records, model_version)

    risk = assess_risk(
        wave_height_m=score.latest["wave_height_m"],
        wind_speed_mps=score.latest["wind_speed_mps"],
        wave_period_s=score.latest["wave_period_s"],
        pressure_drop_hpa=score.pressure_drop_hpa,
        anomaly_score=score.anomaly_score,
    )

    datasets = list(
        db.scalars(
            select(SatelliteDataset)
            .where(SatelliteDataset.zone_id == zone.id)
            .order_by(SatelliteDataset.acquired_at.desc())
            .limit(8)
        )
    )
    alignment = align_observations_with_satellites(observations, datasets, settings.ml_matching_window_minutes)
    quality = data_quality_summary(observations)
    quality.update(
        {
            "risk_method": RUBRIC_VERSION,
            "risk_components": risk.components,
            "satellite_alignment": {
                "matched_pairs": alignment["matched_pairs"],
                "unmatched_satellite_dataset_ids": alignment["unmatched_satellite_dataset_ids"],
                "window_minutes": alignment["window_minutes"],
                "policy_note": alignment["policy_note"],
            },
            "model_training_dataset": score.model_metadata.get("training_dataset"),
            "model_trained_at": score.model_metadata.get("trained_at"),
            "inference_input_provenance": "simulated buoy telemetry",
        }
    )

    explanation = _explain(zone, score, risk, quality)
    recommendation = _recommend(zone, risk.level)
    is_simulated = all(obs.source_type == "simulated" for obs in observations)

    model_row = db.scalar(select(MLModel).where(MLModel.model_version == score.model_version))
    window_start = _aware(observations[0].observed_at)
    window_end = _aware(observations[-1].observed_at)

    prediction = AIPrediction(
        zone_id=zone.id,
        model_id=model_row.id if model_row else None,
        model_version=score.model_version,
        analysis_started_at=started_at,
        analysis_ended_at=datetime.now(timezone.utc),
        observation_window_start=window_start,
        observation_window_end=window_end,
        input_observation_ids=[str(obs.id) for obs in observations],
        matched_satellite_dataset_ids=alignment["matched_satellite_dataset_ids"],
        windows_evaluated=score.windows_evaluated,
        anomaly_detected=score.anomaly_detected,
        anomaly_score=score.anomaly_score,
        anomaly_threshold=score.anomaly_threshold,
        risk_score=risk.score,
        risk_level=risk.level,
        contributing_factors=score.factors,
        explanation=explanation,
        recommendation=recommendation,
        caveats=CAVEATS,
        data_quality_summary=quality,
        is_simulated=is_simulated,
    )
    db.add(prediction)
    db.flush()

    alert = None
    if create_alert:
        alert = _maybe_create_alert(db, zone, prediction, risk.level, score.anomaly_detected)
    db.commit()
    db.refresh(prediction)

    return prediction, alert, {"alignment": alignment, "quality": quality, "factors": score.factors}


def _load_window(db: Session, zone_id: uuid.UUID, window_minutes: int) -> list[BuoyObservation]:
    since = datetime.now(timezone.utc) - timedelta(minutes=window_minutes)
    return list(
        db.scalars(
            select(BuoyObservation)
            .join(BuoyDevice, BuoyObservation.buoy_id == BuoyDevice.id)
            .where(
                BuoyDevice.zone_id == zone_id,
                BuoyObservation.validation_status == "valid",
                BuoyObservation.observed_at >= since,
            )
            .order_by(BuoyObservation.observed_at.asc())
            .limit(settings.analytics_max_observations)
        )
    )


def _record(obs: BuoyObservation) -> dict:
    return {
        "buoy_code": str(obs.buoy_id),
        "observed_at": _aware(obs.observed_at),
        "wave_height_m": obs.wave_height_m,
        "wave_period_s": obs.wave_period_s,
        "wave_direction_deg": obs.wave_direction_deg,
        "wind_speed_mps": obs.wind_speed_mps,
        "wind_direction_deg": obs.wind_direction_deg,
        "sea_temperature_c": obs.sea_temperature_c,
        "air_pressure_hpa": obs.air_pressure_hpa,
    }


def _explain(zone: CoastalZone, score, risk, quality: dict) -> str:
    factors = score.factors[:3]
    factor_text = ", ".join(
        f"{factor['label'].lower()} {factor['value']} {factor['unit']} "
        f"({factor['direction']} baseline)"
        for factor in factors
    )
    detected_text = (
        "The anomaly score exceeds the calibrated threshold."
        if score.anomaly_detected
        else "The anomaly score remains inside the calibrated band."
    )
    return (
        f"Prototype analysis for {zone.zone_name} ({zone.zone_code}) over "
        f"{quality.get('observation_count', 0)} valid simulated observations "
        f"({quality.get('window_start', 'n/a')} to {quality.get('window_end', 'n/a')} UTC). "
        f"Peak anomaly score {score.anomaly_score:.2f} versus threshold "
        f"{score.anomaly_threshold:.2f}. {detected_text} "
        f"Largest deviations from the training baseline: {factor_text or 'none significant'}. "
        f"Latest conditions: {score.latest['wave_height_m']:.2f} m significant wave height, "
        f"{score.latest['wave_period_s']:.1f} s period, {score.latest['wind_speed_mps']:.1f} m/s wind, "
        f"{score.latest['air_pressure_hpa']:.1f} hPa. "
        f"Transparent rubric score {risk.score:.1f}/100 ({risk.level}) using "
        f"{RUBRIC_VERSION}."
    )


def _recommend(zone: CoastalZone, level: str) -> str:
    if level == "high":
        return (
            "Prototype advisory, not an official warning. Review before acting: coastal operators "
            f"and small vessels around {zone.zone_code} should consider postponing departures, "
            "securing equipment on the shoreline, and confirming the current marine forecast and "
            "any official early warning issued by BMKG, the regional BPBD, or port authorities."
        )
    if level == "moderate":
        return (
            "Prototype advisory, not an official warning. Coastal businesses and fishers near "
            f"{zone.zone_code} may want to check official BMKG marine forecasts and sea conditions "
            "before departure, and keep light equipment secured while the elevated readings persist."
        )
    return (
        "Conditions are inside the prototype normal band. Continue routine monitoring and confirm "
        f"operating decisions with official BMKG forecasts for {zone.zone_code}. No escalation is "
        "suggested by this prototype run."
    )


def _severity_label(severity: str) -> str:
    return {"high": "High-risk", "moderate": "Moderate-risk", "info": "Unusual"}.get(
        severity, severity.capitalize()
    )


def _maybe_create_alert(
    db: Session,
    zone: CoastalZone,
    prediction: AIPrediction,
    risk_level: str,
    anomaly_detected: bool,
) -> Alert | None:
    severity = None
    if risk_level == "high":
        severity = "high"
    elif risk_level == "moderate":
        severity = "moderate"
    elif anomaly_detected and (prediction.anomaly_score or 0) >= 0.8:
        severity = "info"
    if severity is None:
        return None

    since = datetime.now(timezone.utc) - timedelta(minutes=settings.alert_dedupe_minutes)
    existing = db.scalar(
        select(Alert)
        .where(
            Alert.zone_id == zone.id,
            Alert.severity == severity,
            Alert.status.in_(("open", "acknowledged")),
            Alert.created_at >= since,
        )
        .order_by(Alert.created_at.desc())
        .limit(1)
    )
    if existing is not None:
        return existing

    title = f"{_severity_label(severity)} coastal conditions — {zone.zone_name}"
    description = (
        f"Risk rubric level '{risk_level}' (score {prediction.risk_score}/100), "
        f"anomaly score {prediction.anomaly_score:.2f}. "
        f"{prediction.explanation[:420]} This is a simulated-data prototype alert and is not an "
        "official warning. Verify with BMKG/BPBD before any operational action."
    )
    alert = Alert(
        prediction_id=prediction.id,
        zone_id=zone.id,
        severity=severity,
        title=title,
        description=description,
        status="open",
        source="analytics",
    )
    db.add(alert)
    db.flush()
    return alert


def latest_prediction(db: Session, zone_id: uuid.UUID | None = None) -> AIPrediction | None:
    stmt = select(AIPrediction).order_by(AIPrediction.created_at.desc()).limit(1)
    if zone_id:
        stmt = (
            select(AIPrediction)
            .where(AIPrediction.zone_id == zone_id)
            .order_by(AIPrediction.created_at.desc())
            .limit(1)
        )
    return db.scalar(stmt)


def _aware(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)

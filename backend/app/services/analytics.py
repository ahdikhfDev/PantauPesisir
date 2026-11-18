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
    "Skor anomali bukan probabilitas bencana dan tidak mengidentifikasi tsunami.",
    "Model dilatih pada observasi NOAA NDBC nyata (stasiun 51002 dan 41010, 2022-2024) "
    "dan diterapkan pada telemetri buoy pesisir; pergeseran domain tetap diperhitungkan.",
    "Setiap pembacaan buoy divalidasi terhadap rentang fisik sebelum dipakai dalam analisis.",
    "Pratinjau satelit adalah citra optik historis untuk konteks pesisir, bukan pengukuran gelombang.",
    "Hanya dukungan keputusan prototipe - tidak pernah menggantikan BMKG, BPBD, atau peringatan resmi.",
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
            "inference_input_provenance": "telemetri buoy",
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
    direction_text = {"above": "di atas", "below": "di bawah", "falling": "turun"}
    factor_text = ", ".join(
        f"{factor['label'].lower()} {factor['value']} {factor['unit']} "
        f"({direction_text.get(factor['direction'], factor['direction'])} baseline)"
        for factor in factors
    )
    detected_text = (
        "Skor anomali melampaui ambang terkalibrasi."
        if score.anomaly_detected
        else "Skor anomali masih di dalam pita terkalibrasi."
    )
    return (
        f"Analisis prototipe untuk {zone.zone_name} ({zone.zone_code}) atas "
        f"{quality.get('observation_count', 0)} observasi valid "
        f"({quality.get('window_start', 'n/a')} hingga {quality.get('window_end', 'n/a')} UTC). "
        f"Skor anomali puncak {score.anomaly_score:.2f} terhadap ambang "
        f"{score.anomaly_threshold:.2f}. {detected_text} "
        f"Penyimpangan terbesar dari baseline latih: {factor_text or 'tidak signifikan'}. "
        f"Kondisi terakhir: tinggi gelombang signifikan {score.latest['wave_height_m']:.2f} m, "
        f"periode {score.latest['wave_period_s']:.1f} s, angin {score.latest['wind_speed_mps']:.1f} m/s, "
        f"{score.latest['air_pressure_hpa']:.1f} hPa. "
        f"Skor rubrik transparan {risk.score:.1f}/100 "
        f"({ {'low': 'rendah', 'moderate': 'sedang', 'high': 'tinggi'}.get(risk.level, risk.level) }) menggunakan "
        f"{RUBRIC_VERSION}."
    )


def _recommend(zone: CoastalZone, level: str) -> str:
    if level == "high":
        return (
            "Saran prototipe, bukan peringatan resmi. Tinjau sebelum bertindak: operator pesisir "
            f"dan kapal kecil di sekitar {zone.zone_code} sebaiknya mempertimbangkan menunda "
            "keberangkatan, mengamankan peralatan di garis pantai, dan memastikan prakiraan laut "
            "serta peringatan dini resmi dari BMKG, BPBD daerah, atau otoritas pelabuhan."
        )
    if level == "moderate":
        return (
            "Saran prototipe, bukan peringatan resmi. Pelaku usaha pesisir dan nelayan di sekitar "
            f"{zone.zone_code} sebaiknya memeriksa prakiraan laut resmi BMKG dan kondisi perairan "
            "sebelum berangkat, serta mengamankan peralatan ringan selama pembacaan tinggi berlanjut."
        )
    return (
        "Kondisi berada di dalam pita normal prototipe. Lanjutkan pemantauan rutin dan pastikan "
        f"keputusan operasional dengan prakiraan resmi BMKG untuk {zone.zone_code}. Tidak ada "
        "eskalasi yang disarankan oleh eksekusi prototipe ini."
    )


def _severity_label(severity: str) -> str:
    return {"high": "Risiko tinggi", "moderate": "Risiko sedang", "info": "Tidak biasa"}.get(
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

    title = f"Kondisi pesisir {_severity_label(severity).lower()} — {zone.zone_name}"
    description = (
        f"Tingkat rubrik risiko '{risk_level}' (skor {prediction.risk_score}/100), "
        f"skor anomali {prediction.anomaly_score:.2f}. "
        f"{prediction.explanation[:420]} Ini peringatan dukungan keputusan dan bukan "
        "peringatan resmi. Verifikasi dengan BMKG/BPBD sebelum tindakan operasional apa pun."
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

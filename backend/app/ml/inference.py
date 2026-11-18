"""Model loading and window scoring for the Isolation Forest anomaly detector.

The returned ``anomaly_score`` is a calibrated anomaly index in [0, 1] where
0.5 is the operating threshold. It is not a probability of any hazard.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import numpy as np

from app.core.config import settings
from app.ml.calibration import compute_calibration
from app.ml.features import FEATURE_LABELS, build_feature_frame, model_matrix

logger = logging.getLogger(__name__)

MIN_ROWS_FOR_SCORING = 3
EXPLAINABLE_FEATURES = [
    "wave_height_m",
    "air_pressure_hpa",
    "wave_height_rel_dev",
    "wave_steepness_rel_dev",
    "wind_speed_rel_dev",
    "pressure_rate_hpa_per_hour",
    "wave_height_change_ratio",
]


class ModelUnavailableError(RuntimeError):
    pass


class InsufficientDataError(ValueError):
    pass


@dataclass
class ModelBundle:
    pipeline: Any
    feature_names: list[str]
    threshold_raw: float
    cal_median: float
    cal_scale: float
    baseline: dict[str, dict[str, float]]
    metadata: dict
    metrics: dict
    calibration: dict
    path: Path

    def severity(self, raw_score: float) -> float:
        """Logistic map from Isolation Forest score to a 0-1 anomaly index."""
        scale = max(self.cal_scale, 1e-6)
        z = (self.threshold_raw - raw_score) / scale
        return float(np.clip(1.0 / (1.0 + np.exp(-z)), 0.0, 1.0))

    @property
    def anomaly_threshold(self) -> float:
        return self.severity(self.threshold_raw)


@dataclass
class WindowScore:
    anomaly_detected: bool
    anomaly_score: float
    anomaly_threshold: float
    windows_evaluated: int
    factors: list[dict]
    latest: dict[str, float]
    pressure_drop_hpa: float
    worst_observed_at: str | None
    model_version: str
    model_metadata: dict
    model_metrics: dict
    model_calibration: dict


_cache: dict[str, tuple[float, ModelBundle]] = {}


def artifact_path(version: str | None = None) -> Path:
    if version and version != settings.ml_model_version:
        return settings.model_artifact_path.parent / f"{version}.joblib"
    return settings.model_artifact_path


def load_model(version: str | None = None) -> ModelBundle:
    path = artifact_path(version)
    if not path.exists():
        raise ModelUnavailableError(
            f"Model artifact not found at {path}. Run: python backend/scripts/train_model.py"
        )
    mtime = path.stat().st_mtime
    cached = _cache.get(str(path))
    if cached and cached[0] == mtime:
        return cached[1]
    try:
        payload = joblib.load(path)
    except Exception as exc:  # noqa: BLE001 - corrupted artifact must degrade gracefully
        raise ModelUnavailableError(f"Model artifact could not be loaded: {exc}") from exc

    calibration = payload.get("calibration", {})
    bundle = ModelBundle(
        pipeline=payload["pipeline"],
        feature_names=payload["feature_names"],
        threshold_raw=float(payload["threshold_raw"]),
        cal_median=float(payload.get("cal_median", calibration.get("median_raw", 0.0))),
        cal_scale=float(payload.get("cal_scale", calibration.get("scale", 0.05))),
        baseline=payload.get("baseline", {}),
        metadata=payload.get("metadata", {}),
        metrics=payload.get("metrics", {}),
        calibration=calibration,
        path=path,
    )
    _cache[str(path)] = (mtime, bundle)
    logger.info("Loaded anomaly model %s from %s", bundle.metadata.get("model_version"), path)
    return bundle


def model_availability(version: str | None = None) -> dict:
    path = artifact_path(version)
    if not path.exists():
        return {"available": False, "path": str(path), "reason": "artifact_missing"}
    try:
        bundle = load_model(version)
    except ModelUnavailableError as exc:
        return {"available": False, "path": str(path), "reason": str(exc)}
    return {
        "available": True,
        "path": str(path),
        "version": bundle.metadata.get("model_version"),
        "trained_at": bundle.metadata.get("trained_at"),
        "training_dataset": bundle.metadata.get("training_dataset"),
        "calibration": bundle.calibration,
        "metrics": bundle.metrics,
    }


def score_window(records: list[dict], version: str | None = None) -> WindowScore:
    bundle = load_model(version)
    frame = build_feature_frame(records)
    required = ["wave_height_m", "wave_period_s", "wind_speed_mps", "air_pressure_hpa"]
    frame = frame.dropna(subset=required).reset_index(drop=True)
    if len(frame) < MIN_ROWS_FOR_SCORING:
        raise InsufficientDataError(
            f"At least {MIN_ROWS_FOR_SCORING} valid observations are required for scoring "
            f"(received {len(frame)})."
        )

    matrix = model_matrix(frame)
    scores = np.asarray(bundle.pipeline.score_samples(matrix), dtype=float)
    worst_index = int(np.argmin(scores))
    severity = bundle.severity(float(scores[worst_index]))
    pressure_drop = float(frame["air_pressure_hpa"].max() - frame["air_pressure_hpa"].iloc[-1])
    factors = _contributing_factors(frame, worst_index, bundle, pressure_drop)

    latest_row = frame.iloc[-1]
    latest = {
        "wave_height_m": float(latest_row["wave_height_m"]),
        "wave_period_s": float(latest_row["wave_period_s"]),
        "wind_speed_mps": float(latest_row["wind_speed_mps"]),
        "sea_temperature_c": float(latest_row["sea_temperature_c"]),
        "air_pressure_hpa": float(latest_row["air_pressure_hpa"]),
    }
    return WindowScore(
        anomaly_detected=bool(float(scores[worst_index]) < bundle.threshold_raw),
        anomaly_score=round(severity, 4),
        anomaly_threshold=round(bundle.anomaly_threshold, 4),
        windows_evaluated=len(frame),
        factors=factors,
        latest=latest,
        pressure_drop_hpa=round(pressure_drop, 2),
        worst_observed_at=_iso(latest_row["observed_at"]),
        model_version=str(bundle.metadata.get("model_version") or settings.ml_model_version),
        model_metadata=bundle.metadata,
        model_metrics=bundle.metrics,
        model_calibration=bundle.calibration,
    )


def _contributing_factors(
    frame, worst_index: int, bundle: ModelBundle, pressure_drop: float
) -> list[dict]:
    row = frame.iloc[worst_index]
    factors: list[dict] = []
    for name in EXPLAINABLE_FEATURES:
        stats = bundle.baseline.get(name)
        if not stats or name not in frame.columns:
            continue
        value = row.get(name)
        if value is None or not np.isfinite(value):
            continue
        std = stats.get("std") or 0.0
        mean = float(stats.get("mean", 0.0))
        if std <= 1e-9:
            continue
        deviation = float((float(value) - mean) / std)
        label, unit = FEATURE_LABELS.get(name, (name, ""))
        factors.append(
            {
                "feature": name,
                "label": label,
                "value": round(float(value), 2),
                "unit": unit,
                "baseline_mean": round(mean, 2),
                "deviation_sigma": round(deviation, 2),
                "direction": "above" if deviation >= 0 else "below",
            }
        )
    factors.sort(key=lambda item: abs(item["deviation_sigma"]), reverse=True)
    strongest = factors[:3]
    if pressure_drop >= 3.0:
        strongest.insert(
            0,
            {
                "feature": "pressure_drop_window",
                "label": "Penurunan tekanan dalam jendela",
                "value": round(pressure_drop, 1),
                "unit": "hPa",
                "baseline_mean": 0.0,
                "deviation_sigma": 0.0,
                "direction": "falling",
            },
        )
    return strongest


def _iso(value: Any) -> str | None:
    if value is None:
        return None
    if hasattr(value, "to_pydatetime"):
        value = value.to_pydatetime()
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat()
    return str(value)

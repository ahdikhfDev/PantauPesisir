from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pandas as pd
import pytest

from app.ml.features import FEATURE_NAMES, build_feature_frame, model_matrix
from app.ml.inference import InsufficientDataError, load_model, score_window
from app.ml.rubric import RUBRIC_VERSION, assess_risk


def _records(count: int = 24, wave: float = 1.4) -> list[dict]:
    start = datetime.now(timezone.utc) - timedelta(minutes=5 * count)
    return [
        {
            "buoy_code": "BUOY-TEST",
            "observed_at": start + timedelta(minutes=5 * index),
            "wave_height_m": wave + 0.02 * index,
            "wave_period_s": 6.0,
            "wave_direction_deg": 180.0,
            "wind_speed_mps": 5.0,
            "wind_direction_deg": 200.0,
            "sea_temperature_c": 29.0,
            "air_pressure_hpa": 1009.0,
        }
        for index in range(count)
    ]


def test_feature_frame_is_trailing_only():
    records = _records()
    frame = build_feature_frame(records)
    assert frame["observed_at"].is_monotonic_increasing
    assert set(FEATURE_NAMES) <= set(frame.columns)
    baseline = frame.iloc[5]["wave_height_roll_mean_6"]

    mutated = [dict(row) for row in records]
    mutated[-1]["wave_height_m"] = 9.9
    mutated_frame = build_feature_frame(mutated)
    assert mutated_frame.iloc[5]["wave_height_roll_mean_6"] == baseline


def test_score_window_is_deterministic_and_explainable():
    records = _records()
    first = score_window(records)
    second = score_window(records)
    assert first.anomaly_score == second.anomaly_score
    assert first.anomaly_detected == second.anomaly_detected
    assert 0.0 <= first.anomaly_score <= 1.0
    assert 0.0 <= first.anomaly_threshold <= 1.0
    assert first.windows_evaluated >= 3
    assert first.model_version == "cews-iforest-v1"
    assert first.factors and all("deviation_sigma" in factor for factor in first.factors)


def test_extreme_conditions_are_flagged_by_the_model():
    normal = score_window(_records(wave=1.2))
    extreme_records = _records(wave=1.2)
    for offset, row in enumerate(extreme_records[-6:]):
        row["wave_height_m"] = 7.5 + offset * 0.3
        row["wind_speed_mps"] = 22.0
        row["wave_period_s"] = 13.0
        row["air_pressure_hpa"] = 995.0
    extreme = score_window(extreme_records)
    assert extreme.anomaly_score > normal.anomaly_score
    assert extreme.anomaly_detected is True
    assert extreme.anomaly_score >= extreme.anomaly_threshold


def test_score_window_rejects_insufficient_data():
    with pytest.raises(InsufficientDataError):
        score_window(_records(count=2))


def test_model_artifact_exposes_documented_metrics():
    bundle = load_model()
    assert bundle.metrics["training_rows"] > 10_000
    assert bundle.metrics["proxy_evaluation"]["method"]
    assert "NOAA NDBC" in bundle.metadata["training_dataset"]
    assert bundle.metadata["dataset_provenance"]["license"]


def test_model_matrix_requires_feature_columns():
    with pytest.raises(KeyError):
        model_matrix(pd.DataFrame({"wave_height_m": [1.0]}))


def test_rubric_levels_are_transparent_and_monotonic():
    low = assess_risk(
        wave_height_m=0.8, wind_speed_mps=4.0, wave_period_s=5.0,
        pressure_drop_hpa=0.5, anomaly_score=0.1,
    )
    moderate = assess_risk(
        wave_height_m=2.7, wind_speed_mps=11.0, wave_period_s=8.5,
        pressure_drop_hpa=6.0, anomaly_score=0.4,
    )
    high = assess_risk(
        wave_height_m=6.2, wind_speed_mps=20.0, wave_period_s=13.0,
        pressure_drop_hpa=12.0, anomaly_score=0.9,
    )
    assert low.level == "low"
    assert moderate.level == "moderate"
    assert high.level == "high"
    assert low.score < moderate.score < high.score
    assert moderate.method == RUBRIC_VERSION
    assert sum(moderate.components.values()) == pytest.approx(moderate.score, abs=0.15)

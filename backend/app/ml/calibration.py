"""Operating-threshold calibration for the anomaly detector.

The Isolation Forest is fitted on **real** NOAA NDBC observations. Its raw
score distribution on *simulated* buoy telemetry is different from the training
distribution, so the operating threshold is calibrated on documented
normal-scenario windows produced by the buoy simulator (deterministic seeds).

This is a scenario-calibrated demonstration detector, not a validated
operational model. The calibration target is a 10% flag rate on normal windows,
which is reported in the model card and in the UI.
"""

from __future__ import annotations

from datetime import datetime, timezone

import numpy as np
import pandas as pd

from app.ml.features import build_feature_frame, model_matrix

CALIBRATION_ZONES = ("JKT-BAY", "SMR-UTC", "MKS-STR")
CALIBRATION_SEEDS = tuple(range(1, 31))
CALIBRATION_WINDOW_SAMPLES = 18
CALIBRATION_INTERVAL_SECONDS = 300
TARGET_FALSE_ALARM_RATE = 0.10
CALIBRATION_METHOD = "scenario_normal_windows_v1"


def generate_calibration_windows() -> list[list[dict]]:
    from app.services.simulator import generate_series

    end_at = datetime.now(timezone.utc).replace(microsecond=0)
    windows: list[list[dict]] = []
    for zone_code in CALIBRATION_ZONES:
        for seed in CALIBRATION_SEEDS:
            series = generate_series(
                zone_code=zone_code,
                scenario="normal",
                count=CALIBRATION_WINDOW_SAMPLES,
                interval_seconds=CALIBRATION_INTERVAL_SECONDS,
                seed=seed,
                end_at=end_at,
            )
            windows.append([{**row, "buoy_code": zone_code} for row in series])
    return windows


def window_raw_score(pipeline, records: list[dict]) -> float | None:
    frame = build_feature_frame(records)
    frame = frame.dropna(
        subset=["wave_height_m", "wave_period_s", "wind_speed_mps", "air_pressure_hpa"]
    ).reset_index(drop=True)
    if len(frame) < 3:
        return None
    scores = pipeline.score_samples(model_matrix(frame))
    return float(np.min(scores))


def compute_calibration(
    pipeline,
    *,
    target_false_alarm_rate: float = TARGET_FALSE_ALARM_RATE,
    windows: list[list[dict]] | None = None,
) -> dict:
    windows = windows if windows is not None else generate_calibration_windows()
    scores = [score for window in windows if (score := window_raw_score(pipeline, window)) is not None]
    if not scores:
        raise RuntimeError("Calibration windows produced no scorable feature frames")
    array = np.asarray(scores, dtype=float)
    median = float(np.median(array))
    # Lower Isolation Forest score = more anomalous, so the threshold is the
    # low quantile of the normal-window score distribution.
    threshold = float(np.quantile(array, target_false_alarm_rate))
    # Logistic mapping: raw == median -> 0.10, raw == threshold -> 0.50.
    span = median - threshold
    if span <= 1e-9:
        span = max(float(np.std(array)), 1e-6)
    return {
        "method": CALIBRATION_METHOD,
        "windows": len(scores),
        "zones": list(CALIBRATION_ZONES),
        "seeds": len(CALIBRATION_SEEDS),
        "samples_per_window": CALIBRATION_WINDOW_SAMPLES,
        "interval_seconds": CALIBRATION_INTERVAL_SECONDS,
        "target_false_alarm_rate": target_false_alarm_rate,
        "observed_false_alarm_rate": float((array < threshold).mean()),
        "threshold_raw": threshold,
        "median_raw": median,
        "scale": span / np.log(9.0),
        "minimum_raw": float(array.min()),
        "maximum_raw": float(array.max()),
        "note": (
            "Threshold and score scale are calibrated on synthetic normal-scenario windows. "
            "Flag rates on real telemetry would need recalibration with real coastal buoy data."
        ),
    }

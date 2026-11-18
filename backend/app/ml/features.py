"""Feature engineering shared by model training and inference.

Design goal: **location- and cadence-aware anomaly detection**.

The model must transfer from real open-ocean NOAA NDBC observations (10-minute
cadence) to simulated Indonesian coastal buoys (1-10 minute cadence). Absolute
climatology is therefore *not* used as model input - a warm, short-period bay sea
state is not "anomalous", it is simply a different regime. Instead the model
learns how a sea state departs from its own recent window: relative deviations,
pressure residuals and change rates. Absolute severity is handled by the
transparent prototype risk rubric (``app/ml/rubric.py``).

All features are trailing (past-only), so chronological splits do not leak.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

ROLLING_WINDOW = 6

RAW_REQUIRED = [
    "wave_height_m",
    "wave_period_s",
    "wind_speed_mps",
    "wind_direction_deg",
    "sea_temperature_c",
    "air_pressure_hpa",
]

FEATURE_NAMES = [
    "wave_height_m",
    "air_pressure_hpa",
    "wave_height_rel_dev",
    "wave_steepness_rel_dev",
    "wind_speed_rel_dev",
    "wave_period_rel_dev",
    "pressure_residual_hpa",
    "pressure_rate_hpa_per_hour",
    "wave_height_change_ratio",
    "sst_residual_c",
    "wave_direction_change_deg",
]

FEATURE_LABELS = {
    "wave_height_m": ("Tinggi gelombang", "m"),
    "air_pressure_hpa": ("Tekanan udara", "hPa"),
    "wave_height_rel_dev": ("Tinggi gelombang vs rata-rata terkini", "rasio"),
    "wave_steepness_rel_dev": ("Kecuraman gelombang vs rata-rata terkini", "rasio"),
    "wind_speed_rel_dev": ("Kecepatan angin vs rata-rata terkini", "rasio"),
    "wave_period_rel_dev": ("Periode gelombang vs rata-rata terkini", "rasio"),
    "pressure_residual_hpa": ("Tekanan vs rata-rata terkini", "hPa"),
    "pressure_rate_hpa_per_hour": ("Laju perubahan tekanan", "hPa/jam"),
    "wave_height_change_ratio": ("Laju perubahan tinggi gelombang", "rasio/sampel"),
    "sst_residual_c": ("Suhu laut vs rata-rata terkini", "\u00b0C"),
    "wave_direction_change_deg": ("Perubahan arah gelombang", "derajat/sampel"),
}


def build_feature_frame(records: list[dict[str, Any]] | pd.DataFrame) -> pd.DataFrame:
    frame = records.copy() if isinstance(records, pd.DataFrame) else pd.DataFrame(records)
    if frame.empty:
        return frame

    if "buoy_code" not in frame.columns:
        frame["buoy_code"] = "SINGLE"
    frame["observed_at"] = pd.to_datetime(frame["observed_at"], utc=True, errors="coerce")
    frame = (
        frame.dropna(subset=["observed_at"])
        .sort_values(["buoy_code", "observed_at"])
        .drop_duplicates(subset=["buoy_code", "observed_at"], keep="last")
        .reset_index(drop=True)
    )

    for column in RAW_REQUIRED:
        frame[column] = pd.to_numeric(frame[column], errors="coerce")

    frame["wave_steepness"] = frame["wave_height_m"] / (1.56 * frame["wave_period_s"].pow(2))
    grouped = frame.groupby("buoy_code", sort=False, group_keys=False)

    def rolling_mean(column: str) -> pd.Series:
        return grouped[column].transform(
            lambda series: series.rolling(ROLLING_WINDOW, min_periods=2).mean()
        )

    def relative_deviation(values: pd.Series, mean: pd.Series) -> pd.Series:
        return ((values - mean) / mean.clip(lower=0.1)).clip(-2.0, 2.0)

    wave_mean = rolling_mean("wave_height_m")
    period_mean = rolling_mean("wave_period_s")
    wind_mean = rolling_mean("wind_speed_mps")
    pressure_mean = rolling_mean("air_pressure_hpa")
    sst_mean = rolling_mean("sea_temperature_c")
    steepness_mean = rolling_mean("wave_steepness")

    frame["wave_height_rel_dev"] = relative_deviation(frame["wave_height_m"], wave_mean)
    frame["wave_period_rel_dev"] = relative_deviation(frame["wave_period_s"], period_mean)
    frame["wind_speed_rel_dev"] = relative_deviation(frame["wind_speed_mps"], wind_mean)
    frame["wave_steepness_rel_dev"] = relative_deviation(frame["wave_steepness"], steepness_mean)
    frame["pressure_residual_hpa"] = (frame["air_pressure_hpa"] - pressure_mean).clip(-40.0, 40.0)
    frame["sst_residual_c"] = (frame["sea_temperature_c"] - sst_mean).clip(-5.0, 5.0)

    # Cadence-invariant trend features: NDBC (10 min) and the simulator (1-10 min)
    # express change per hour rather than per sample.
    minutes_since_prev = grouped["observed_at"].transform(
        lambda series: series.diff().dt.total_seconds() / 60.0
    )
    frame["pressure_rate_hpa_per_hour"] = (
        grouped["air_pressure_hpa"].diff() / minutes_since_prev.clip(lower=0.5) * 60.0
    ).clip(-60.0, 60.0)
    previous_wave = grouped["wave_height_m"].transform(lambda series: series.shift(1).clip(lower=0.1))
    frame["wave_height_change_ratio"] = ((frame["wave_height_m"] - previous_wave) / previous_wave).clip(
        -2.0, 2.0
    )

    direction_series = frame["wave_direction_deg"]
    previous_direction = grouped["wave_direction_deg"].transform(lambda series: series.shift(1))
    delta = (direction_series - previous_direction) % 360.0
    frame["wave_direction_change_deg"] = np.minimum(delta, 360.0 - delta).clip(0.0, 180.0)

    frame["wave_height_roll_mean_6"] = wave_mean
    return frame


def model_matrix(frame: pd.DataFrame) -> pd.DataFrame:
    missing = [name for name in FEATURE_NAMES if name not in frame.columns]
    if missing:
        raise KeyError(f"feature frame is missing columns: {missing}")
    return frame[FEATURE_NAMES].astype(float)


def baseline_statistics(frame: pd.DataFrame) -> dict[str, dict[str, float]]:
    matrix = model_matrix(frame)
    stats: dict[str, dict[str, float]] = {}
    for name in FEATURE_NAMES:
        series = matrix[name].dropna()
        if series.empty:
            continue
        stats[name] = {
            "mean": float(series.mean()),
            "std": float(series.std(ddof=0)) or 0.0,
            "p05": float(series.quantile(0.05)),
            "p95": float(series.quantile(0.95)),
        }
    return stats

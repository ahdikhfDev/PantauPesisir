"""Download and normalise real NOAA NDBC historical standard meteorological data.

Source: NOAA National Data Buoy Center (NDBC), historical stdmet archive.
URL pattern: https://www.ndbc.noaa.gov/data/historical/stdmet/{station}h{year}.txt.gz
License: U.S. federal government work, public domain.

The resulting CSV is the documented training dataset for the PantauPesisir anomaly
model. It contains real measurements (not synthetic data). Simulated buoy
telemetry is only used at inference time.

Usage:
    python backend/scripts/fetch_training_data.py
"""

from __future__ import annotations

import gzip
import json
import sys
from datetime import date
from pathlib import Path

import httpx
import numpy as np
import pandas as pd

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_DIR.parent
RAW_DIR = REPO_ROOT / "data" / "raw"
OUT_DIR = BACKEND_DIR / "ml" / "data"
CSV_PATH = OUT_DIR / "ndbc_wave_training.csv"
PROVENANCE_PATH = OUT_DIR / "ndbc_wave_training.provenance.json"

BASE_URL = "https://www.ndbc.noaa.gov/data/historical/stdmet"

# Station metadata verified on the NDBC station pages (2026-11-18).
STATIONS: dict[str, dict] = {
    "51002": {
        "name": "SOUTHWEST HAWAII - 215NM SSW of Hilo, HI",
        "latitude": 17.070,
        "longitude": -157.755,
        "water_depth_m": 4979,
        "station_page": "https://www.ndbc.noaa.gov/station_page.php?station=51002",
    },
    "41010": {
        "name": "CANAVERAL EAST - 120NM East of Cape Canaveral",
        "latitude": 28.860,
        "longitude": -78.478,
        "water_depth_m": 903.1,
        "station_page": "https://www.ndbc.noaa.gov/station_page.php?station=41010",
    },
}
YEARS = (2022, 2023, 2024)

COLUMNS = [
    "YY",
    "MM",
    "DD",
    "hh",
    "mm",
    "WDIR",
    "WSPD",
    "GST",
    "WVHT",
    "DPD",
    "APD",
    "MWD",
    "PRES",
    "ATMP",
    "WTMP",
    "DEWP",
    "VIS",
    "TIDE",
]

# NDBC uses sentinel values for missing data.
SENTINELS = {
    "WDIR": 999,
    "WSPD": 99,
    "GST": 99,
    "WVHT": 99,
    "DPD": 99,
    "APD": 99,
    "MWD": 999,
    "PRES": 9999,
    "ATMP": 999,
    "WTMP": 999,
    "DEWP": 999,
    "VIS": 99,
    "TIDE": 99,
}

CORE_COLUMNS = ["WVHT", "DPD", "WSPD", "WDIR", "PRES", "WTMP"]


def fetch(station: str, year: int) -> Path:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    target = RAW_DIR / f"ndbc_{station}_{year}.txt.gz"
    if target.exists() and target.stat().st_size > 0:
        print(f"[cache] {target.name}")
        return target
    url = f"{BASE_URL}/{station}h{year}.txt.gz"
    print(f"[fetch] {url}")
    with httpx.Client(timeout=120.0, follow_redirects=True) as client:
        response = client.get(url)
        response.raise_for_status()
        target.write_bytes(response.content)
    return target


def load_station_year(station: str, year: int) -> pd.DataFrame:
    path = fetch(station, year)
    with gzip.open(path, "rt") as handle:
        frame = pd.read_csv(handle, sep=r"\s+", comment="#", header=None, names=COLUMNS)
    for column, sentinel in SENTINELS.items():
        frame.loc[frame[column] >= sentinel, column] = np.nan

    frame = frame.rename(
        columns={
            "WSPD": "wind_speed_mps",
            "WVHT": "wave_height_m",
            "DPD": "wave_period_s",
            "MWD": "wave_direction_deg",
            "WDIR": "wind_direction_deg",
            "PRES": "air_pressure_hpa",
            "WTMP": "sea_temperature_c",
            "ATMP": "air_temperature_c",
        }
    )
    frame["observed_at"] = pd.to_datetime(
        {
            "year": frame["YY"],
            "month": frame["MM"],
            "day": frame["DD"],
            "hour": frame["hh"],
            "minute": frame["mm"],
        },
        utc=True,
    )
    frame["ndbc_station"] = station
    frame["station_name"] = STATIONS[station]["name"]
    frame["source"] = "NOAA NDBC historical stdmet"
    frame = frame.dropna(subset=["wave_height_m", "wave_period_s", "wind_speed_mps", "wind_direction_deg", "air_pressure_hpa", "sea_temperature_c"])
    # Remove physically implausible values before training.
    frame = frame[
        (frame["wave_height_m"].between(0.05, 20.0))
        & (frame["wave_period_s"].between(1.0, 30.0))
        & (frame["wind_speed_mps"].between(0.0, 60.0))
        & (frame["wind_direction_deg"].between(0.0, 360.0))
        & (frame["air_pressure_hpa"].between(870.0, 1085.0))
        & (frame["sea_temperature_c"].between(-2.0, 40.0))
    ]
    frame["buoy_code"] = "NDBC-" + station
    return frame[
        [
            "buoy_code",
            "ndbc_station",
            "station_name",
            "observed_at",
            "wave_height_m",
            "wave_period_s",
            "wave_direction_deg",
            "wind_speed_mps",
            "wind_direction_deg",
            "sea_temperature_c",
            "air_pressure_hpa",
            "air_temperature_c",
            "source",
        ]
    ]


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    frames = []
    for station in STATIONS:
        for year in YEARS:
            try:
                part = load_station_year(station, year)
            except httpx.HTTPError as exc:
                print(f"[warn] {station} {year}: {exc}")
                continue
            print(f"[ok] {station} {year}: {len(part):,} valid rows")
            frames.append(part)

    if not frames:
        print("[error] no NDBC data could be downloaded", file=sys.stderr)
        return 1

    dataset = (
        pd.concat(frames, ignore_index=True)
        .sort_values(["buoy_code", "observed_at"])
        .drop_duplicates(subset=["buoy_code", "observed_at"])
    )
    dataset["observed_at"] = dataset["observed_at"].dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    dataset.to_csv(CSV_PATH, index=False)

    provenance = {
        "dataset_title": "NOAA NDBC Historical Standard Meteorological Data (stdmet)",
        "provider": "NOAA National Data Buoy Center (NDBC), USA",
        "landing_page": "https://www.ndbc.noaa.gov/",
        "data_access": "https://www.ndbc.noaa.gov/data/historical/stdmet/",
        "license": "Public domain (work of the U.S. federal government); attribution appreciated.",
        "attribution": "NOAA National Data Buoy Center (NDBC). Retrieved via NDBC historical stdmet archive.",
        "retrieved_on": date.today().isoformat(),
        "retrieval_method": "Direct HTTP GET of documented historical stdmet .txt.gz files",
        "stations": STATIONS,
        "years": list(YEARS),
        "columns": list(dataset.columns),
        "units": {
            "wave_height_m": "m (significant wave height, WVHT)",
            "wave_period_s": "s (dominant period, DPD)",
            "wave_direction_deg": "degrees true (MWD)",
            "wind_speed_mps": "m/s (WSPD)",
            "wind_direction_deg": "degrees true (WDIR)",
            "sea_temperature_c": "degC (WTMP, ~1 m depth)",
            "air_pressure_hpa": "hPa (PRES, sea level)",
        },
        "missing_value_handling": "NDBC sentinel values (99, 999, 9999) removed; rows lacking a core wave/weather variable dropped.",
        "row_count": int(len(dataset)),
        "temporal_coverage": {
            "start": str(dataset["observed_at"].min()),
            "end": str(dataset["observed_at"].max()),
        },
        "limitations": [
            "Stations are in the Pacific (Hawaii) and Atlantic (Florida) offshore zones, not Indonesian waters.",
            "Observing cadence is typically 10 minutes with sensor outages; gaps are preserved.",
            "No hazard labels are included. Wave-height percentiles are used only as an evaluation proxy.",
            "Training data are real measurements; PantauPesisir inference inputs come from buoy telemetry.",
        ],
    }
    PROVENANCE_PATH.write_text(json.dumps(provenance, indent=2), encoding="utf-8")

    print(f"\nWrote {CSV_PATH} ({len(dataset):,} rows)")
    print(f"Wrote {PROVENANCE_PATH}")
    print(
        "Wave height (m): "
        f"median={dataset['wave_height_m'].median():.2f}, "
        f"p95={dataset['wave_height_m'].quantile(0.95):.2f}, "
        f"max={dataset['wave_height_m'].max():.2f}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

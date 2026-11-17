"""Train the CEWS anomaly detector on real NOAA NDBC observations.

Usage:
    python backend/scripts/train_model.py --version cews-iforest-v1

Notes:
* Chronological 80/20 split; preprocessing is fitted on the training slice only.
* The Isolation Forest is unsupervised. There are no hazard labels, so the
  evaluation uses a documented proxy: do flagged samples concentrate in the
  top 5% of observed wave heights?
* The produced artifact is a demonstration model, not a validated forecasting
  or tsunami-detection model.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
from sklearn.ensemble import IsolationForest
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from app.ml.features import (  # noqa: E402
    FEATURE_NAMES,
    build_feature_frame,
    baseline_statistics,
    model_matrix,
)
from app.ml.calibration import compute_calibration  # noqa: E402

DEFAULT_CSV = BACKEND_DIR / "ml" / "data" / "ndbc_wave_training.csv"
PROVENANCE = BACKEND_DIR / "ml" / "data" / "ndbc_wave_training.provenance.json"
ARTIFACT_DIR = BACKEND_DIR / "ml" / "artifacts"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Train the CEWS Isolation Forest model")
    parser.add_argument("--csv", type=Path, default=DEFAULT_CSV)
    parser.add_argument("--version", default="cews-iforest-v1")
    parser.add_argument("--contamination", type=float, default=0.01)
    parser.add_argument("--n-estimators", type=int, default=250)
    parser.add_argument("--random-state", type=int, default=42)
    parser.add_argument("--test-fraction", type=float, default=0.2)
    parser.add_argument("--no-db", action="store_true", help="Skip writing the model registry row")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    if not args.csv.exists():
        print(f"[error] training CSV not found: {args.csv}", file=sys.stderr)
        print("        run: python backend/scripts/fetch_training_data.py", file=sys.stderr)
        return 1

    raw = pd.read_csv(args.csv)
    if raw.empty:
        print("[error] training CSV is empty", file=sys.stderr)
        return 1

    frame = build_feature_frame(raw)
    frame = frame.dropna(subset=["wave_height_m", "wave_period_s", "wind_speed_mps", "air_pressure_hpa"])
    frame = frame.sort_values("observed_at").reset_index(drop=True)

    split_index = int(len(frame) * (1 - args.test_fraction))
    if split_index < 200 or len(frame) - split_index < 50:
        print(f"[error] not enough rows to train/split: {len(frame)}", file=sys.stderr)
        return 1
    train_frame = frame.iloc[:split_index]
    test_frame = frame.iloc[split_index:]
    train_matrix = model_matrix(train_frame)
    test_matrix = model_matrix(test_frame)

    pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
            (
                "forest",
                IsolationForest(
                    n_estimators=args.n_estimators,
                    max_samples="auto",
                    contamination=args.contamination,
                    random_state=args.random_state,
                    n_jobs=-1,
                ),
            ),
        ]
    )
    pipeline.fit(train_matrix)

    # score_samples: higher = more normal.
    train_scores = pipeline.score_samples(train_matrix)
    test_scores = pipeline.score_samples(test_matrix)
    score_p1 = float(np.quantile(train_scores, 0.001))
    score_p50 = float(np.quantile(train_scores, 0.5))

    # The operating threshold is calibrated on documented normal-scenario windows
    # because inference input in this prototype is simulated telemetry.
    calibration = compute_calibration(pipeline)
    threshold_raw = float(calibration["threshold_raw"])
    cal_median = float(calibration["median_raw"])
    cal_scale = float(calibration["scale"])

    def severity(raw_scores: np.ndarray) -> np.ndarray:
        span = max(score_p50 - score_p1, 1e-9)
        return np.clip((score_p50 - raw_scores) / span, 0.0, 1.0)

    deployed_flagged = test_scores < threshold_raw
    wave = test_frame["wave_height_m"].to_numpy()
    p95_wave = float(np.quantile(test_frame["wave_height_m"], 0.95))

    # Behavioural proxy labels (no hazard labels exist): rapid pressure change and
    # abrupt sea-state change within one sampling step. Discrimination is measured
    # at a 1% reference threshold on the real validation slice, independent of the
    # scenario-calibrated operating threshold used at inference time.
    surface = test_frame.copy()
    grouped = surface.groupby("buoy_code", sort=False, group_keys=False)
    surface["_dp"] = grouped["air_pressure_hpa"].diff().abs()
    previous_wave = grouped["wave_height_m"].transform(lambda s: s.shift(1).clip(lower=0.1))
    surface["_dh"] = (surface["wave_height_m"] - previous_wave).abs() / previous_wave
    rapid_pressure = (surface["_dp"] >= surface["_dp"].quantile(0.95)).to_numpy()
    rapid_wave = (surface["_dh"] >= surface["_dh"].quantile(0.95)).to_numpy()

    reference_threshold = float(np.quantile(test_scores, 0.01))
    reference_flagged = test_scores < reference_threshold
    recall_pressure = float((reference_flagged & rapid_pressure).sum() / max(rapid_pressure.sum(), 1))
    recall_wave_change = float((reference_flagged & rapid_wave).sum() / max(rapid_wave.sum(), 1))
    random_rate = float(reference_flagged.mean())

    trained_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    baseline = baseline_statistics(train_frame)
    metrics = {
        "training_rows": int(len(train_frame)),
        "validation_rows": int(len(test_frame)),
        "train_period": [
            train_frame["observed_at"].min().isoformat(),
            train_frame["observed_at"].max().isoformat(),
        ],
        "validation_period": [
            test_frame["observed_at"].min().isoformat(),
            test_frame["observed_at"].max().isoformat(),
        ],
        "contamination": args.contamination,
        "flagged_rate_validation_at_deployed_threshold": float(deployed_flagged.mean()),
        "threshold_raw_score": threshold_raw,
        "score_p1": score_p1,
        "score_p50": score_p50,
        "threshold_calibration": calibration,
        "proxy_evaluation": {
            "method": (
                "Unsupervised model: no hazard labels exist. Discrimination is checked on the real "
                "validation slice at a 1% reference threshold: do anomaly flags concentrate in the "
                "top 5% of rapid pressure changes and rapid one-step wave-height changes?"
            ),
            "reference_threshold_raw": reference_threshold,
            "reference_threshold_note": (
                "Not the deployed threshold; the deployed threshold is scenario-calibrated below."
            ),
            "recall_top5pct_pressure_change": recall_pressure,
            "recall_top5pct_wave_height_change": recall_wave_change,
            "random_selection_baseline": random_rate,
            "wave_height_p95_m": p95_wave,
            "median_wave_height_flagged_m": (
                float(np.median(wave[deployed_flagged])) if deployed_flagged.any() else 0.0
            ),
            "median_wave_height_unflagged_m": (
                float(np.median(wave[~deployed_flagged])) if (~deployed_flagged).any() else 0.0
            ),
        },
        "feature_names": FEATURE_NAMES,
        "random_state": args.random_state,
        "n_estimators": args.n_estimators,
        "sklearn_version": sklearn.__version__,
        "pandas_version": pd.__version__,
        "numpy_version": np.__version__,
    }

    provenance_text = (
        PROVENANCE.read_text(encoding="utf-8") if PROVENANCE.exists() else "{}"
    )
    artifact = {
        "pipeline": pipeline,
        "feature_names": FEATURE_NAMES,
        "threshold_raw": threshold_raw,
        "cal_median": cal_median,
        "cal_scale": cal_scale,
        "calibration": calibration,
        "baseline": baseline,
        "metadata": {
            "model_name": "cews-anomaly-isolation-forest",
            "model_version": args.version,
            "algorithm": "sklearn.ensemble.IsolationForest",
            "trained_at": trained_at,
            "training_dataset": "NOAA NDBC historical stdmet (real observations, 2022-2024)",
            "dataset_provenance": json.loads(provenance_text),
            "purpose": "Prototype anomaly screening of coastal buoy telemetry; not a tsunami detector.",
            "intended_use": "Demonstration decision support for coastal monitoring operators.",
            "random_seed": args.random_state,
        },
        "metrics": metrics,
    }

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    artifact_path = ARTIFACT_DIR / f"{args.version}.joblib"
    metrics_path = ARTIFACT_DIR / f"{args.version}.metrics.json"
    joblib.dump(artifact, artifact_path)
    metrics_path.write_text(json.dumps(metrics, indent=2), encoding="utf-8")

    print(f"[ok] artifact: {artifact_path}")
    print(f"[ok] metrics : {metrics_path}")
    print(
        f"     rows train/val: {len(train_frame):,}/{len(test_frame):,} | "
        f"flagged(validation, deployed) {deployed_flagged.mean():.2%} | "
        f"proxy recall (pressure, 1% ref) {recall_pressure:.2%}"
    )
    print(
        f"     threshold calibrated on {calibration['windows']} normal-scenario windows: "
        f"target FPR {calibration['target_false_alarm_rate']:.0%}, "
        f"observed {calibration['observed_false_alarm_rate']:.2%}"
    )

    if not args.no_db:
        try:
            from app.db.session import SessionLocal
            from app.models.analytics import MLModel
            from app.services.status_service import TRAINING_SOURCE_NAME, get_or_create_source
            from sqlalchemy import select

            with SessionLocal() as db:
                row = db.scalar(select(MLModel).where(MLModel.model_version == args.version))
                if row is None:
                    row = MLModel(
                        model_name="cews-anomaly-isolation-forest",
                        model_version=args.version,
                        algorithm="IsolationForest",
                        model_uri=str(artifact_path),
                        feature_schema=[
                            {"name": name, "position": index} for index, name in enumerate(FEATURE_NAMES)
                        ],
                        training_dataset="NOAA NDBC stdmet, stations 51002 + 41010, 2022-2024",
                        training_period=(
                            f"{metrics['train_period'][0][:10]} to {metrics['train_period'][1][:10]}"
                        ),
                        metrics=metrics,
                        is_active=True,
                    )
                    db.add(row)
                else:
                    row.metrics = metrics
                    row.model_uri = str(artifact_path)
                    row.is_active = True
                source = get_or_create_source(
                    db,
                    source_name=TRAINING_SOURCE_NAME,
                    source_type="historical_dataset",
                    metadata={
                        "label": "NOAA NDBC historical stdmet (training data)",
                        "access": "Public historical archive, no authentication",
                        "note": "Real historical observations used for offline model training only.",
                    },
                )
                source.status = "archived"
                source.metadata_json = {
                    **(source.metadata_json or {}),
                    "rows": metrics["training_rows"] + metrics["validation_rows"],
                    "stations": ["51002", "41010"],
                    "years": "2022-2024",
                }
                db.commit()
            print("[ok] model registry updated")
        except Exception as exc:  # noqa: BLE001 - DB is optional for offline training
            print(f"[warn] database registry not updated: {type(exc).__name__}: {exc}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

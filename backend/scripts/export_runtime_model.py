"""Export the scikit-learn artifact into a dependency-light runtime artifact.

Usage:
    python backend/scripts/export_runtime_model.py
    python backend/scripts/export_runtime_model.py --version cews-iforest-v1

The runtime artifact (``*.runtime.npz`` + ``*.meta.json``) is what the API
loads in production, so ``scikit-learn`` and ``scipy`` are not needed there.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib
import numpy as np

BACKEND_ROOT = Path(__file__).resolve().parents[1]
ARTIFACT_DIR = BACKEND_ROOT / "ml" / "artifacts"


def export(version: str) -> tuple[Path, Path]:
    source = ARTIFACT_DIR / f"{version}.joblib"
    if not source.exists():
        raise SystemExit(f"Artifact not found: {source}")

    payload = joblib.load(source)
    pipeline = payload["pipeline"]
    imputer, scaler, forest = (step for _, step in pipeline.steps)

    left, right, feature, threshold, n_samples = [], [], [], [], []
    offsets = [0]
    for estimator in forest.estimators_:
        tree = estimator.tree_
        left.append(np.asarray(tree.children_left, dtype=np.int32))
        right.append(np.asarray(tree.children_right, dtype=np.int32))
        feature.append(np.asarray(tree.feature, dtype=np.int32))
        threshold.append(np.asarray(tree.threshold, dtype=np.float64))
        n_samples.append(np.asarray(tree.n_node_samples, dtype=np.int32))
        offsets.append(offsets[-1] + int(tree.node_count))

    npz_path = ARTIFACT_DIR / f"{version}.runtime.npz"
    np.savez_compressed(
        npz_path,
        left=np.concatenate(left),
        right=np.concatenate(right),
        feature=np.concatenate(feature),
        threshold=np.concatenate(threshold),
        n_samples=np.concatenate(n_samples),
        offsets=np.asarray(offsets, dtype=np.int64),
        imputer=np.asarray(imputer.statistics_, dtype=np.float64),
        scaler_mean=np.asarray(scaler.mean_, dtype=np.float64),
        scaler_scale=np.asarray(scaler.scale_, dtype=np.float64),
        max_samples=np.asarray([int(forest.max_samples_)], dtype=np.int64),
        offset=np.asarray([float(forest.offset_)], dtype=np.float64),
    )

    meta = {
        "format": "pantaupesisir-iforest-runtime/1",
        "feature_names": payload["feature_names"],
        "threshold_raw": float(payload["threshold_raw"]),
        "cal_median": float(payload.get("cal_median", 0.0)),
        "cal_scale": float(payload.get("cal_scale", 0.05)),
        "calibration": payload.get("calibration", {}),
        "baseline": payload.get("baseline", {}),
        "metadata": payload.get("metadata", {}),
        "metrics": payload.get("metrics", {}),
    }
    meta_path = ARTIFACT_DIR / f"{version}.runtime.meta.json"
    meta_path.write_text(json.dumps(meta, indent=2, default=str), encoding="utf-8")

    return npz_path, meta_path


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", default="cews-iforest-v1")
    args = parser.parse_args()
    npz_path, meta_path = export(args.version)
    print(f"runtime model: {npz_path} ({npz_path.stat().st_size / 1e6:.2f} MB)")
    print(f"runtime meta : {meta_path}")


if __name__ == "__main__":
    main()

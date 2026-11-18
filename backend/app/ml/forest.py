"""Dependency-light runtime for the trained Isolation Forest.

The model is still trained with scikit-learn (see ``scripts/train_model.py``).
At inference time we only need the fitted tree structure, the imputer
statistics and the scaler parameters, so the artifact is exported to a compact
``.npz`` and scored with numpy. This keeps the deployment bundle small enough
for serverless platforms while reproducing scikit-learn's
``Pipeline.score_samples`` exactly.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np

EULER_GAMMA = 0.5772156649015329


def _average_path_length(n: int) -> float:
    """scikit-learn's ``_average_path_length`` for a single sample count."""
    if n <= 1:
        return 0.0
    if n == 2:
        return 1.0
    return 2.0 * (np.log(n - 1.0) + EULER_GAMMA) - 2.0 * (n - 1.0) / n


@dataclass(frozen=True)
class ForestArrays:
    left: np.ndarray
    right: np.ndarray
    feature: np.ndarray
    threshold: np.ndarray
    n_samples: np.ndarray


class IsolationForestRuntime:
    """Numpy re-implementation of ``Pipeline(SimpleImputer, StandardScaler, IsolationForest)``."""

    def __init__(
        self,
        *,
        trees: list[ForestArrays],
        imputer: np.ndarray,
        scaler_mean: np.ndarray,
        scaler_scale: np.ndarray,
        max_samples: int,
        offset: float,
    ) -> None:
        self.trees = trees
        self.imputer = np.asarray(imputer, dtype=float)
        self.scaler_mean = np.asarray(scaler_mean, dtype=float)
        scale = np.asarray(scaler_scale, dtype=float)
        self.scaler_scale = np.where(scale == 0.0, 1.0, scale)
        self.max_samples = int(max_samples)
        self.offset = float(offset)
        self._max_leaf = max(int(tree.n_samples.max()) for tree in trees)
        self._apl = np.array(
            [_average_path_length(i) for i in range(self._max_leaf + 1)], dtype=float
        )
        self._normaliser = _average_path_length(self.max_samples)

    @property
    def n_estimators(self) -> int:
        return len(self.trees)

    def transform(self, matrix: np.ndarray) -> np.ndarray:
        values = np.array(matrix, dtype=float, copy=True)
        if np.isnan(values).any():
            missing = np.isnan(values)
            values[missing] = np.take(self.imputer, np.where(missing)[1])
        return (values - self.scaler_mean) / self.scaler_scale

    def score_samples(self, matrix: np.ndarray) -> np.ndarray:
        features = self.transform(matrix)
        if features.shape[0] == 0:
            return np.empty(0, dtype=float)
        depths = np.zeros(features.shape[0], dtype=float)
        for tree in self.trees:
            depths += self._path_lengths(features, tree)
        return -(2.0 ** (-(depths / self.n_estimators) / self._normaliser))

    def decision_function(self, matrix: np.ndarray) -> np.ndarray:
        return self.score_samples(matrix) - self.offset

    def _path_lengths(self, features: np.ndarray, tree: ForestArrays) -> np.ndarray:
        n_rows = features.shape[0]
        depths = np.zeros(n_rows, dtype=float)
        out = np.zeros(n_rows, dtype=float)
        stack: list[tuple[int, np.ndarray]] = [(0, np.arange(n_rows))]
        while stack:
            node, rows = stack.pop()
            if rows.size == 0:
                continue
            left = int(tree.left[node])
            if left == -1:
                out[rows] = depths[rows] + self._apl[int(tree.n_samples[node])]
                continue
            column = int(tree.feature[node])
            go_left = features[rows, column] <= tree.threshold[node]
            left_rows = rows[go_left]
            right_rows = rows[~go_left]
            depths[left_rows] += 1.0
            depths[right_rows] += 1.0
            stack.append((left, left_rows))
            stack.append((int(tree.right[node]), right_rows))
        return out


def load_runtime_model(npz_path: Path, meta_path: Path) -> tuple[IsolationForestRuntime, dict]:
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    with np.load(npz_path) as payload:
        offsets = payload["offsets"]
        left = payload["left"]
        right = payload["right"]
        feature = payload["feature"]
        threshold = payload["threshold"]
        n_samples = payload["n_samples"]
        trees = []
        for index in range(len(offsets) - 1):
            start, stop = int(offsets[index]), int(offsets[index + 1])
            trees.append(
                ForestArrays(
                    left=left[start:stop],
                    right=right[start:stop],
                    feature=feature[start:stop],
                    threshold=threshold[start:stop],
                    n_samples=n_samples[start:stop],
                )
            )
        model = IsolationForestRuntime(
            trees=trees,
            imputer=payload["imputer"],
            scaler_mean=payload["scaler_mean"],
            scaler_scale=payload["scaler_scale"],
            max_samples=int(payload["max_samples"][0]),
            offset=float(payload["offset"][0]),
        )
    return model, meta

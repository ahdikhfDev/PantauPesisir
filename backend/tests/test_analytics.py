from __future__ import annotations

import numpy as np

from app.ml.forest import IsolationForestRuntime
from app.ml.inference import load_model

from tests.conftest import API
from tests.helpers import run_analysis, start_scenario


def test_runtime_model_is_used_and_matches_reference_scores():
    bundle = load_model()
    assert isinstance(bundle.pipeline, IsolationForestRuntime)

    matrix = np.array(
        [
            [1.2, 1008.5, 0.1, 0.05, 0.2, 0.0, -0.3, 0.2, 0.01, 0.1, 2.0],
            [4.8, 995.0, 1.4, 0.9, 1.1, 0.6, -2.4, -3.1, 0.42, -1.2, 14.0],
            [2.0, 1010.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
        ]
    )
    expected = np.array([-0.445722891066, -0.769029668144, -0.367285072341])
    assert np.allclose(bundle.pipeline.score_samples(matrix), expected, atol=1e-9)


def test_analysis_produces_explainable_output(client, auth):
    start_scenario(client, auth, zone_code="JKT-BAY", scenario="extreme", observations=14,
                   interval_seconds=300, seed=1234)
    prediction = run_analysis(client, auth, zone_code="JKT-BAY")

    assert prediction["model_version"] == "cews-iforest-v1"
    assert prediction["zone_code"] == "JKT-BAY"
    assert prediction["input_observation_count"] >= 3
    assert 0.0 <= prediction["anomaly_score"] <= 1.0
    assert prediction["risk_level"] in {"low", "moderate", "high"}
    assert prediction["risk_method"] == "rubrik_risiko_v1"
    assert prediction["contributing_factors"], "explainability requires factors"
    assert "baseline model" in " ".join(prediction["caveats"]).lower()
    assert prediction["is_simulated"] is True
    assert "JKT-BAY" in prediction["recommendation"]
    assert prediction["data_quality_summary"]["risk_method"] == "rubrik_risiko_v1"
    assert "satellite_alignment" in prediction["data_quality_summary"]


def test_extreme_scenario_escalates_risk_and_creates_alert(client, auth):
    start_scenario(client, auth, zone_code="JKT-BAY", scenario="extreme", observations=16,
                   interval_seconds=300, seed=777)
    prediction = run_analysis(client, auth, zone_code="JKT-BAY")
    assert prediction["risk_level"] in {"moderate", "high"}
    assert prediction["alert_id"], "moderate/high risk should open an alert"

    alerts = client.get(f"{API}/alerts", params={"zone_code": "JKT-BAY"}).json()
    assert alerts["total"] >= 1
    assert all(alert["source"] == "analytics" for alert in alerts["items"])
    assert "rubrik risiko" in alerts["items"][0]["description"].lower()


def test_latest_detail_and_history_endpoints(client, auth):
    latest = client.get(f"{API}/analytics/latest", params={"zone_code": "JKT-BAY"})
    assert latest.status_code == 200
    detail = client.get(f"{API}/analytics/{latest.json()['id']}")
    assert detail.status_code == 200
    assert detail.json()["id"] == latest.json()["id"]

    history = client.get(f"{API}/analytics/history", params={"zone_code": "JKT-BAY", "limit": 5})
    assert history.status_code == 200
    assert 1 <= len(history.json()) <= 5


def test_analysis_requires_api_key(client):
    response = client.post(
        f"{API}/analytics/run", json={"zone_code": "JKT-BAY", "window_minutes": 60}
    )
    assert response.status_code == 401


def test_model_info_documents_limitations(client):
    response = client.get(f"{API}/analytics/model-info")
    assert response.status_code == 200
    body = response.json()
    assert body["algorithm"] == "IsolationForest"
    assert body["metrics"]["training_rows"] > 10_000
    assert body["metrics"]["proxy_evaluation"]["method"]
    assert any("bukan" in limitation.lower() for limitation in body["limitations"])
    assert "NDBC" in body["training_dataset"]

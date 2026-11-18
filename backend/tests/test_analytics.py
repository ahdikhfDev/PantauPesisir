from __future__ import annotations

from tests.conftest import API
from tests.helpers import run_analysis, start_scenario


def test_analysis_produces_explainable_prototype_output(client, auth):
    start_scenario(client, auth, zone_code="JKT-BAY", scenario="extreme", observations=14,
                   interval_seconds=300, seed=1234)
    prediction = run_analysis(client, auth, zone_code="JKT-BAY")

    assert prediction["model_version"] == "cews-iforest-v1"
    assert prediction["zone_code"] == "JKT-BAY"
    assert prediction["input_observation_count"] >= 3
    assert 0.0 <= prediction["anomaly_score"] <= 1.0
    assert prediction["risk_level"] in {"low", "moderate", "high"}
    assert prediction["risk_method"] == "prototype_rubric_v1"
    assert prediction["contributing_factors"], "explainability requires factors"
    assert "bukan probabilitas" in " ".join(prediction["caveats"]).lower()
    assert prediction["is_simulated"] is True
    assert "prototipe" in prediction["recommendation"].lower()
    assert prediction["data_quality_summary"]["risk_method"] == "prototype_rubric_v1"
    assert "satellite_alignment" in prediction["data_quality_summary"]


def test_extreme_scenario_escalates_risk_and_creates_alert(client, auth):
    start_scenario(client, auth, zone_code="JKT-BAY", scenario="extreme", observations=16,
                   interval_seconds=300, seed=777)
    prediction = run_analysis(client, auth, zone_code="JKT-BAY")
    assert prediction["risk_level"] in {"moderate", "high"}
    assert prediction["alert_id"], "moderate/high risk should open a prototype alert"

    alerts = client.get(f"{API}/alerts", params={"zone_code": "JKT-BAY"}).json()
    assert alerts["total"] >= 1
    assert all(alert["source"] == "analytics" for alert in alerts["items"])
    assert "bukan peringatan resmi" in alerts["items"][0]["description"].lower()


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

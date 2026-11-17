from __future__ import annotations

from tests.conftest import API
from tests.helpers import run_analysis, start_scenario


def _open_alert(client, auth) -> dict:
    start_scenario(client, auth, zone_code="MKS-STR", scenario="extreme", observations=16,
                   interval_seconds=300, seed=2468)
    prediction = run_analysis(client, auth, zone_code="MKS-STR")
    assert prediction["alert_id"]
    alerts = client.get(f"{API}/alerts", params={"zone_code": "MKS-STR"}).json()
    assert alerts["items"]
    return alerts["items"][0]


def test_alert_acknowledge_and_resolve(client, auth):
    alert = _open_alert(client, auth)
    assert alert["status"] == "open"

    ack = client.patch(
        f"{API}/alerts/{alert['id']}",
        headers=auth,
        json={"status": "acknowledged", "actor": "operator.test", "note": "Reviewed dashboard."},
    )
    assert ack.status_code == 200, ack.text
    body = ack.json()
    assert body["status"] == "acknowledged"
    assert body["acknowledged_at"]
    assert body["acknowledged_by"] == "operator.test"
    assert "Operator note" in body["description"]

    resolved = client.patch(
        f"{API}/alerts/{alert['id']}", headers=auth, json={"status": "resolved"}
    )
    assert resolved.status_code == 200
    assert resolved.json()["status"] == "resolved"
    assert resolved.json()["resolved_at"]

    reopen = client.patch(
        f"{API}/alerts/{alert['id']}", headers=auth, json={"status": "open"}
    )
    assert reopen.status_code == 409


def test_alert_filters_and_counts(client):
    response = client.get(f"{API}/alerts", params={"severity": "high"})
    assert response.status_code == 200
    body = response.json()
    assert body["counts_by_status"], "counts are computed across the alert table"
    assert set(body["counts_by_status"]) <= {"open", "acknowledged", "resolved"}
    assert set(body["counts_by_severity"]) <= {"info", "moderate", "high"}


def test_alert_patch_requires_key(client):
    listed = client.get(f"{API}/alerts").json()
    if not listed["items"]:
        return
    response = client.patch(f"{API}/alerts/{listed['items'][0]['id']}", json={"status": "acknowledged"})
    assert response.status_code == 401

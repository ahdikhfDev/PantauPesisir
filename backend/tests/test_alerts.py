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


def test_alert_filters_and_counts(client):
    response = client.get(f"{API}/alerts", params={"severity": "high"})
    assert response.status_code == 200
    body = response.json()
    assert set(body["counts_by_status"]) <= {"open", "acknowledged", "resolved"}
    assert set(body["counts_by_severity"]) <= {"info", "moderate", "high"}


def test_alert_patch_is_not_available(client):
    listed = client.get(f"{API}/alerts").json()
    if not listed["items"]:
        return
    response = client.patch(
        f"{API}/alerts/{listed['items'][0]['id']}", json={"status": "resolved"}
    )
    assert response.status_code in {404, 405}


def test_alerts_expire_automatically(client, auth):
    alert = _open_alert(client, auth)

    import uuid
    from datetime import datetime, timedelta, timezone

    from app.db.session import SessionLocal
    from app.models.alert import Alert

    with SessionLocal() as db:
        row = db.get(Alert, uuid.UUID(alert["id"]))
        assert row is not None
        row.created_at = datetime.now(timezone.utc) - timedelta(hours=7)
        db.commit()

    open_list = client.get(f"{API}/alerts", params={"status": "open", "zone_code": "MKS-STR"}).json()
    assert all(item["id"] != alert["id"] for item in open_list["items"])

    resolved = client.get(
        f"{API}/alerts", params={"status": "resolved", "zone_code": "MKS-STR"}
    ).json()
    assert any(item["id"] == alert["id"] for item in resolved["items"])

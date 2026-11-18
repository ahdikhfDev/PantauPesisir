from __future__ import annotations

from tests.conftest import API


def test_health_reports_database_and_model(client):
    response = client.get(f"{API}/system/health")
    assert response.status_code == 200
    body = response.json()
    assert body["database"]["ok"] is True
    assert body["model"]["available"] is True
    assert body["counts"]["coastal_zones"] == 3
    assert body["counts"]["buoy_observations"] > 0
    assert body["status"] in {"ok", "degraded"}


def test_seeded_zones_have_documented_boundaries_and_buoys(client):
    response = client.get(f"{API}/coastal/zones")
    assert response.status_code == 200
    zones = response.json()
    assert len(zones) == 3
    codes = {zone["zone_code"] for zone in zones}
    assert {"JKT-BAY", "SMR-UTC", "MKS-STR"} <= codes
    for zone in zones:
        assert "zona pemantauan" in zone["boundary_note"].lower()
        assert zone["boundary"]["type"] in {"Polygon", "MultiPolygon"}
        assert len(zone["buoys"]) == 1
        assert zone["buoys"][0]["source_type"] == "simulated"


def test_latest_observations_are_labeled_simulated(client):
    response = client.get(f"{API}/buoy/latest")
    assert response.status_code == 200
    body = response.json()
    assert body["items"], "seed should create observations"
    for item in body["items"]:
        assert item["source_type"] == "simulated"
        assert item["validation_status"] == "valid"
        assert item["zone_code"]
        assert item["data_age_seconds"] >= 0


def test_history_filters_and_pagination(client):
    response = client.get(f"{API}/buoy/history", params={"zone_code": "JKT-BAY", "page_size": 5})
    assert response.status_code == 200
    body = response.json()
    assert body["total"] > 0
    assert len(body["items"]) <= 5
    assert all(item["zone_code"] == "JKT-BAY" for item in body["items"])
    assert body["has_next"] is True

    invalid = client.get(f"{API}/buoy/history", params={"validation_status": "bogus"})
    assert invalid.status_code == 422
    assert invalid.json()["error"] == "validation_error"


def test_history_can_be_sampled_for_charts(client):
    response = client.get(
        f"{API}/buoy/history",
        params={"zone_code": "JKT-BAY", "max_points": 5},
    )
    assert response.status_code == 200
    body = response.json()
    assert 2 <= len(body["items"]) <= 5
    assert body["total"] > len(body["items"])
    assert body["has_next"] is False
    assert body["items"] == sorted(body["items"], key=lambda item: item["observed_at"], reverse=True)

    too_small = client.get(f"{API}/buoy/history", params={"max_points": 1})
    assert too_small.status_code == 422


def test_data_sources_and_overview(client):
    sources = client.get(f"{API}/system/data-sources")
    assert sources.status_code == 200
    names = {item["source_name"] for item in sources.json()["items"]}
    assert "telemetry-buoy" in names
    assert "noaa-ndbc-training-archive" in names

    overview = client.get(f"{API}/system/overview")
    assert overview.status_code == 200
    body = overview.json()
    assert len(body["zones"]) == 3
    assert body["latest_observations"]
    assert "pantaupesisir" in body["provenance_notice"].lower()
    assert "status sumber" in body["provenance_notice"].lower()
    assert "stale" in body["data_freshness"]


def test_satellite_provider_description_is_accurate(client):
    response = client.get(f"{API}/satellite/provider")
    assert response.status_code == 200
    body = response.json()
    assert body["provider"] == "copernicus-stac"
    assert "konteks pesisir" in body["note"].lower()

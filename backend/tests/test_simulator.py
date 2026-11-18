from __future__ import annotations

from datetime import datetime, timezone

from app.services.simulator import generate_series

from tests.conftest import API, wait_for_simulation


def test_manual_scenario_generates_coherent_labeled_series(client, auth):
    response = client.post(
        f"{API}/simulator/scenarios",
        headers=auth,
        json={
            "zone_code": "JKT-BAY",
            "scenario": "warning",
            "mode": "manual",
            "interval_seconds": 300,
            "observations": 12,
            "random_seed": 4242,
        },
    )
    assert response.status_code == 202, response.text
    job = response.json()["job"]
    assert job["status"] in {"queued", "running", "completed"}
    assert "skenario replay" in response.json()["acceptance_note"].lower()

    final = wait_for_simulation(client, auth, job["id"])
    assert final["status"] == "completed", final
    assert final["observations_count"] >= 1

    history = client.get(
        f"{API}/buoy/history",
        params={"zone_code": "JKT-BAY", "page_size": 200},
    ).json()
    generated = [
        item
        for item in history["items"]
        if item["simulation_id"] == job["id"] and item["validation_status"] == "valid"
    ]
    assert len(generated) == final["observations_count"]
    assert all(item["source_type"] == "simulated" for item in generated)
    assert all(item["scenario"] == "warning" for item in generated)
    # Timestamps must be distinct (duplicate prevention).
    assert len({item["observed_at"] for item in generated}) == len(generated)


def test_generator_is_deterministic_and_physically_bounded():
    end_at = datetime(2026, 1, 1, tzinfo=timezone.utc)

    first = generate_series(
        zone_code="JKT-BAY", scenario="extreme", count=30, interval_seconds=300, seed=99, end_at=end_at
    )
    second = generate_series(
        zone_code="JKT-BAY", scenario="extreme", count=30, interval_seconds=300, seed=99, end_at=end_at
    )
    assert [(row["wave_height_m"], row["air_pressure_hpa"]) for row in first] == [
        (row["wave_height_m"], row["air_pressure_hpa"]) for row in second
    ]
    for row in first:
        assert 0.05 <= row["wave_height_m"] <= 19.5
        assert 1.2 <= row["wave_period_s"] <= 28.0
        assert 880 <= row["air_pressure_hpa"] <= 1080
        assert 0 <= row["wave_direction_deg"] <= 360
        assert -1 <= row["sea_temperature_c"] <= 38


def test_unknown_zone_is_rejected(client, auth):
    response = client.post(
        f"{API}/simulator/scenarios",
        headers=auth,
        json={"zone_code": "NOPE", "scenario": "normal"},
    )
    assert response.status_code == 404


def test_backfill_refreshes_all_zones_synchronously(client, auth):
    response = client.post(
        f"{API}/simulator/backfill",
        headers=auth,
        json={
            "zone_code": "ALL",
            "scenario": "normal",
            "observations": 6,
            "interval_seconds": 120,
            "random_seed": 2026,
        },
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert {item["zone_code"] for item in body["zones"]} == {"JKT-BAY", "SMR-UTC", "MKS-STR"}
    assert all(item["status"] == "completed" for item in body["zones"])

    latest = client.get(f"{API}/buoy/latest").json()
    assert len(latest["items"]) == 3
    assert latest["stale"] is False

    unauthenticated = client.post(f"{API}/simulator/backfill", json={"zone_code": "ALL"})
    assert unauthenticated.status_code == 401


def test_startup_freshness_skips_when_disabled_or_recent(monkeypatch):
    from app.services import freshness

    monkeypatch.setattr(freshness.settings, "refresh_on_start", False, raising=False)
    assert freshness.ensure_recent_telemetry()["skipped"] is True

    monkeypatch.setattr(freshness.settings, "refresh_on_start", True, raising=False)
    monkeypatch.setattr(freshness.settings, "refresh_after_seconds", 10**9, raising=False)
    result = freshness.ensure_recent_telemetry()
    assert result["skipped"] is True


def test_auto_mode_starts_and_stops(client, auth):
    started = client.post(
        f"{API}/simulator/scenarios",
        headers=auth,
        json={
            "zone_code": "SMR-UTC",
            "scenario": "normal",
            "mode": "auto",
            "interval_seconds": 30,
        },
    )
    assert started.status_code == 202, started.text
    assert started.json()["job"]["mode"] == "auto"

    status = client.get(f"{API}/simulator/status").json()
    assert status["running"] is True
    assert status["source_type"] == "simulated"

    stopped = client.post(f"{API}/simulator/stop", headers=auth)
    assert stopped.status_code == 200
    assert stopped.json()["running"] is False

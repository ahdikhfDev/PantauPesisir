from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from tests.conftest import API, wait_for_simulation

BUOY = "BUOY-001"


def _simulation_id(client, auth) -> str:
    response = client.post(
        f"{API}/simulator/scenarios",
        headers=auth,
        json={
            "zone_code": "JKT-BAY",
            "scenario": "normal",
            "interval_seconds": 60,
            "observations": 1,
            "random_seed": 7,
        },
    )
    assert response.status_code == 202, response.text
    job_id = response.json()["job"]["id"]
    wait_for_simulation(client, auth, job_id)
    return job_id


def _payload(simulation_id: str, *, seconds_ago: int = 1, **overrides):
    # Far enough in the past to avoid colliding with simulator bursts, still inside
    # the 30-day ingestion window.
    observed_at = (datetime.now(timezone.utc) - timedelta(hours=6, seconds=seconds_ago)).replace(
        microsecond=0
    )
    payload = {
        "simulation_id": simulation_id,
        "buoy_code": BUOY,
        "observed_at": observed_at.isoformat(),
        "latitude": -6.105,
        "longitude": 106.850,
        "parameters": {
            "wave_height_m": 1.2,
            "wave_period_s": 5.4,
            "wave_direction_deg": 180,
            "wind_speed_mps": 5.0,
            "wind_direction_deg": 210,
            "sea_temperature_c": 29.1,
            "air_pressure_hpa": 1008,
        },
        "source_type": "simulated",
        "scenario": "normal",
        "generator_version": "1.0.0",
    }
    payload.update(overrides)
    return payload


def test_ingestion_requires_api_key(client):
    response = client.post(f"{API}/ingestion/buoy", json=_payload("00000000-0000-0000-0000-000000000000"))
    assert response.status_code == 401
    assert response.json()["error"] == "unauthorized"


def test_valid_ingestion_and_idempotent_replay(client, auth):
    simulation_id = _simulation_id(client, auth)
    payload = _payload(simulation_id, seconds_ago=2)
    first = client.post(f"{API}/ingestion/buoy", headers=auth, json=payload)
    assert first.status_code == 201, first.text
    body = first.json()
    assert body["accepted"] is True
    assert body["validation_status"] == "valid"
    assert body["observation"]["source_type"] == "simulated"
    assert body["observation"]["scenario"] == "normal"

    replay = client.post(f"{API}/ingestion/buoy", headers=auth, json=payload)
    assert replay.status_code == 200
    assert replay.json()["duplicate"] is True
    assert replay.json()["accepted"] is False


def test_missing_parameter_is_rejected(client, auth):
    simulation_id = _simulation_id(client, auth)
    payload = _payload(simulation_id, seconds_ago=3)
    payload["parameters"].pop("air_pressure_hpa")
    response = client.post(f"{API}/ingestion/buoy", headers=auth, json=payload)
    assert response.status_code == 422
    body = response.json()
    assert body["error"] == "validation_error"
    assert any("air_pressure_hpa" in issue["location"] for issue in body["issues"])


def test_naive_timestamp_is_rejected(client, auth):
    simulation_id = _simulation_id(client, auth)
    payload = _payload(simulation_id, seconds_ago=4)
    payload["observed_at"] = "2026-11-18T03:00:00"
    response = client.post(f"{API}/ingestion/buoy", headers=auth, json=payload)
    assert response.status_code == 422
    body = response.json()
    assert any("timezone" in issue["message"].lower() for issue in body["issues"])


def test_out_of_range_coordinates_are_rejected(client, auth):
    simulation_id = _simulation_id(client, auth)
    payload = _payload(simulation_id, seconds_ago=5, latitude=120.0)
    response = client.post(f"{API}/ingestion/buoy", headers=auth, json=payload)
    assert response.status_code == 422


def test_implausible_value_is_quarantined_not_discarded(client, auth):
    simulation_id = _simulation_id(client, auth)
    payload = _payload(simulation_id, seconds_ago=6)
    payload["parameters"]["wave_height_m"] = 42.0
    response = client.post(f"{API}/ingestion/buoy", headers=auth, json=payload)
    assert response.status_code == 201
    body = response.json()
    assert body["accepted"] is False
    assert body["validation_status"] == "invalid"
    assert body["observation"] is not None, "invalid records stay stored for audit"
    codes = {error["code"] for error in body["errors"]}
    assert "out_of_range" in codes


def test_unknown_buoy_returns_404(client, auth):
    simulation_id = _simulation_id(client, auth)
    payload = _payload(simulation_id, seconds_ago=7, buoy_code="BUOY-999")
    response = client.post(f"{API}/ingestion/buoy", headers=auth, json=payload)
    assert response.status_code == 404


def test_provenance_mismatch_is_quarantined(client, auth):
    simulation_id = _simulation_id(client, auth)
    payload = _payload(simulation_id, seconds_ago=8, source_type="observed")
    response = client.post(f"{API}/ingestion/buoy", headers=auth, json=payload)
    assert response.status_code == 201
    body = response.json()
    assert body["validation_status"] == "invalid"
    assert any(error["code"] == "provenance_mismatch" for error in body["errors"])

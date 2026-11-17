"""Shared integration helpers for tests."""

from __future__ import annotations

from tests.conftest import API, wait_for_simulation


def start_scenario(client, auth, *, zone_code: str, scenario: str, observations: int = 12,
                   interval_seconds: int = 300, seed: int = 4242) -> str:
    response = client.post(
        f"{API}/simulator/scenarios",
        headers=auth,
        json={
            "zone_code": zone_code,
            "scenario": scenario,
            "mode": "manual",
            "interval_seconds": interval_seconds,
            "observations": observations,
            "random_seed": seed,
        },
    )
    assert response.status_code == 202, response.text
    job_id = response.json()["job"]["id"]
    wait_for_simulation(client, auth, job_id)
    return job_id


def run_analysis(client, auth, *, zone_code: str, window_minutes: int = 180) -> dict:
    response = client.post(
        f"{API}/analytics/run",
        headers=auth,
        json={"zone_code": zone_code, "window_minutes": window_minutes},
    )
    assert response.status_code == 200, response.text
    return response.json()["prediction"]

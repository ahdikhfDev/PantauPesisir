"""Test configuration: isolated SQLite database + seeded demo data."""

from __future__ import annotations

import os
import tempfile
from pathlib import Path

import pytest

TMP_DIR = Path(tempfile.mkdtemp(prefix="cews-tests-"))
os.environ.update(
    {
        "DATABASE_URL": f"sqlite:///{(TMP_DIR / 'test.db').as_posix()}",
        "ENVIRONMENT": "test",
        "DEMO_MODE": "true",
        "API_SECRET_KEY": "test-secret-key",
        "DEMO_API_KEY": "cews-demo-2026",
        "SIMULATOR_AUTOSTART": "false",
        "SEED_DEMO_OBSERVATIONS": "true",
        "SEED_BACKFILL_HOURS": "2",
        "SATELLITE_CACHE_DIR": str(TMP_DIR / "satellite"),
        "SATELLITE_TIMEOUT_SECONDS": "3",
        "ALERT_DEDUPE_MINUTES": "30",
    }
)

API = "/api/v1"


@pytest.fixture(scope="session")
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture(scope="session")
def auth() -> dict[str, str]:
    return {"X-API-Key": "test-secret-key"}


def wait_for_simulation(client, auth_headers, job_id: str, attempts: int = 25) -> dict:
    import time

    payload = {}
    for _ in range(attempts):
        response = client.get(f"{API}/simulator/jobs/{job_id}")
        assert response.status_code == 200, response.text
        payload = response.json()
        if payload["status"] in {"completed", "failed"}:
            return payload
        time.sleep(0.2)
    return payload

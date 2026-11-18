"""Keep telemetry recent on serverless deployments.

A serverless host has no long-running process, so the interval simulator cannot
keep writing in the background. On startup we check the newest stored reading
and, when it is older than the configured threshold, replay a coherent window of
telemetry so dashboards resume with fresh data.
"""

from __future__ import annotations

import logging
import random
from datetime import datetime, timezone

from sqlalchemy import func, select

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.observation import BuoyObservation, Simulation
from app.models.zone import CoastalZone
from app.services.simulator import GENERATOR_VERSION, run_manual_scenario

logger = logging.getLogger(__name__)


def ensure_recent_telemetry() -> dict:
    if not settings.refresh_on_start:
        return {"skipped": True, "reason": "disabled"}

    with SessionLocal() as db:
        newest = db.scalar(select(func.max(BuoyObservation.observed_at)))
        now = datetime.now(timezone.utc)
        age: float | None = None
        if newest is not None:
            reference = newest if newest.tzinfo else newest.replace(tzinfo=timezone.utc)
            age = (now - reference.astimezone(timezone.utc)).total_seconds()
        if age is not None and age < settings.refresh_after_seconds:
            return {"skipped": True, "age_seconds": round(age, 1)}

        zones = list(db.scalars(select(CoastalZone).order_by(CoastalZone.zone_code)))
        interval_seconds = 120
        count = max(1, min(120, int(settings.refresh_window_minutes * 60 / interval_seconds)))
        written = []
        for zone in zones:
            simulation = Simulation(
                scenario="normal",
                mode="manual",
                status="queued",
                random_seed=random.randint(0, 2**31 - 1),
                generator_version=GENERATOR_VERSION,
                zone_id=zone.id,
                interval_seconds=interval_seconds,
                notes="Penyegaran telemetri saat layanan dimulai",
            )
            db.add(simulation)
            db.commit()
            db.refresh(simulation)
            run_manual_scenario(simulation.id, count=count, interval_seconds=interval_seconds)
            written.append(zone.zone_code)

    logger.info("Refreshed telemetry for %s (previous age %ss)", written, age)
    return {"skipped": False, "zones": written, "previous_age_seconds": age}

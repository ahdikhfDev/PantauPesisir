"""Bootstrap the demo database: schema, seed, live satellite sync and first analyses.

Usage:
    python backend/scripts/bootstrap_demo.py [--no-satellite] [--no-analytics]

The satellite step performs a real unauthenticated STAC search against the
Copernicus Data Space Ecosystem and caches quicklook thumbnails. If the provider
is unreachable the script records the failure and keeps any cached records.
"""

from __future__ import annotations

import argparse
import sys
from datetime import date, timedelta
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import select  # noqa: E402

from app.db.seed import ensure_schema, seed_if_empty  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.models.zone import CoastalZone  # noqa: E402
from app.schemas.satellite import SatelliteSyncIn  # noqa: E402
from app.services.analytics import run_analysis  # noqa: E402
from app.services.satellite.service import create_job, run_job  # noqa: E402
from app.services.simulator import GENERATOR_VERSION, generate_series, run_manual_scenario  # noqa: E402
from app.models.observation import Simulation  # noqa: E402
from app.models.zone import BuoyDevice  # noqa: E402
from app.schemas.buoy import BuoyObservationIn  # noqa: E402
from app.services.ingestion import ingest_observation  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--no-satellite", action="store_true")
    parser.add_argument("--no-analytics", action="store_true")
    parser.add_argument("--scenario", default="normal", choices=["normal", "warning", "extreme"])
    args = parser.parse_args()

    ensure_schema()
    print("[seed]", seed_if_empty())

    if args.scenario != "normal":
        with SessionLocal() as db:
            zone = db.scalar(select(CoastalZone).where(CoastalZone.zone_code == "JKT-BAY"))
            buoy = db.scalar(select(BuoyDevice).where(BuoyDevice.zone_id == zone.id))
            simulation = Simulation(
                scenario=args.scenario,
                mode="manual",
                status="queued",
                random_seed=20261118,
                generator_version=GENERATOR_VERSION,
                zone_id=zone.id,
                interval_seconds=300,
                notes="Bootstrap scenario run.",
            )
            db.add(simulation)
            db.commit()
            run_manual_scenario(simulation.id, buoy_code=buoy.buoy_code, count=14, interval_seconds=300)
            print(f"[sim] {args.scenario} scenario for {zone.zone_code}")

    if not args.no_satellite:
        with SessionLocal() as db:
            zones = list(db.scalars(select(CoastalZone)))
            for zone in zones:
                payload = SatelliteSyncIn(
                    zone_code=zone.zone_code,
                    date_from=date.today() - timedelta(days=30),
                    date_to=date.today(),
                    max_products=3,
                )
                job = create_job(db, payload, zone)
                print(f"[sat] {zone.zone_code} job {job.id} -> querying Copernicus STAC ...")
                run_job(job.id)
                db.refresh(job)
                print(
                    f"      status={job.status} found={job.datasets_found} "
                    f"stored={job.datasets_stored} cache={job.used_cache} "
                    f"error={job.error_message}"
                )

    if not args.no_analytics:
        with SessionLocal() as db:
            zones = list(db.scalars(select(CoastalZone)))
            for zone in zones:
                try:
                    prediction, alert, _ = run_analysis(db, zone=zone, window_minutes=180)
                    print(
                        f"[ai] {zone.zone_code}: risk={prediction.risk_level} "
                        f"score={prediction.risk_score} anomaly={prediction.anomaly_score} "
                        f"alert={alert.severity if alert else 'none'}"
                    )
                except Exception as exc:  # noqa: BLE001 - bootstrap should report, not crash
                    print(f"[ai] {zone.zone_code}: skipped ({type(exc).__name__}: {exc})")

    print("[done] demo database ready")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

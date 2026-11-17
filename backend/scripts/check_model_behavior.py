"""Behaviour check for the anomaly model against the simulator scenarios.

This is an engineering sanity check, not a scientific validation:

    python backend/scripts/check_model_behavior.py

It scores deterministic simulator windows for the normal / warning / extreme
scenarios and prints anomaly severity and the transparent risk rubric so a
reviewer can confirm the pipeline escalates monotonically.
"""

from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from app.ml.inference import score_window  # noqa: E402
from app.ml.rubric import assess_risk  # noqa: E402
from app.services.simulator import generate_series  # noqa: E402


def main() -> int:
    now = datetime.now(timezone.utc).replace(microsecond=0, second=0)
    failures = 0
    for zone_code in ("JKT-BAY", "SMR-UTC", "MKS-STR"):
        print(f"\n{zone_code}")
        normal_severity = None
        for scenario in ("normal", "warning", "extreme"):
            series = generate_series(
                zone_code=zone_code,
                scenario=scenario,
                count=18,
                interval_seconds=300,
                seed=20261118,
                end_at=now,
            )
            records = [
                {**row, "buoy_code": zone_code, "observed_at": row["observed_at"]} for row in series
            ]
            score = score_window(records)
            risk = assess_risk(
                wave_height_m=score.latest["wave_height_m"],
                wind_speed_mps=score.latest["wind_speed_mps"],
                wave_period_s=score.latest["wave_period_s"],
                pressure_drop_hpa=score.pressure_drop_hpa,
                anomaly_score=score.anomaly_score,
            )
            print(
                f"  {scenario:8s} anomaly={score.anomaly_score:.3f} "
                f"(thr {score.anomaly_threshold:.3f}, flagged={score.anomaly_detected}) "
                f"risk={risk.score:5.1f} {risk.level:8s} "
                f"H={score.latest['wave_height_m']:.2f}m "
                f"W={score.latest['wind_speed_mps']:.1f}m/s "
                f"P={score.latest['air_pressure_hpa']:.1f}hPa"
            )
            if scenario == "normal":
                normal_severity = score.anomaly_score
            elif normal_severity is not None and scenario == "warning":
                if score.anomaly_score <= normal_severity:
                    failures += 1
                    print("    [warn] warning severity did not exceed normal")
        print(f"  worst normal-window severity: {normal_severity:.3f} (0.5 = anomaly flag line)")
    print("\nNote: this check verifies pipeline behaviour, not scientific accuracy.")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())

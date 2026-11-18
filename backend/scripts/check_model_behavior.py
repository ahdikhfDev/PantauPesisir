"""Behaviour check for the anomaly model against the simulator scenarios.

This is an engineering sanity check, not a scientific validation:

    python backend/scripts/check_model_behavior.py

It scores deterministic simulator windows for the normal / warning / extreme
scenarios and asserts the product contract around them:

* a calm window is not an anomaly and lands on "low" risk;
* a warning window escalates through the absolute rubric (a steady, severe sea
  is not a *behavioural* anomaly, so the detector is allowed to stay quiet);
* an extreme window is flagged and escalated.
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone
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
                if score.anomaly_detected:
                    failures += 1
                    print("    [fail] calm window was flagged as an anomaly")
                if risk.level != "low":
                    failures += 1
                    print(f"    [fail] calm window should stay low, got {risk.level}")
            elif scenario == "warning":
                if risk.level == "low":
                    failures += 1
                    print("    [fail] warning window did not escalate to moderate")
            else:
                if not score.anomaly_detected:
                    failures += 1
                    print("    [fail] extreme window was not flagged")
                if risk.level == "low":
                    failures += 1
                    print("    [fail] extreme window did not escalate")
    print("\nNote: this check verifies pipeline behaviour, not scientific accuracy.")
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())

"""Time synchronisation + data-quality summaries for buoy/satellite association."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime, timedelta
from statistics import median

from app.models.observation import BuoyObservation
from app.models.satellite import SatelliteDataset


def align_observations_with_satellites(
    observations: Sequence[BuoyObservation],
    datasets: Sequence[SatelliteDataset],
    window_minutes: int,
) -> dict:
    """Associate datasets with observations by acquisition/observation window.

    This is a temporal association policy: optical acquisition timestamps are
    instantaneous and buoy observations are point samples, so temporal proximity
    does not imply the satellite measured the same wave field. Unmatched datasets
    are preserved.
    """
    window = timedelta(minutes=window_minutes)
    matched: list[dict] = []
    unmatched: list[str] = []
    matched_observation_ids: set[str] = set()

    for dataset in datasets:
        acquired = _aware(dataset.acquired_at)
        candidates = [obs for obs in observations if abs(_aware(obs.observed_at) - acquired) <= window]
        if not candidates:
            unmatched.append(str(dataset.id))
            continue
        nearest = min(candidates, key=lambda obs: abs(_aware(obs.observed_at) - acquired))
        matched.append(
            {
                "dataset_id": str(dataset.id),
                "product_id": dataset.product_id,
                "acquired_at": acquired.isoformat(),
                "observation_id": str(nearest.id),
                "observed_at": _aware(nearest.observed_at).isoformat(),
                "delta_seconds": int(abs(_aware(nearest.observed_at) - acquired).total_seconds()),
            }
        )
        matched_observation_ids.add(str(nearest.id))

    return {
        "window_minutes": window_minutes,
        "matched_pairs": matched,
        "matched_satellite_dataset_ids": [entry["dataset_id"] for entry in matched],
        "unmatched_satellite_dataset_ids": unmatched,
        "matched_observation_ids": sorted(matched_observation_ids),
        "policy_note": (
            "Temporal association by zone and window. Satellite imagery provides coastal "
            "context alongside buoy readings."
        ),
    }


def data_quality_summary(observations: Sequence[BuoyObservation]) -> dict:
    if not observations:
        return {
            "observation_count": 0,
            "note": "No observations in the requested window.",
            "usable": False,
        }

    ordered = sorted(observations, key=lambda obs: _aware(obs.observed_at))
    times = [_aware(obs.observed_at) for obs in ordered]
    gaps = [(b - a).total_seconds() for a, b in zip(times, times[1:])]
    median_gap = median(gaps) if gaps else None
    large_gaps = sum(1 for gap in gaps if median_gap and gap > median_gap * 2.5)

    parameter_keys = [
        "wave_height_m",
        "wave_period_s",
        "wave_direction_deg",
        "wind_speed_mps",
        "wind_direction_deg",
        "sea_temperature_c",
        "air_pressure_hpa",
    ]
    completeness = {
        key: sum(1 for obs in ordered if getattr(obs, key) is not None) / len(ordered) for key in parameter_keys
    }

    return {
        "observation_count": len(ordered),
        "window_start": times[0].isoformat(),
        "window_end": times[-1].isoformat(),
        "median_sampling_seconds": median_gap,
        "gaps_over_2_5x_median": large_gaps,
        "completeness": completeness,
        "invalid_records_excluded": sum(1 for obs in ordered if obs.validation_status != "valid"),
        "simulated_share": sum(1 for obs in ordered if obs.source_type == "simulated") / len(ordered),
        "usable": len(ordered) >= 3,
    }


def _aware(value: datetime) -> datetime:
    from datetime import timezone

    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)

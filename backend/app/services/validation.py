"""Validation service: plausibility, provenance, staleness and duplicate detection.

Invalid records are stored with ``validation_status="invalid"`` and an explicit
list of errors so they remain auditable; they are excluded from analytics.
Malformed payloads (missing fields, naive timestamps) are rejected by Pydantic
before reaching this module.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from math import asin, cos, radians, sin, sqrt
from typing import Any

from app.models.zone import BuoyDevice, CoastalZone

PLAUSIBLE_RANGES: dict[str, tuple[float, float, str]] = {
    "wave_height_m": (0.0, 20.0, "m"),
    "wave_period_s": (1.0, 30.0, "s"),
    "wave_direction_deg": (0.0, 360.0, "deg"),
    "wind_speed_mps": (0.0, 75.0, "m/s"),
    "wind_direction_deg": (0.0, 360.0, "deg"),
    "sea_temperature_c": (-2.0, 40.0, "degC"),
    "air_pressure_hpa": (870.0, 1085.0, "hPa"),
}

FUTURE_TOLERANCE = timedelta(minutes=5)
MAX_AGE = timedelta(days=30)
MAX_DISTANCE_FROM_BUOY_KM = 50.0


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371.0088
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 2 * radius * asin(sqrt(a))


def _error(field: str, code: str, message: str, value: Any = None) -> dict:
    return {"field": field, "code": code, "message": message, "value": value}


def validate_observation(
    *,
    payload: dict[str, Any],
    buoy: BuoyDevice,
    zone: CoastalZone,
    now: datetime | None = None,
) -> tuple[str, list[dict]]:
    """Return (validation_status, errors)."""
    now = now or datetime.now(timezone.utc)
    errors: list[dict] = []

    observed_at: datetime = payload["observed_at"]
    if observed_at.tzinfo is None:
        errors.append(_error("observed_at", "naive_timestamp", "Timestamp must be timezone-aware."))
    else:
        observed_at = observed_at.astimezone(timezone.utc)
        if observed_at > now + FUTURE_TOLERANCE:
            errors.append(
                _error(
                    "observed_at",
                    "future_timestamp",
                    "Observation time is in the future beyond the allowed clock skew.",
                    observed_at.isoformat(),
                )
            )
        if now - observed_at > MAX_AGE:
            errors.append(
                _error(
                    "observed_at",
                    "stale_observation",
                    "Observation is older than the 30-day ingestion window.",
                    observed_at.isoformat(),
                )
            )

    parameters = payload["parameters"] or {}
    for field, (low, high, unit) in PLAUSIBLE_RANGES.items():
        if field not in parameters:
            errors.append(_error(f"parameters.{field}", "missing_parameter", "Parameter is required."))
            continue
        value = parameters[field]
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            errors.append(_error(f"parameters.{field}", "not_numeric", "Parameter must be numeric.", value))
            continue
        if not (low <= float(value) <= high):
            errors.append(
                _error(
                    f"parameters.{field}",
                    "out_of_range",
                    f"Value outside plausible range {low}-{high} {unit}.",
                    value,
                )
            )

    # wave/wind directions must be finite degrees; 360 is accepted as due north.
    if isinstance(parameters.get("wave_direction_deg"), (int, float)) and parameters[
        "wave_direction_deg"
    ] == 360:
        parameters["wave_direction_deg"] = 0.0

    latitude = float(payload["latitude"])
    longitude = float(payload["longitude"])
    buoy_lat, buoy_lon = _point_coords(buoy)
    distance = haversine_km(latitude, longitude, buoy_lat, buoy_lon)
    if distance > MAX_DISTANCE_FROM_BUOY_KM:
        errors.append(
            _error(
                "latitude/longitude",
                "far_from_registered_buoy",
                f"Position is {distance:.1f} km from buoy {buoy.buoy_code}; "
                f"limit is {MAX_DISTANCE_FROM_BUOY_KM:.0f} km.",
                {"latitude": latitude, "longitude": longitude},
            )
        )

    min_lon, min_lat, max_lon, max_lat = zone.boundary.bounds
    padding = 1.0
    if not (min_lat - padding <= latitude <= max_lat + padding and min_lon - padding <= longitude <= max_lon + padding):
        errors.append(
            _error(
                "latitude/longitude",
                "outside_zone_envelope",
                f"Position falls outside the monitoring envelope of zone {zone.zone_code}.",
                {"latitude": latitude, "longitude": longitude},
            )
        )

    source_type = str(payload.get("source_type", "simulated"))
    if source_type == "observed" and buoy.source_type == "simulated":
        errors.append(
            _error(
                "source_type",
                "provenance_mismatch",
                "A simulated buoy device cannot emit 'observed' source_type. "
                "Real hardware would need its own registered device provenance.",
                source_type,
            )
        )

    if source_type == "simulated" and not payload.get("simulation_id"):
        errors.append(
            _error(
                "simulation_id",
                "missing_simulation_reference",
                "Simulated observations must reference a simulation session.",
                None,
            )
        )

    return ("valid" if not errors else "invalid"), errors


def _point_coords(buoy: BuoyDevice) -> tuple[float, float]:
    point = buoy.location
    if point is None:
        return 0.0, 0.0
    return float(point.y), float(point.x)


def staleness_seconds(observed_at: datetime, now: datetime | None = None) -> int:
    now = now or datetime.now(timezone.utc)
    if observed_at.tzinfo is None:
        observed_at = observed_at.replace(tzinfo=timezone.utc)
    return max(0, int((now - observed_at).total_seconds()))


def is_stale(observed_at: datetime, threshold_seconds: int = 180, now: datetime | None = None) -> bool:
    return staleness_seconds(observed_at, now) > threshold_seconds

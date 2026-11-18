"""Buoy telemetry simulator.

Generates *coherent* synthetic time series (not independent random draws):
each parameter relaxes toward a scenario target with AR(1) noise, wave period
is coupled to wave height, and pressure falls when a storm scenario ramps up.
Every value produced here is synthetic and must be labelled ``simulated``.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from math import exp, pi, sin, sqrt

import numpy as np
from sqlalchemy import delete, select

from app.core.config import settings
from app.db.session import SessionLocal
from app.models.observation import BuoyObservation, Simulation
from app.models.zone import BuoyDevice, CoastalZone

logger = logging.getLogger(__name__)

GENERATOR_VERSION = "1.0.0"
ANOMALY_MARKER = "injected_anomaly"


@dataclass(frozen=True)
class ScenarioProfile:
    wave_height_m: float
    wave_period_s: float
    wind_speed_mps: float
    sea_temperature_c: float
    air_pressure_hpa: float
    wave_direction_deg: float
    wind_direction_deg: float
    anomaly_probability: float


# Per-zone baseline for "normal" conditions (prototype climatology, not data).
ZONE_BASELINE: dict[str, tuple[float, float, float, float, float]] = {
    "JKT-BAY": (1.0, 5.0, 4.2, 29.2, 1009.5),
    "SMR-UTC": (1.5, 6.1, 5.6, 28.6, 1009.0),
    "MKS-STR": (1.9, 6.9, 6.5, 28.9, 1008.5),
}


def scenario_profile(scenario: str, zone_code: str) -> ScenarioProfile:
    wave, period, wind, sst, pressure = ZONE_BASELINE.get(zone_code, (1.4, 6.0, 5.5, 28.8, 1009.0))
    normal = ScenarioProfile(
        wave_height_m=wave,
        wave_period_s=period,
        wind_speed_mps=wind,
        sea_temperature_c=sst,
        air_pressure_hpa=pressure,
        wave_direction_deg=185.0,
        wind_direction_deg=205.0,
        anomaly_probability=0.004,
    )
    if scenario == "warning":
        return ScenarioProfile(
            wave_height_m=wave * 2.6,
            wave_period_s=period * 1.45,
            wind_speed_mps=wind * 2.4,
            sea_temperature_c=sst - 0.6,
            air_pressure_hpa=pressure - 6.0,
            wave_direction_deg=195.0,
            wind_direction_deg=220.0,
            anomaly_probability=0.05,
        )
    if scenario == "extreme":
        return ScenarioProfile(
            wave_height_m=wave * 5.2,
            wave_period_s=period * 1.85,
            wind_speed_mps=wind * 3.5,
            sea_temperature_c=sst - 1.3,
            air_pressure_hpa=pressure - 12.0,
            wave_direction_deg=205.0,
            wind_direction_deg=235.0,
            anomaly_probability=0.12,
        )
    return normal


class BuoyState:
    """Continuous state for one virtual buoy."""

    def __init__(self, seed: int, initial_profile: ScenarioProfile) -> None:
        self.rng = np.random.default_rng(seed)
        self.wave_height_m = initial_profile.wave_height_m
        self.wave_period_s = initial_profile.wave_period_s
        self.wave_direction_deg = initial_profile.wave_direction_deg
        self.wind_speed_mps = initial_profile.wind_speed_mps
        self.wind_direction_deg = initial_profile.wind_direction_deg
        self.sea_temperature_c = initial_profile.sea_temperature_c
        self.air_pressure_hpa = initial_profile.air_pressure_hpa
        self.steps = 0

    def step(
        self,
        profile: ScenarioProfile,
        minutes: float,
        at: datetime,
        force_anomaly: bool = False,
    ) -> dict:
        rng = self.rng
        tau_wave, tau_wind, tau_pressure, tau_sst = 25.0, 15.0, 55.0, 120.0
        theta_wave = 1 - exp(-minutes / tau_wave)
        theta_wind = 1 - exp(-minutes / tau_wind)
        theta_pressure = 1 - exp(-minutes / tau_pressure)
        theta_sst = 1 - exp(-minutes / tau_sst)
        noise_scale = sqrt(max(minutes, 0.1))

        self.wave_height_m += theta_wave * (profile.wave_height_m - self.wave_height_m)
        self.wave_height_m += rng.normal(0, 0.045 * noise_scale)
        self.wind_speed_mps += theta_wind * (profile.wind_speed_mps - self.wind_speed_mps)
        self.wind_speed_mps += rng.normal(0, 0.35 * noise_scale)
        self.air_pressure_hpa += theta_pressure * (profile.air_pressure_hpa - self.air_pressure_hpa)
        self.air_pressure_hpa += rng.normal(0, 0.15 * noise_scale)

        # Sea-surface temperature follows a weak diurnal cycle.
        diurnal = 0.22 * sin(2 * pi * ((at.hour + at.minute / 60) - 6) / 24)
        self.sea_temperature_c += theta_sst * (profile.sea_temperature_c + diurnal - self.sea_temperature_c)
        self.sea_temperature_c += rng.normal(0, 0.02 * noise_scale)

        self.wave_direction_deg += rng.normal(0, 1.8 * noise_scale) + 0.08 * (profile.wave_direction_deg - self.wave_direction_deg)
        self.wind_direction_deg += rng.normal(0, 3.0 * noise_scale) + 0.05 * (profile.wind_direction_deg - self.wind_direction_deg)

        # Wave period is physically coupled to wave height (fetch-limited waves).
        target_period = 0.55 * profile.wave_period_s + 1.15 * sqrt(max(self.wave_height_m, 0.05))
        self.wave_period_s += 0.35 * (target_period - self.wave_period_s) + rng.normal(0, 0.08 * noise_scale)

        anomaly = force_anomaly or (rng.random() < profile.anomaly_probability)
        if anomaly:
            self.wave_height_m *= float(rng.uniform(1.45, 2.1))
            self.wave_period_s += float(rng.uniform(0.8, 2.6))
            self.wind_speed_mps *= float(rng.uniform(1.2, 1.7))
            self.air_pressure_hpa -= float(rng.uniform(4.0, 9.0))
            self.wave_direction_deg += float(rng.uniform(-18, 18))

        self.steps += 1
        return self._snapshot(at, anomaly)

    def _snapshot(self, at: datetime, anomaly: bool) -> dict:
        wave = float(np.clip(self.wave_height_m, 0.05, 19.5))
        period = float(np.clip(self.wave_period_s, 1.2, 28.0))
        wind = float(np.clip(self.wind_speed_mps, 0.0, 70.0))
        pressure = float(np.clip(self.air_pressure_hpa, 880.0, 1080.0))
        sst = float(np.clip(self.sea_temperature_c, -1.0, 38.0))
        return {
            "observed_at": at,
            "wave_height_m": round(wave, 2),
            "wave_period_s": round(period, 1),
            "wave_direction_deg": round(float(self.wave_direction_deg % 360), 1),
            "wind_speed_mps": round(wind, 1),
            "wind_direction_deg": round(float(self.wind_direction_deg % 360), 1),
            "sea_temperature_c": round(sst, 2),
            "air_pressure_hpa": round(pressure, 1),
            "anomaly_injected": anomaly,
        }


def generate_series(
    *,
    zone_code: str,
    scenario: str,
    count: int,
    interval_seconds: int,
    seed: int,
    end_at: datetime,
    force_anomaly: bool = False,
) -> list[dict]:
    """Deterministic synthetic series ending at ``end_at`` (UTC)."""
    if end_at.tzinfo is None:
        end_at = end_at.replace(tzinfo=timezone.utc)
    count = max(1, count)
    profile = scenario_profile(scenario, zone_code)
    initial = scenario_profile("normal", zone_code)
    state = BuoyState(seed=seed, initial_profile=initial)
    minutes = max(interval_seconds / 60.0, 0.1)
    series: list[dict] = []
    start = end_at - timedelta(seconds=interval_seconds * (count - 1))
    for index in range(count):
        at = (start + timedelta(seconds=interval_seconds * index)).replace(microsecond=0)
        snapshot = state.step(profile, minutes, at, force_anomaly=force_anomaly and index == count - 1)
        snapshot["scenario"] = scenario
        series.append(snapshot)
    return series


def interpolation_start(
    *, zone_code: str, scenario: str, seed: int, at: datetime, minutes: float
) -> BuoyState:
    """Warm up a state so the first generated value is already coherent."""
    profile = scenario_profile(scenario, zone_code)
    state = BuoyState(seed=seed, initial_profile=scenario_profile("normal", zone_code))
    warmed = max(1, int(minutes // 5))
    for _ in range(warmed):
        state.step(profile, 5.0, at)
    return state


class AutoSimulator:
    """Background loop that posts simulated telemetry at a fixed interval."""

    def __init__(self) -> None:
        self._task: asyncio.Task | None = None
        self._states: dict[str, BuoyState] = {}
        self._seeds: dict[str, int] = {}
        self.scenario = "normal"
        self.interval_seconds = settings.simulator_default_interval_seconds
        self.zone_code = settings.simulator_zone_code
        self.simulation_id: uuid.UUID | None = None
        self.started_at: datetime | None = None
        self.last_tick_at: datetime | None = None
        self.generated = 0
        self.last_error: str | None = None

    @property
    def running(self) -> bool:
        return self._task is not None and not self._task.done()

    def status(self) -> dict:
        return {
            "running": self.running,
            "scenario": self.scenario,
            "interval_seconds": self.interval_seconds,
            "zone_code": self.zone_code,
            "simulation_id": str(self.simulation_id) if self.simulation_id else None,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "last_tick_at": self.last_tick_at.isoformat() if self.last_tick_at else None,
            "observations_generated": self.generated,
            "last_error": self.last_error,
            "generator_version": GENERATOR_VERSION,
            "source_type": "simulated",
        }

    async def start(
        self,
        *,
        scenario: str | None = None,
        interval_seconds: int | None = None,
        zone_code: str | None = None,
    ) -> dict:
        if self.running and scenario is None and interval_seconds is None:
            return self.status()
        await self.stop()
        self.scenario = scenario or self.scenario
        self.interval_seconds = int(interval_seconds or self.interval_seconds)
        self.zone_code = zone_code or self.zone_code
        seed = (datetime.now(timezone.utc).timestamp() // 1) % 2**31
        self._seeds = {}
        self._states = {}
        self.simulation_id, self._seeds, self._states = await asyncio.to_thread(
            self._create_session_and_states, int(seed)
        )
        self.started_at = datetime.now(timezone.utc)
        self.last_error = None
        try:
            await self.tick_now()
        except Exception as exc:  # noqa: BLE001 - first tick must not block startup
            self.last_error = f"{type(exc).__name__}: {exc}"
            logger.exception("initial automatic simulator tick failed")
        self._task = asyncio.create_task(self._loop())
        return self.status()

    async def stop(self) -> dict:
        task = self._task
        self._task = None
        if task is not None:
            task.cancel()
            try:
                await task
            except (asyncio.CancelledError, Exception):  # noqa: BLE001 - shutdown path
                pass
        if self.simulation_id:
            await asyncio.to_thread(self._close_session)
        self.simulation_id = None
        return self.status()

    def set_scenario(self, scenario: str) -> None:
        self.scenario = scenario

    async def tick_now(self) -> dict:
        """Generate one observation for every simulated buoy in the active zone."""
        return await asyncio.to_thread(self._tick_sync)

    async def _loop(self) -> None:  # pragma: no cover - exercised via lifespan/demo
        try:
            while True:
                await asyncio.sleep(self.interval_seconds)
                try:
                    await self.tick_now()
                except Exception as exc:  # noqa: BLE001 - keep the loop alive
                    self.last_error = f"{type(exc).__name__}: {exc}"
                    logger.exception("automatic simulator tick failed")
        except asyncio.CancelledError:
            raise

    # --- synchronous helpers (run in a worker thread) ---

    def _resolve_zones(self, db) -> list[CoastalZone]:
        if self.zone_code.upper() == "ALL":
            zones = list(db.scalars(select(CoastalZone).order_by(CoastalZone.zone_code)))
            if not zones:
                raise RuntimeError("No coastal zones are seeded")
            return zones
        zone = db.scalar(select(CoastalZone).where(CoastalZone.zone_code == self.zone_code))
        if zone is None:
            raise RuntimeError(f"Zone {self.zone_code} is not seeded")
        return [zone]

    def _create_session_and_states(self, seed: int) -> tuple[uuid.UUID, dict[str, int], dict[str, BuoyState]]:
        with SessionLocal() as db:
            zones = self._resolve_zones(db)
            simulation = Simulation(
                scenario=self.scenario,
                mode="auto",
                status="running",
                random_seed=seed,
                generator_version=GENERATOR_VERSION,
                zone_id=zones[0].id if len(zones) == 1 else None,
                interval_seconds=self.interval_seconds,
                started_at=datetime.now(timezone.utc),
                notes=(
                    "Umpan otomatis interval berkala"
                    + (" untuk seluruh zona terdaftar." if len(zones) > 1 else ".")
                ),
            )
            db.add(simulation)
            db.commit()
            seeds: dict[str, int] = {}
            states: dict[str, BuoyState] = {}
            now = datetime.now(timezone.utc)
            offset = 0
            for zone in zones:
                buoys = list(db.scalars(select(BuoyDevice).where(BuoyDevice.zone_id == zone.id)))
                for buoy in buoys:
                    key = f"{zone.zone_code}:{buoy.buoy_code}"
                    buoy_seed = seed + offset * 7919
                    seeds[key] = buoy_seed
                    states[key] = interpolation_start(
                        zone_code=zone.zone_code,
                        scenario=self.scenario,
                        seed=buoy_seed,
                        at=now,
                        minutes=60,
                    )
                    offset += 1
            return simulation.id, seeds, states

    def _close_session(self) -> None:
        with SessionLocal() as db:
            simulation = db.get(Simulation, self.simulation_id) if self.simulation_id else None
            if simulation is not None:
                simulation.status = "completed"
                simulation.ended_at = datetime.now(timezone.utc)
                db.commit()

    def _tick_sync(self) -> dict:
        from app.schemas.buoy import BuoyObservationIn
        from app.services.ingestion import ingest_observation

        now = datetime.now(timezone.utc).replace(microsecond=0)
        written = 0
        with SessionLocal() as db:
            zones = self._resolve_zones(db)
            simulation = db.get(Simulation, self.simulation_id) if self.simulation_id else None
            for zone in zones:
                profile = scenario_profile(self.scenario, zone.zone_code)
                buoys = list(db.scalars(select(BuoyDevice).where(BuoyDevice.zone_id == zone.id)))
                for buoy in buoys:
                    key = f"{zone.zone_code}:{buoy.buoy_code}"
                    state = self._states.get(key)
                    if state is None:
                        seed = self._seeds.get(key, 1)
                        state = interpolation_start(
                            zone_code=zone.zone_code,
                            scenario=self.scenario,
                            seed=seed,
                            at=now,
                            minutes=60,
                        )
                        self._states[key] = state
                    snapshot = state.step(profile, self.interval_seconds / 60.0, now)
                    payload = BuoyObservationIn(
                        simulation_id=simulation.id if simulation else None,
                        buoy_code=buoy.buoy_code,
                        observed_at=snapshot["observed_at"],
                        latitude=float(buoy.location.y),
                        longitude=float(buoy.location.x),
                        parameters={
                            key_name: snapshot[key_name]
                            for key_name in (
                                "wave_height_m",
                                "wave_period_s",
                                "wave_direction_deg",
                                "wind_speed_mps",
                                "wind_direction_deg",
                                "sea_temperature_c",
                                "air_pressure_hpa",
                            )
                        },
                        source_type="simulated",
                        scenario=self.scenario,
                        generator_version=GENERATOR_VERSION,
                    )
                    outcome = ingest_observation(db, payload)
                    if outcome.observation is not None and not outcome.duplicate:
                        written += 1
            if simulation is not None:
                simulation.observations_count += written
                simulation.scenario = self.scenario
                simulation.interval_seconds = self.interval_seconds
                db.commit()
        self.last_tick_at = now
        self.generated += written
        self.last_error = None
        return {"written": written, "observed_at": now.isoformat(), "scenario": self.scenario}


simulator = AutoSimulator()


def run_manual_scenario(
    simulation_id: uuid.UUID,
    *,
    buoy_code: str | None = None,
    count: int = 12,
    interval_seconds: int = 60,
) -> None:
    """Background worker for a manual scenario run (deterministic, persisted)."""
    from app.schemas.buoy import BuoyObservationIn
    from app.services.ingestion import ingest_observation

    with SessionLocal() as db:
        simulation = db.get(Simulation, simulation_id)
        if simulation is None:
            return
        zone = db.get(CoastalZone, simulation.zone_id) if simulation.zone_id else None
        if zone is None:
            simulation.status = "failed"
            simulation.notes = "Coastal zone missing for this simulation."
            db.commit()
            return

        simulation.status = "running"
        simulation.started_at = datetime.now(timezone.utc).replace(microsecond=0)
        db.commit()

        try:
            stmt = select(BuoyDevice).where(BuoyDevice.zone_id == zone.id)
            if buoy_code:
                stmt = stmt.where(BuoyDevice.buoy_code == buoy_code.upper())
            buoys = list(db.scalars(stmt))
            if not buoys:
                raise RuntimeError(f"No buoy devices found for zone {zone.zone_code}")

            end_at = datetime.now(timezone.utc).replace(microsecond=0)
            end_at = _choose_non_colliding_end(
                db,
                buoy_ids=[buoy.id for buoy in buoys],
                count=count,
                interval_seconds=interval_seconds,
                end_at=end_at,
            )
            written = 0
            replaced = 0
            for offset, buoy in enumerate(buoys):
                series = generate_series(
                    zone_code=zone.zone_code,
                    scenario=simulation.scenario,
                    count=count,
                    interval_seconds=interval_seconds,
                    seed=simulation.random_seed + offset * 101,
                    end_at=end_at,
                    force_anomaly=simulation.scenario == "extreme",
                )
                # A manual scenario is a coherent replay. Existing synthetic readings inside
                # its window are removed so the buoy timeline never mixes two storylines.
                # Only simulated rows are touched, and the removal count is recorded below.
                previous = db.execute(
                    delete(BuoyObservation).where(
                        BuoyObservation.buoy_id == buoy.id,
                        BuoyObservation.source_type == "simulated",
                        BuoyObservation.observed_at >= series[0]["observed_at"],
                        BuoyObservation.observed_at <= series[-1]["observed_at"],
                    )
                ).rowcount or 0
                replaced += previous
                for snapshot in series:
                    payload = BuoyObservationIn(
                        simulation_id=simulation.id,
                        buoy_code=buoy.buoy_code,
                        observed_at=snapshot["observed_at"],
                        latitude=float(buoy.location.y),
                        longitude=float(buoy.location.x),
                        parameters={
                            key: snapshot[key]
                            for key in (
                                "wave_height_m",
                                "wave_period_s",
                                "wave_direction_deg",
                                "wind_speed_mps",
                                "wind_direction_deg",
                                "sea_temperature_c",
                                "air_pressure_hpa",
                            )
                        },
                        source_type="simulated",
                        scenario=simulation.scenario,
                        generator_version=GENERATOR_VERSION,
                    )
                    outcome = ingest_observation(db, payload, commit=False)
                    if outcome.observation is not None and not outcome.duplicate:
                        written += 1
            simulation.observations_count = written
            simulation.status = "completed"
            simulation.notes = (simulation.notes or "") + (
                f" | menghasilkan {written} observasi pada {len(buoys)} buoy; "
                f"menggantikan {replaced} pembacaan sebelumnya di dalam jendela replay."
            )
        except Exception as exc:  # noqa: BLE001 - job status must reflect failure
            db.rollback()
            simulation = db.get(Simulation, simulation_id)
            if simulation is not None:
                simulation.status = "failed"
                simulation.notes = f"Scenario generation failed: {exc}"
            logger.exception("manual scenario generation failed")
        finally:
            simulation = db.get(Simulation, simulation_id)
            if simulation is not None:
                simulation.ended_at = datetime.now(timezone.utc)
                db.commit()


def _choose_non_colliding_end(
    db,
    *,
    buoy_ids: list[uuid.UUID],
    count: int,
    interval_seconds: int,
    end_at: datetime,
) -> datetime:
    """Shift a scenario burst by seconds when identical timestamps already exist.

    Duplicate prevention is per (buoy, observed_at). Replaying a scenario must not
    silently write nothing, so the burst is shifted until every planned timestamp
    is new while the sampling interval stays intact.
    """
    span = timedelta(seconds=interval_seconds * max(count - 1, 0))
    lower = end_at - span - timedelta(seconds=900)
    rows = db.scalars(
        select(BuoyObservation.observed_at).where(
            BuoyObservation.buoy_id.in_(buoy_ids),
            BuoyObservation.observed_at >= lower,
            BuoyObservation.observed_at <= end_at + timedelta(seconds=120),
        )
    )
    existing = {_naive_utc(value) for value in rows}
    candidate = _naive_utc(end_at)
    for _ in range(180):
        planned = {candidate - timedelta(seconds=interval_seconds * index) for index in range(count)}
        if not planned & existing:
            return candidate.replace(tzinfo=timezone.utc)
        candidate -= timedelta(seconds=1)
    return candidate.replace(tzinfo=timezone.utc)


def _naive_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(microsecond=0)
    return value.astimezone(timezone.utc).replace(tzinfo=None, microsecond=0)

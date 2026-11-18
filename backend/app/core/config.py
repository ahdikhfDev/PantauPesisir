"""Central configuration. All secrets come from environment variables only."""

from __future__ import annotations

from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[3]
BACKEND_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(REPO_ROOT / ".env"), ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- application ---
    app_name: str = "PantauPesisir - Konsol Pemantauan Pesisir"
    app_version: str = "0.1.0"
    environment: Literal["development", "demo", "production", "test"] = "development"
    api_v1_prefix: str = "/api/v1"
    demo_mode: bool = True
    log_level: str = "INFO"

    # --- security ---
    # Privileged endpoints require X-API-Key. Empty + demo_mode=False fails closed.
    api_secret_key: str = ""
    demo_api_key: str = "pantaupesisir-demo-2026"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    ingestion_rate_limit_per_minute: int = 240

    # --- database ---
    # Production: postgresql+psycopg://user:pass@host:5432/cews
    database_url: str = f"sqlite:///{(REPO_ROOT / 'data' / 'cews.db').as_posix()}"

    # --- buoy simulator ---
    simulator_default_interval_seconds: int = 60
    simulator_autostart: bool = False
    simulator_zone_code: str = "ALL"
    simulator_max_backfill_observations: int = 240

    # --- satellite provider (Copernicus Data Space Ecosystem STAC, no auth for search) ---
    satellite_provider: str = "copernicus-stac"
    satellite_api_base_url: str = "https://stac.dataspace.copernicus.eu/v1"
    satellite_collection: str = "sentinel-2-l2a"
    satellite_max_cloud_cover_percent: float = 40.0
    satellite_timeout_seconds: float = 25.0
    satellite_max_products_per_sync: int = 4
    satellite_cache_dir: str = str(REPO_ROOT / "data" / "satellite")
    satellite_client_id: str = ""
    satellite_client_secret: str = ""

    # --- analytics ---
    ml_model_version: str = "cews-iforest-v1"
    ml_matching_window_minutes: int = 30
    analytics_window_minutes: int = 60
    analytics_max_observations: int = 720
    alert_dedupe_minutes: int = 30

    # --- freshness ---
    # Deployment cadence for telemetry delivery; the UI marks data as stale after this window.
    freshness_window_seconds: int = 300

    # --- demo seed ---
    seed_demo_observations: bool = True
    seed_backfill_hours: int = 8

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def model_artifact_path(self) -> Path:
        return BACKEND_ROOT / "ml" / "artifacts" / f"{self.ml_model_version}.joblib"

    @field_validator("database_url")
    @classmethod
    def _normalise_sqlite_path(cls, value: str) -> str:
        # Allow DATABASE_URL=sqlite:///data/cews.db relative to the repository root.
        if value.startswith("sqlite:///") and not value.startswith("sqlite:////"):
            raw = value.removeprefix("sqlite:///")
            candidate = Path(raw)
            if not candidate.is_absolute():
                return f"sqlite:///{(REPO_ROOT / candidate).resolve().as_posix()}"
        return value


settings = Settings()

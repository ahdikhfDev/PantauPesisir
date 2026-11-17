"""Provider-agnostic satellite connector interfaces."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Any, Protocol


class SatelliteProviderError(RuntimeError):
    def __init__(self, message: str, *, kind: str = "provider_error") -> None:
        super().__init__(message)
        self.kind = kind


@dataclass
class SatelliteProduct:
    product_id: str
    provider: str
    collection: str
    acquired_at: datetime
    footprint: dict[str, Any]
    cloud_cover_percent: float | None = None
    resolution_m: float | None = None
    crs: str | None = None
    asset_uri: str | None = None
    thumbnail_url: str | None = None
    license: str | None = None
    attribution: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class ProviderStatus:
    provider: str
    name: str
    access: str
    dataset: str
    license: str
    note: str
    docs_url: str


class SatelliteProvider(Protocol):
    name: str

    def describe(self) -> ProviderStatus: ...

    def search(
        self,
        *,
        bounds: tuple[float, float, float, float],
        date_from: date,
        date_to: date,
        collection: str,
        max_cloud_cover_percent: float,
        limit: int,
    ) -> list[SatelliteProduct]: ...

    def fetch_thumbnail(self, url: str) -> bytes: ...

"""Copernicus Data Space Ecosystem STAC adapter.

Verified 2026-11-18:
  GET https://stac.dataspace.copernicus.eu/v1/search
  - no authentication required for catalogue search,
  - returns Sentinel-2 L2A items with footprint, acquisition datetime,
    cloud-cover statistics, GSD and quicklook thumbnail URLs,
  - product download (jp2 SAFE) requires an OIDC/S3 account, so CEWS stores
    metadata + a cached quicklook thumbnail instead of full raster scenes.

Documentation: https://documentation.dataspace.copernicus.eu/APIs/STAC.html

Sentinel-2 imagery is contextual: it does not measure wave height and must
never be presented as an ocean-wave observation.
"""

from __future__ import annotations

from datetime import date, datetime, timezone

import httpx

from app.services.satellite.base import SatelliteProduct, SatelliteProviderError, ProviderStatus

ATTRIBUTION = (
    "Contains modified Copernicus Sentinel data retrieved via the Copernicus Data Space "
    "Ecosystem. Sentinel data are provided free of charge under the Copernicus data policy."
)
LICENSE = "Copernicus Data Space Ecosystem terms / free and open Sentinel data access"


class CopernicusStacProvider:
    name = "copernicus-stac"

    def __init__(
        self,
        base_url: str,
        *,
        timeout: float = 25.0,
        client: httpx.Client | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._client = client

    def describe(self) -> ProviderStatus:
        return ProviderStatus(
            provider=self.name,
            name="Copernicus Data Space Ecosystem - Sentinel-2 L2A (STAC)",
            access="Open STAC catalogue search; no API key needed for metadata and quicklooks.",
            dataset="Sentinel-2 Level-2A optical imagery metadata and quicklook thumbnails",
            license=LICENSE,
            note=(
                "Optical imagery gives coastal context (land/water, turbidity patterns) and is "
                "not a wave-height measurement. Full-resolution product download requires a "
                "free Copernicus account and is not performed by this prototype."
            ),
            docs_url="https://documentation.dataspace.copernicus.eu/APIs/STAC.html",
        )

    def _request(self, path: str, params: dict | None = None) -> httpx.Response:
        url = f"{self.base_url}{path}"
        try:
            if self._client is not None:
                response = self._client.get(url, params=params, timeout=self.timeout)
            else:
                with httpx.Client(timeout=self.timeout, follow_redirects=True) as client:
                    response = client.get(url, params=params)
        except httpx.TimeoutException as exc:
            raise SatelliteProviderError(f"Copernicus STAC timed out: {exc}", kind="timeout") from exc
        except httpx.HTTPError as exc:
            raise SatelliteProviderError(f"Copernicus STAC network error: {exc}", kind="network") from exc
        if response.status_code >= 400:
            raise SatelliteProviderError(
                f"Copernicus STAC responded {response.status_code}: {response.text[:300]}",
                kind="http",
            )
        return response

    def search(
        self,
        *,
        bounds: tuple[float, float, float, float],
        date_from: date,
        date_to: date,
        collection: str,
        max_cloud_cover_percent: float,
        limit: int,
    ) -> list[SatelliteProduct]:
        min_lon, min_lat, max_lon, max_lat = bounds
        params = {
            "collections": collection,
            "bbox": f"{min_lon:.4f},{min_lat:.4f},{max_lon:.4f},{max_lat:.4f}",
            "datetime": f"{date_from.isoformat()}T00:00:00Z/{date_to.isoformat()}T23:59:59Z",
            "limit": str(max(limit * 4, 10)),
        }
        response = self._request("/search", params=params)
        try:
            payload = response.json()
        except ValueError as exc:
            raise SatelliteProviderError("Copernicus STAC returned malformed JSON", kind="malformed") from exc
        if not isinstance(payload, dict) or not isinstance(payload.get("features"), list):
            raise SatelliteProviderError("Copernicus STAC response has no feature list", kind="malformed")
        features = payload["features"]

        products: list[SatelliteProduct] = []
        for feature in features:
            product = self._parse_feature(feature, collection)
            if product is None:
                continue
            if (
                product.cloud_cover_percent is not None
                and product.cloud_cover_percent > max_cloud_cover_percent
            ):
                continue
            products.append(product)

        products.sort(
            key=lambda item: (
                item.cloud_cover_percent if item.cloud_cover_percent is not None else 999.0,
                -item.acquired_at.timestamp(),
            )
        )
        return products[:limit]

    def _parse_feature(self, feature: dict, collection: str) -> SatelliteProduct | None:
        try:
            properties = feature["properties"]
            geometry = feature.get("geometry")
            if not geometry:
                return None
            acquired_raw = properties.get("datetime") or properties.get("start_datetime")
            if not acquired_raw:
                return None
            acquired_at = _parse_datetime(acquired_raw)
            assets = feature.get("assets", {}) or {}
            thumbnail = assets.get("thumbnail") or {}
            thumbnail_url = None
            if isinstance(thumbnail, dict):
                thumbnail_url = thumbnail.get("href") or (thumbnail.get("alternate", {}) or {}).get(
                    "https", {}
                ).get("href")
            crs = None
            for asset in assets.values():
                if isinstance(asset, dict) and asset.get("proj:code"):
                    crs = asset["proj:code"]
                    break
            product_asset = assets.get("Product") if isinstance(assets.get("Product"), dict) else None
            return SatelliteProduct(
                product_id=str(feature["id"]),
                provider=self.name,
                collection=str(feature.get("collection") or collection),
                acquired_at=acquired_at,
                footprint=geometry,
                cloud_cover_percent=_as_float(properties.get("eo:cloud_cover")),
                resolution_m=_as_float(properties.get("gsd")),
                crs=crs,
                asset_uri=product_asset.get("href") if product_asset else None,
                thumbnail_url=thumbnail_url,
                license=LICENSE,
                attribution=ATTRIBUTION,
                metadata={
                    "platform": properties.get("platform"),
                    "instrument": ", ".join(properties.get("instruments") or []) or None,
                    "processing_level": properties.get("processing:level"),
                    "processing_version": properties.get("processing:version"),
                    "product_type": properties.get("product:type"),
                    "orbit_state": properties.get("sat:orbit_state"),
                    "relative_orbit": properties.get("sat:relative_orbit"),
                    "grid_code": properties.get("grid:code"),
                    "retrieved_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
                    "provider_concepts": (
                        "Sentinel-2 optical imagery is contextual (shoreline, land/water, "
                        "turbidity). It does not provide continuous wave-height measurements."
                    ),
                    "cloud_statistics": properties.get("statistics"),
                    "collection_license": LICENSE,
                    "stac_endpoint": f"{self.base_url}/search",
                },
            )
        except (KeyError, TypeError, ValueError):
            return None

    def fetch_thumbnail(self, url: str) -> bytes:
        if not url.startswith("https://"):
            raise SatelliteProviderError("Thumbnail URL must use HTTPS", kind="malformed")
        try:
            if self._client is not None:
                response = self._client.get(url, timeout=self.timeout, follow_redirects=True)
            else:
                with httpx.Client(timeout=self.timeout, follow_redirects=True) as client:
                    response = client.get(url)
        except httpx.TimeoutException as exc:
            raise SatelliteProviderError(f"Thumbnail download timed out: {exc}", kind="timeout") from exc
        except httpx.HTTPError as exc:
            raise SatelliteProviderError(f"Thumbnail download failed: {exc}", kind="network") from exc
        if response.status_code >= 400:
            raise SatelliteProviderError(
                f"Thumbnail download responded {response.status_code}", kind="http"
            )
        content = response.content
        if len(content) > 5 * 1024 * 1024:
            raise SatelliteProviderError("Thumbnail exceeds 5 MB safety limit", kind="malformed")
        if not (content.startswith(b"\xff\xd8\xff") or content.startswith(b"\x89PNG\r\n\x1a\n")):
            raise SatelliteProviderError("Thumbnail is not a JPEG or PNG image", kind="malformed")
        return content


def _parse_datetime(value: str) -> datetime:
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _as_float(value) -> float | None:  # type: ignore[no-untyped-def]
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None

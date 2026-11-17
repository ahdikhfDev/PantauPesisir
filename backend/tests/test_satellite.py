from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import httpx
import pytest

from app.services.satellite.base import SatelliteProduct, SatelliteProviderError, ProviderStatus
from app.services.satellite.copernicus_stac import CopernicusStacProvider

from tests.conftest import API

JPEG = b"\xff\xd8\xff\xe0" + b"cews-quicklook" * 20


def _product(product_id: str, *, cloud: float, offset_hours: int = 24) -> SatelliteProduct:
    return SatelliteProduct(
        product_id=product_id,
        provider="copernicus-stac",
        collection="sentinel-2-l2a",
        acquired_at=datetime.now(timezone.utc) - timedelta(hours=offset_hours),
        footprint={
            "type": "Polygon",
            "coordinates": [[[106.7, -6.2], [107.0, -6.2], [107.0, -5.9], [106.7, -5.9], [106.7, -6.2]]],
        },
        cloud_cover_percent=cloud,
        resolution_m=10.0,
        crs="EPSG:32748",
        asset_uri="https://download.dataspace.copernicus.eu/odata/v1/Products(example)/$value",
        thumbnail_url="https://datahub.creodias.eu/odata/v1/Assets(example)/$value",
        license="Copernicus Data Space Ecosystem terms",
        attribution="Contains modified Copernicus Sentinel data.",
        metadata={"platform": "sentinel-2a", "provider_concepts": "contextual optical imagery"},
    )


class FakeProvider:
    name = "copernicus-stac"

    def __init__(self, fail: bool = False) -> None:
        self.fail = fail

    def describe(self) -> ProviderStatus:
        return ProviderStatus(
            provider=self.name,
            name="Fake Sentinel-2 provider (tests)",
            access="test double",
            dataset="sentinel-2-l2a metadata",
            license="test",
            note="Optical imagery is not a wave-height measurement.",
            docs_url="https://example.test/docs",
        )

    def search(self, **_kwargs):
        if self.fail:
            raise SatelliteProviderError("simulated provider timeout", kind="timeout")
        return [_product("S2A_TEST_A", cloud=5.0), _product("S2A_TEST_B", cloud=22.0, offset_hours=48)]

    def fetch_thumbnail(self, _url: str) -> bytes:
        if self.fail:
            raise SatelliteProviderError("simulated thumbnail failure", kind="timeout")
        return JPEG


def test_sync_stores_metadata_quicklook_and_attribution(client, auth, monkeypatch):
    from app.services.satellite import service

    monkeypatch.setattr(service, "build_provider", lambda name=None: FakeProvider())
    response = client.post(
        f"{API}/satellite/sync",
        headers=auth,
        json={
            "provider": "copernicus-stac",
            "zone_code": "SMR-UTC",
            "date_from": (date.today() - timedelta(days=10)).isoformat(),
            "date_to": date.today().isoformat(),
            "collection": "sentinel-2-l2a",
            "max_cloud_cover_percent": 40,
            "max_products": 4,
        },
    )
    assert response.status_code == 202, response.text
    job_id = response.json()["job"]["id"]

    job = client.get(f"{API}/satellite/jobs/{job_id}").json()
    assert job["status"] == "completed", job
    assert job["datasets_found"] == 2
    assert job["datasets_stored"] == 2
    assert job["used_cache"] is False

    datasets = client.get(f"{API}/satellite/datasets", params={"zone_code": "SMR-UTC"}).json()
    assert len(datasets) == 2
    first = next(item for item in datasets if item["product_id"] == "S2A_TEST_A")
    assert first["cloud_cover_percent"] == 5.0
    assert first["crs"] == "EPSG:32748"
    assert first["processing_status"] == "thumbnail_cached"
    assert first["thumbnail_url"].endswith("/thumbnail")
    assert "Copernicus" in (first["attribution"] or "")
    assert first["footprint"]["type"] == "Polygon"
    assert first["metadata"]["platform"] == "sentinel-2a"

    thumb = client.get(f"{API}{first['thumbnail_url']}")
    assert thumb.status_code == 200
    assert thumb.content.startswith(b"\xff\xd8\xff")


def test_sync_degrades_to_cached_metadata_when_provider_fails(client, auth, monkeypatch):
    from app.services.satellite import service

    monkeypatch.setattr(service, "build_provider", lambda name=None: FakeProvider(fail=True))
    response = client.post(
        f"{API}/satellite/sync",
        headers=auth,
        json={
            "zone_code": "SMR-UTC",
            "date_from": (date.today() - timedelta(days=10)).isoformat(),
            "date_to": date.today().isoformat(),
        },
    )
    assert response.status_code == 202
    job_id = response.json()["job"]["id"]
    job = client.get(f"{API}/satellite/jobs/{job_id}").json()

    assert job["status"] == "completed_with_fallback"
    assert job["used_cache"] is True
    assert "timeout" in (job["error_message"] or "")

    datasets = client.get(f"{API}/satellite/datasets", params={"zone_code": "SMR-UTC"}).json()
    assert len(datasets) == 2, "cached metadata must survive provider failure"

    provider_info = client.get(f"{API}/satellite/provider").json()
    assert provider_info["source_status"] in {"unavailable", "stale_cache"}


def _stac_feature(product_id: str, cloud: float, acquired: str) -> dict:
    return {
        "id": product_id,
        "collection": "sentinel-2-l2a",
        "type": "Feature",
        "geometry": {
            "type": "Polygon",
            "coordinates": [[[106.8, -6.4], [107.8, -6.4], [107.8, -5.4], [106.8, -5.4], [106.8, -6.4]]],
        },
        "properties": {
            "datetime": acquired,
            "eo:cloud_cover": cloud,
            "gsd": 10,
            "platform": "sentinel-2a",
            "instruments": ["msi"],
            "processing:level": "L2",
            "sat:orbit_state": "descending",
            "grid:code": "MGRS-48MYU",
        },
        "assets": {
            "thumbnail": {"href": "https://example.test/quicklook.jpg"},
            "B02_10m": {"href": "s3://eodata/example.jp2", "proj:code": "EPSG:32748"},
            "Product": {"href": "https://download.example.test/product.zip"},
        },
    }


def test_stac_adapter_parses_and_filters_by_cloud_cover():
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path.endswith("/search"):
            assert "collections=sentinel-2-l2a" in str(request.url)
            assert request.url.params.get("bbox")
            return httpx.Response(
                200,
                json={
                    "type": "FeatureCollection",
                    "features": [
                        _stac_feature("S2_CLOUDY", 88.0, "2026-11-10T03:01:41Z"),
                        _stac_feature("S2_CLEAR", 12.5, "2026-11-12T03:01:41Z"),
                        _stac_feature("S2_PARTIAL", 35.0, "2026-11-14T03:01:41Z"),
                    ],
                },
            )
        return httpx.Response(200, content=JPEG, headers={"content-type": "image/jpeg"})

    provider = CopernicusStacProvider(
        "https://example.test/v1", client=httpx.Client(transport=httpx.MockTransport(handler))
    )
    products = provider.search(
        bounds=(106.7, -6.4, 107.0, -6.0),
        date_from=date(2026, 11, 1),
        date_to=date(2026, 11, 18),
        collection="sentinel-2-l2a",
        max_cloud_cover_percent=40,
        limit=5,
    )
    assert [item.product_id for item in products] == ["S2_CLEAR", "S2_PARTIAL"]
    assert products[0].crs == "EPSG:32748"
    assert products[0].resolution_m == 10.0
    assert "not" in products[0].metadata["provider_concepts"].lower()
    assert provider.fetch_thumbnail(products[0].thumbnail_url or "") == JPEG


def test_stac_adapter_reports_timeout_and_malformed_payload():
    def timeout_handler(request: httpx.Request) -> httpx.Response:
        raise httpx.TimeoutException("boom", request=request)

    provider = CopernicusStacProvider(
        "https://example.test/v1", client=httpx.Client(transport=httpx.MockTransport(timeout_handler))
    )
    with pytest.raises(SatelliteProviderError) as excinfo:
        provider.search(
            bounds=(106.7, -6.4, 107.0, -6.0),
            date_from=date(2026, 11, 1),
            date_to=date(2026, 11, 18),
            collection="sentinel-2-l2a",
            max_cloud_cover_percent=40,
            limit=2,
        )
    assert excinfo.value.kind == "timeout"

    def malformed_handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"unexpected": "shape"})

    broken = CopernicusStacProvider(
        "https://example.test/v1", client=httpx.Client(transport=httpx.MockTransport(malformed_handler))
    )
    with pytest.raises(SatelliteProviderError) as excinfo:
        broken.search(
            bounds=(106.7, -6.4, 107.0, -6.0),
            date_from=date(2026, 11, 1),
            date_to=date(2026, 11, 18),
            collection="sentinel-2-l2a",
            max_cloud_cover_percent=40,
            limit=2,
        )
    assert excinfo.value.kind == "malformed"

# API contract

- Base path: `/api/v1`
- Content type: `application/json`
- Timestamps: UTC ISO 8601 (`2026-11-18T03:00:00Z`)
- Interactive docs: `GET /docs` (Swagger UI), `GET /redoc`, `GET /api/v1/openapi.json`
- Auth: `X-API-Key` header for privileged operations only
- Idempotency: `idempotency_key` in the payload or a derived `buoy:observed_at:version` key
- Rate limit: configurable sliding window on ingestion (default 240/min per client process);
  responses use `429` with `Retry-After`

## 1. Endpoint summary

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/ingestion/buoy` | key + rate limit | Ingest one buoy observation |
| POST | `/simulator/scenarios` | key | Start a manual burst or automatic feed |
| GET | `/simulator/jobs/{job_id}` | public | Simulation job status |
| GET | `/simulator/status` | public | Automatic simulator state |
| POST | `/simulator/tick` | key | Force one automatic tick |
| POST | `/simulator/stop` | key | Stop the automatic feed |
| GET | `/buoy/latest` | public | Latest valid observation per buoy |
| GET | `/buoy/history` | public | Paginated, filtered history |
| GET | `/buoy/{observation_id}` | public | Single stored observation |
| GET | `/coastal/zones` | public | Zones, boundaries, devices |
| GET | `/coastal/zones/{zone_code}` | public | Zone detail |
| POST | `/satellite/sync` | key | Queue metadata + quicklook acquisition |
| GET | `/satellite/jobs/{job_id}` | public | Satellite job status |
| GET | `/satellite/datasets` | public | Stored dataset metadata |
| GET | `/satellite/datasets/{id}` | public | Dataset detail |
| GET | `/satellite/datasets/{id}/thumbnail` | public | Cached quicklook image |
| GET | `/satellite/provider` | public | Provider description + cache summary |
| POST | `/analytics/run` | key | Screen a zone window |
| GET | `/analytics/latest` | public | Latest analysis |
| GET | `/analytics/history` | public | Recent analyses |
| GET | `/analytics/model-info` | public | Model card metrics |
| GET | `/analytics/{analysis_id}` | public | Analysis detail |
| GET | `/alerts` | public | Alert list with filters and counts |
| PATCH | `/alerts/{alert_id}` | key | Acknowledge / resolve / reopen |
| GET | `/system/health` | public | DB, model, simulator, provider health |
| GET | `/system/data-sources` | public | Source freshness table |
| GET | `/system/overview` | public | Aggregated dashboard payload |

## 2. Ingestion

`POST /ingestion/buoy`

```json
{
  "simulation_id": "3f1c2f1e-7b1a-4a9a-9f28-2a8f5f1c0b11",
  "buoy_code": "BUOY-001",
  "observed_at": "2026-11-18T03:00:00Z",
  "latitude": -6.105,
  "longitude": 106.85,
  "parameters": {
    "wave_height_m": 1.2,
    "wave_period_s": 5.4,
    "wave_direction_deg": 180,
    "wind_speed_mps": 5.0,
    "wind_direction_deg": 210,
    "sea_temperature_c": 29.1,
    "air_pressure_hpa": 1008
  },
  "source_type": "simulated",
  "scenario": "normal",
  "generator_version": "1.0.0"
}
```

Responses:

- `201` new row:
  ```json
  {
    "accepted": true,
    "duplicate": false,
    "validation_status": "valid",
    "observation": { "id": "…", "data_age_seconds": 4, "source_type": "simulated", "…": "…" },
    "errors": []
  }
  ```
- `200` idempotent replay: `{ "accepted": false, "duplicate": true, "validation_status": "valid", "observation": {...} }`
- `201` implausible row (kept for audit): `{ "accepted": false, "validation_status": "invalid", "errors": [{ "field": "parameters.wave_height_m", "code": "out_of_range", "message": "…" }] }`
- `404` unknown buoy · `401` missing/invalid key · `422` malformed payload · `429` rate limited

Validation rules:

| Rule | Behaviour |
| --- | --- |
| Required fields present | 422 from Pydantic |
| Timezone-aware timestamp | 422 from Pydantic |
| Future > 5 min / older than 30 days | Row stored `invalid` |
| Wave height 0–20 m, period 1–30 s, wind 0–75 m/s, SST −2–40 °C, pressure 870–1085 hPa | Row stored `invalid` |
| Direction 0–360° | Row stored `invalid`; 360 normalised to 0 |
| Position ≤ 50 km from buoy and inside zone envelope (+1°) | Row stored `invalid` |
| `source_type=observed` on a simulated device | Row stored `invalid` (`provenance_mismatch`) |
| Simulated row without a simulation reference | Row stored `invalid` |
| Duplicate key or duplicate `(buoy, observed_at)` | `200`, no new row |

## 3. Simulator

`POST /simulator/scenarios` → `202`

```json
{
  "zone_code": "JKT-BAY",
  "buoy_code": "BUOY-001",
  "scenario": "extreme",
  "mode": "manual",
  "interval_seconds": 300,
  "observations": 16,
  "random_seed": 111
}
```

`"mode": "auto"` starts the interval loop instead (one reading per interval, all simulated buoys of
the configured scope). `GET /simulator/status` reports `running`, `scenario`, `interval_seconds`,
`zone_code`, `last_tick_at`, `observations_generated`, `last_error`.

Manual bursts are replay windows: earlier **synthetic** readings inside the window are replaced, and
the replaced count is recorded in the job notes. This keeps the buoy timeline coherent.

`GET /simulator/jobs/{job_id}`:

```json
{
  "id": "…",
  "scenario": "extreme",
  "mode": "manual",
  "status": "completed",
  "zone_code": "JKT-BAY",
  "random_seed": 111,
  "generator_version": "1.0.0",
  "interval_seconds": 300,
  "observations_count": 16,
  "started_at": "2026-11-18T03:10:02Z",
  "ended_at": "2026-11-18T03:10:03Z",
  "created_at": "2026-11-18T03:10:02Z",
  "notes": "… | generated 16 synthetic observation(s) across 1 buoy(s); replaced 41 earlier synthetic reading(s) inside the replay window."
}
```

## 4. Buoy reads

`GET /buoy/latest?zone_code=JKT-BAY` → latest valid row per device:

```json
{
  "items": [
    {
      "id": "…",
      "buoy_code": "BUOY-001",
      "zone_code": "JKT-BAY",
      "observed_at": "2026-11-18T03:11:00Z",
      "received_at": "2026-11-18T03:11:00Z",
      "processed_at": "2026-11-18T03:11:00Z",
      "parameters": { "wave_height_m": 1.06, "…": "…" },
      "latitude": -6.105,
      "longitude": 106.85,
      "source_type": "simulated",
      "scenario": "normal",
      "generator_version": "1.0.0",
      "validation_status": "valid",
      "validation_errors": null,
      "data_age_seconds": 12,
      "idempotency_key": "BUOY-001:2026-11-18T03:11:00+00:00:1.0.0"
    }
  ],
  "stale": false,
  "stale_after_seconds": 300
}
```

`GET /buoy/history` query parameters: `zone_code`, `buoy_code`, `observed_from`, `observed_to`,
`source_type`, `validation_status`, `page` (≥1), `page_size` (1–500, default 100). Response:
`{ items, page, page_size, total, has_next }`.

## 5. Satellite

`POST /satellite/sync` → `202`

```json
{
  "provider": "copernicus-stac",
  "zone_code": "JKT-BAY",
  "date_from": "2026-10-19",
  "date_to": "2026-11-18",
  "collection": "sentinel-2-l2a",
  "max_cloud_cover_percent": 40,
  "max_products": 4
}
```

Job status values: `queued`, `running`, `completed`, `completed_with_fallback`, `failed`.
`completed_with_fallback` means the provider failed but cached datasets exist (`used_cache: true`).

Dataset object (abridged):

```json
{
  "id": "…",
  "zone_id": "…",
  "provider": "copernicus-stac",
  "collection": "sentinel-2-l2a",
  "product_id": "S2B_MSIL2A_20261109T025929_N0513_R032_T48MXU_20261109T063717",
  "acquired_at": "2026-11-09T02:59:29Z",
  "downloaded_at": "2026-11-18T01:27:20Z",
  "footprint": { "type": "Polygon", "coordinates": [[[106.7, -6.2], "…"]] },
  "asset_uri": "https://download.dataspace.copernicus.eu/odata/v1/Products(…)/$value",
  "thumbnail_url": "/satellite/datasets/…/thumbnail",
  "cloud_cover_percent": 30.9,
  "resolution_m": 10.0,
  "crs": "EPSG:32748",
  "license": "Copernicus Data Space Ecosystem terms / free and open Sentinel data access",
  "attribution": "Contains modified Copernicus Sentinel data retrieved via the Copernicus Data Space Ecosystem. …",
  "processing_status": "thumbnail_cached",
  "metadata": { "platform": "sentinel-2b", "provider_concepts": "…" }
}
```

`thumbnail_url` is relative to the API base. Thumbnails are cached JPEG/PNG files served with
`Cache-Control: public, max-age=86400`.

## 6. Analytics

`POST /analytics/run`

```json
{ "zone_code": "JKT-BAY", "window_minutes": 60, "model_version": "cews-iforest-v1", "create_alert": true }
```

`200`:

```json
{
  "prediction": {
    "id": "…",
    "zone_code": "JKT-BAY",
    "model_version": "cews-iforest-v1",
    "observation_window_start": "2026-11-18T02:11:00Z",
    "observation_window_end": "2026-11-18T03:11:00Z",
    "windows_evaluated": 45,
    "input_observation_count": 45,
    "anomaly_detected": true,
    "anomaly_score": 0.987,
    "anomaly_threshold": 0.5,
    "risk_score": 94.9,
    "risk_level": "high",
    "risk_method": "prototype_rubric_v1",
    "contributing_factors": [
      {
        "feature": "pressure_rate_hpa_per_hour",
        "label": "Pressure change rate",
        "value": -12.4,
        "unit": "hPa/h",
        "baseline_mean": -0.0,
        "deviation_sigma": -23.8,
        "direction": "below"
      }
    ],
    "explanation": "Prototype analysis for …",
    "recommendation": "Prototype advisory, not an official warning. …",
    "caveats": ["An anomaly score is not a probability of disaster …"],
    "data_quality_summary": { "observation_count": 45, "median_sampling_seconds": 60, "risk_method": "prototype_rubric_v1", "satellite_alignment": { "matched_pairs": [] } },
    "is_simulated": true,
    "alert_id": "…"
  },
  "acceptance_note": "Prototype decision support only. …"
}
```

Errors: `404` unknown zone · `422` fewer than 3 valid observations · `503` model artifact missing.

## 7. Alerts

`GET /alerts?status=open&severity=high&zone_code=JKT-BAY&limit=50&offset=0`

```json
{
  "items": [
    {
      "id": "…",
      "prediction_id": "…",
      "zone_id": "…",
      "zone_code": "JKT-BAY",
      "zone_name": "Jakarta Bay",
      "severity": "high",
      "title": "High-risk coastal conditions — Jakarta Bay",
      "description": "Risk rubric level 'high' … This is a simulated-data prototype alert and is not an official warning. …",
      "status": "acknowledged",
      "source": "analytics",
      "created_at": "2026-11-18T03:12:04Z",
      "acknowledged_at": "2026-11-18T03:12:31Z",
      "acknowledged_by": "demo-operator",
      "resolved_at": null
    }
  ],
  "total": 1,
  "counts_by_status": { "acknowledged": 1 },
  "counts_by_severity": { "high": 1 }
}
```

`PATCH /alerts/{id}`

```json
{ "status": "acknowledged", "actor": "demo-operator", "note": "Reviewed on the console." }
```

Allowed transitions: `open → acknowledged`, `open → resolved`, `acknowledged → resolved`,
`acknowledged → open`. `resolved → open` returns `409`. Notes are appended to the alert description
with the actor label.

## 8. System

`GET /system/health`:

```json
{
  "status": "ok",
  "version": "0.1.0",
  "environment": "development",
  "demo_mode": true,
  "database": { "dialect": "sqlite", "ok": true },
  "model": { "available": true, "version": "cews-iforest-v1", "calibration": { "windows": 90, "target_false_alarm_rate": 0.1 }, "metrics": { "training_rows": 32883 } },
  "simulator": { "running": true, "zone_code": "ALL", "last_tick_at": "…" },
  "satellite_provider": { "provider": "copernicus-stac", "api_base_url": "https://stac.dataspace.copernicus.eu/v1" },
  "counts": { "coastal_zones": 3, "buoy_devices": 3, "buoy_observations": 291, "satellite_datasets": 7, "ai_predictions": 3, "alerts_open": 0 },
  "generated_at": "2026-11-18T03:12:00Z"
}
```

`GET /system/data-sources` returns `{ items: [...], generated_at }`; each item includes
`source_name`, `source_type`, `status`, `last_observed_at`, `last_received_at`, `last_success_at`,
`last_error`, `age_seconds`, `metadata`.

## 9. Error shape

```json
{ "error": "unprocessable_entity", "detail": "Request payload failed validation.", "issues": [{ "location": "body.observed_at", "message": "timestamp must include a timezone offset" }] }
```

| Status | `error` |
| --- | --- |
| 400 | `bad_request` |
| 401 | `unauthorized` |
| 403 | `forbidden` |
| 404 | `not_found` |
| 409 | `conflict` |
| 422 | `unprocessable_entity` / `validation_error` |
| 429 | `rate_limited` |
| 500 | `internal_server_error` |
| 503 | `service_unavailable` |

## 10. Curl examples

```bash
# Public read
curl "http://localhost:8000/api/v1/buoy/latest"

# Privileged analysis
curl -X POST "http://localhost:8000/api/v1/analytics/run" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: pantaupesisir-demo-2026" \
  -d '{"zone_code":"JKT-BAY","window_minutes":60}'

# Real Copernicus sync
curl -X POST "http://localhost:8000/api/v1/satellite/sync" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: pantaupesisir-demo-2026" \
  -d '{"zone_code":"JKT-BAY","date_from":"2026-10-19","date_to":"2026-11-18","max_cloud_cover_percent":40}'
```

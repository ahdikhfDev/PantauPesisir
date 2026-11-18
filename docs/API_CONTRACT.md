# Kontrak API

- Base path: `/api/v1`
- Tipe konten: `application/json`
- Timestamp: UTC ISO 8601 (`2026-11-18T03:00:00Z`)
- Dokumentasi interaktif: `GET /docs` (Swagger UI), `GET /redoc`, `GET /api/v1/openapi.json`
- Autentikasi: header `X-API-Key` hanya untuk operasi istimewa
- Idempotensi: `idempotency_key` di dalam payload atau kunci turunan `buoy:observed_at:version`
- Rate limit: sliding window yang dapat dikonfigurasi pada ingesti (default 240/menit per proses klien);
  response memakai `429` dengan `Retry-After`

## 1. Ringkasan endpoint

| Metode | Endpoint | Autentikasi | Tujuan |
| --- | --- | --- | --- |
| POST | `/ingestion/buoy` | kunci + rate limit | Ingesti satu observasi buoy |
| POST | `/simulator/scenarios` | kunci | Mulai burst manual atau feed otomatis |
| GET | `/simulator/jobs/{job_id}` | publik | Status job simulasi |
| GET | `/simulator/status` | publik | Status simulator otomatis |
| POST | `/simulator/tick` | kunci | Paksa satu tick otomatis |
| POST | `/simulator/stop` | kunci | Hentikan feed otomatis |
| GET | `/buoy/latest` | publik | Observasi valid terbaru per buoy |
| GET | `/buoy/history` | publik | Riwayat terpaginasi dengan filter |
| GET | `/buoy/{observation_id}` | publik | Satu observasi tersimpan |
| GET | `/coastal/zones` | publik | Zona, batas, perangkat |
| GET | `/coastal/zones/{zone_code}` | publik | Detail zona |
| POST | `/satellite/sync` | kunci | Antrekan metadata + pengambilan quicklook |
| GET | `/satellite/jobs/{job_id}` | publik | Status job satelit |
| GET | `/satellite/datasets` | publik | Metadata dataset tersimpan |
| GET | `/satellite/datasets/{id}` | publik | Detail dataset |
| GET | `/satellite/datasets/{id}/thumbnail` | publik | Gambar quicklook yang di-cache |
| GET | `/satellite/provider` | publik | Deskripsi penyedia + ringkasan cache |
| POST | `/analytics/run` | kunci | Skrining jendela zona |
| GET | `/analytics/latest` | publik | Analisis terbaru |
| GET | `/analytics/history` | publik | Analisis terkini |
| GET | `/analytics/model-info` | publik | Metrik model card |
| GET | `/analytics/{analysis_id}` | publik | Detail analisis |
| GET | `/alerts` | publik | Daftar peringatan dengan filter dan jumlah |
| PATCH | `/alerts/{alert_id}` | kunci | Akui / selesaikan / buka kembali |
| GET | `/system/health` | publik | Kesehatan DB, model, simulator, penyedia |
| GET | `/system/data-sources` | publik | Tabel kesegaran sumber |
| GET | `/system/overview` | publik | Payload dasbor teragregasi |

## 2. Ingesti

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

Response:

- `201` baris baru:
  ```json
  {
    "accepted": true,
    "duplicate": false,
    "validation_status": "valid",
    "observation": { "id": "…", "data_age_seconds": 4, "source_type": "simulated", "…": "…" },
    "errors": []
  }
  ```
- `200` replay idempoten: `{ "accepted": false, "duplicate": true, "validation_status": "valid", "observation": {...} }`
- `201` baris tidak masuk akal (disimpan untuk audit): `{ "accepted": false, "validation_status": "invalid", "errors": [{ "field": "parameters.wave_height_m", "code": "out_of_range", "message": "…" }] }`
- `404` buoy tidak dikenal · `401` kunci tidak ada/tidak valid · `422` payload tidak sesuai format · `429` terkena rate limit

Aturan validasi:

| Aturan | Perilaku |
| --- | --- |
| Field wajib tersedia | 422 dari Pydantic |
| Timestamp dengan zona waktu | 422 dari Pydantic |
| Masa depan > 5 menit / lebih lama dari 30 hari | Baris disimpan `invalid` |
| Tinggi gelombang 0–20 m, periode 1–30 s, angin 0–75 m/s, SST −2–40 °C, tekanan 870–1085 hPa | Baris disimpan `invalid` |
| Arah 0–360° | Baris disimpan `invalid`; 360 dinormalisasi menjadi 0 |
| Posisi ≤ 50 km dari buoy dan di dalam envelope zona (+1°) | Baris disimpan `invalid` |
| `source_type=observed` pada perangkat simulasi | Baris disimpan `invalid` (`provenance_mismatch`) |
| Baris simulasi tanpa referensi simulasi | Baris disimpan `invalid` |
| Kunci duplikat atau `(buoy, observed_at)` duplikat | `200`, tidak ada baris baru |

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

`"mode": "auto"` memulai loop interval (satu pembacaan per interval, semua buoy simulasi pada
cakupan terkonfigurasi). `GET /simulator/status` melaporkan `running`, `scenario`, `interval_seconds`,
`zone_code`, `last_tick_at`, `observations_generated`, `last_error`.

Burst manual adalah jendela replay: pembacaan **sintetis** sebelumnya di dalam jendela diganti, dan
jumlah yang diganti dicatat pada catatan job. Ini menjaga linimasa buoy tetap koheren.

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

## 4. Pembacaan buoy

`GET /buoy/latest?zone_code=JKT-BAY` → baris valid terbaru per perangkat:

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

Parameter query `GET /buoy/history`: `zone_code`, `buoy_code`, `observed_from`, `observed_to`,
`source_type`, `validation_status`, `page` (≥1), `page_size` (1–500, default 100). Response:
`{ items, page, page_size, total, has_next }`.

## 5. Satelit

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

Nilai status job: `queued`, `running`, `completed`, `completed_with_fallback`, `failed`.
`completed_with_fallback` berarti penyedia gagal tetapi dataset cache tersedia (`used_cache: true`).

Objek dataset (diringkas):

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

`thumbnail_url` bersifat relatif terhadap base API. Thumbnail adalah berkas JPEG/PNG yang di-cache dan
disajikan dengan `Cache-Control: public, max-age=86400`.

## 6. Analitik

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

Error: `404` zona tidak dikenal · `422` kurang dari 3 observasi valid · `503` artefak model tidak ditemukan.

## 7. Peringatan

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

Transisi yang diizinkan: `open → acknowledged`, `open → resolved`, `acknowledged → resolved`,
`acknowledged → open`. `resolved → open` mengembalikan `409`. Catatan ditambahkan ke deskripsi peringatan
dengan label aktor.

## 8. Sistem

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

`GET /system/data-sources` mengembalikan `{ items: [...], generated_at }`; setiap item mencakup
`source_name`, `source_type`, `status`, `last_observed_at`, `last_received_at`, `last_success_at`,
`last_error`, `age_seconds`, `metadata`.

## 9. Bentuk error

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

## 10. Contoh curl

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

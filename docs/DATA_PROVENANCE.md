# Data provenance in the interface

Rule: **every number must answer "where did this come from, and when?"** Anything synthetic is
labelled synthetic; anything derived is labelled derived; anything historical carries its
acquisition date.

## 1. Source types

| Badge | `source_type` / layer | Meaning | Never means |
| --- | --- | --- | --- |
| **Simulated** | `source_type="simulated"` on `buoy_observations` | Coherent synthetic reading from the PantauPesisir buoy simulator, linked to a `simulations` row | A real buoy measurement |
| **Satellite · historical** | `satellite_datasets` | Real Copernicus Sentinel-2 catalogue record retrieved from CDSE STAC, with acquisition time and quicklook | Live imagery, wave height, bathymetry |
| **Historical dataset** | training archive | Real NOAA NDBC rows used offline to fit the model | Input to a live prediction |
| **Model output** | `ai_predictions` | Isolation Forest score + rubric + generated explanation | An observation or a probability of disaster |

## 2. Element-by-element mapping

### Overview dashboard

| Element | Source | Notes |
| --- | --- | --- |
| Mean wave KPI | Latest valid `buoy_observations` per zone | Simulated; range shown |
| Sea-state chart | `/buoy/history` for the selected zone (or minute-mean across zones) | Simulated; UTC axis |
| Zone status wave/age/risk | Latest observation + latest analysis per zone | Simulated telemetry + model output |
| "Copernicus S2 — N acquisitions cached" | Database count + latest `acquired_at` | Historical satellite metadata |
| "Prototype risk" card | Latest `ai_predictions` row | Model output |
| Stat: zones | `coastal_zones` count | Seeded prototype polygons |
| Stat: parameters | Constant 7 | Matches the observation schema |
| Stat: telemetry rows | `buoy_observations` count | Includes valid/invalid stored rows |
| Stat: Sentinel-2 records | `satellite_datasets` count | Historical acquisitions |
| Stat: normal-window flag rate | Model calibration metadata | Synthetic normal windows |
| AI snapshot | `/system/overview.latest_prediction` + `/analytics/history` | Model output; labelled with the zone of the latest run |
| Alert queue | `/alerts?limit=6` | Prototype alerts with lifecycle state |
| Provenance cards | Static documentation of the three sources | Numbers read from health/metrics |

### Ocean page

| Element | Source | Notes |
| --- | --- | --- |
| Metric cards | Latest valid observation for the selected zone | Units exposed: m, s, °, m/s, hPa, °C |
| Sea-state chart | `/buoy/history` window | Valid rows only; invalid rows excluded and counted |
| Pressure/period chart | Same history payload | Same |
| Recent readings table | Same history payload | Shows validation status per row |
| Reading provenance panel | Selected observation fields | Observed/received/processed separately; simulation id; position |
| Freshness strip | `data_age_seconds` + `/buoy/latest.stale` | 300-second freshness window |
| Simulator panel | `/simulator/*` | Response acceptance note states readings are synthetic |
| Median sampling gap | Computed from stored UTC timestamps | Not assumed |

### Satellite page

| Element | Source | Notes |
| --- | --- | --- |
| Provider name, access, licence note | `/satellite/provider` + adapter description | Text states optical imagery is not wave height |
| Map zone polygons | `coastal_zones.boundary` | Prototype bounding polygons, not official |
| Map buoy markers | `buoy_devices.location` + latest simulated reading | Marker popup labels simulated |
| Map footprints | `satellite_datasets.footprint` | Real acquisition footprints |
| Base map | OpenStreetMap tiles | Attribution visible |
| Dataset cards | `/satellite/datasets` | Acquisition UTC, cloud cover, GSD, CRS, processing status |
| Quicklook image | `/satellite/datasets/{id}/thumbnail` | Cached provider quicklook; not a live image |
| Sync job result | `/satellite/jobs/{id}` | `found`, `stored`, `used_cache`, warnings, provider error |
| Attribution line | Stored per dataset | "Contains modified Copernicus Sentinel data…" |

### AI page

| Element | Source | Notes |
| --- | --- | --- |
| Model version, algorithm, training dataset | `/analytics/model-info` | NOAA NDBC stations 51002/41010, 2022–2024 |
| Training/validation rows, flag rates | Model artifact metrics | Real values from the trained run |
| Calibration windows | Artifact calibration metadata | 90 synthetic normal windows, 10% target |
| Anomaly index and threshold | `ai_predictions` + artifact | 0.5 = operating threshold; not a probability |
| Risk score/level | `ai_predictions` | `prototype_rubric_v1` |
| Contributing factors | Stored factor list | Standardised deviation from training baseline |
| Explanation/recommendation/caveats | Generated at analysis time and stored | Recommendation says it is not official |
| Satellites matched | Association policy result | Temporal proximity only; not validation |
| History cards | `ai_predictions` | Each card re-fetches its stored detail |

### Alerts page

| Element | Source | Notes |
| --- | --- | --- |
| Alert severity/title/description | `alerts` rows linked to a prediction | Description includes "not an official warning" |
| Created/acknowledged/resolved times | Database timestamps | UTC |
| Actor | `acknowledged_by` | `demo-operator` in the demo |
| Counts | SQL aggregates | Not derived from the visible page subset |

### Sources page

| Element | Source | Notes |
| --- | --- | --- |
| Health cards | `/system/health` | Database dialect, model availability, simulator loop, provider status |
| Counts strip | `/system/health.counts` | Live SQL counts |
| Freshness table | `data_source_status` | Last observed/received/success + age + last error |
| Validation gates | Code constants in `validation.py` | Documented ranges match implementation |
| Lineage panel | Model artifact + registry | Training period, stations, validation flag rate |
| API table | Router definitions | Auth column reflects `require_api_key` |

## 3. Time semantics

- All timestamps are UTC, ISO 8601.
- `observed_at` = when the (simulated) instrument reports the measurement.
- `received_at` = when the backend accepted the record.
- `processed_at` = when validation/persistence completed.
- Satellite `acquired_at` = provider acquisition time; `downloaded_at` = when the quicklook was
  cached; `processed_at` is reserved for future raster processing.
- UI age is computed from `observed_at`, never from `received_at`.

## 4. Association policy

`align_observations_with_satellites()` pairs a dataset with the nearest observation in the same zone
within a configurable window (default 30 minutes). Unmatched datasets are listed and preserved. The
pairing is described as a **prototype association**, not a scientific co-location, and it never
changes a buoy value or a satellite value.

## 5. Provenance invariants (tested)

1. A simulated row always carries `source_type="simulated"` and a `simulation_id`.
2. A simulated device cannot submit `source_type="observed"`; such rows are quarantined.
3. Invalid rows are stored with `validation_status="invalid"` and an error list.
4. Duplicate ingestion never creates a second row.
5. Satellite attribution and licence are stored with each dataset.
6. Provider failure never fabricates datasets; cached rows keep their original acquisition times.
7. The model artifact records dataset provenance, training period, feature names and calibration.

## 6. What the UI deliberately does not show

- No "live satellite" claim.
- No derived wave height from optical imagery.
- No probability of tsunami/disaster.
- No market price, income or demand predictions.
- No claim that synthetic telemetry is measured data.

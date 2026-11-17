# Data catalog

Research date: **2026-11-18**. Every "verified" claim below was checked by issuing an HTTP request
from this environment and inspecting the response. Items marked *not verified in this build* were
not integrated and must not be described as working.

## 1. Candidate comparison

Scores are this project's assessment from 1 (poor) to 5 (excellent), based on evidence gathered
during the build, not on provider marketing.

| Candidate | Type | Access | Licence | Spatial fit (Java/Indonesia) | Temporal fit | Resolution | API reliability | Score |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Copernicus CDSE STAC (Sentinel-2 L2A)** ✅ | Optical EO metadata + quicklooks | Open `GET /v1/search`, no auth for catalogue | Free/open Sentinel data; Copernicus Data Space Ecosystem terms | Global, tiles over Jakarta/Semarang/Makassar verified | 5-day revisit; 2026 items returned | 10/20/60 m | Stable in test; redirects on quicklooks handled | **31/35** |
| Sentinel Hub / Processing API | Optical EO, processed imagery | Requires account + paid/plan quota (*not verified*) | Provider-specific | Global | 5-day | 10 m+ | Only if a plan exists | 22/35 |
| Sentinel-1 SAR (same STAC catalogue) | Radar backscatter | Search open; product download needs OIDC (*not integrated*) | Free/open | Global | 6–12 days | 10 m+ | Available but interpretation is non-trivial | 20/35 |
| Copernicus DEM | Elevation | Documentation exists; not accessed here (*not verified*) | Copernicus DEM licence | Global | Static | 30/90 m | n/a for this build | 18/35 |
| Landsat Collection 2 | Optical EO | USGS access requires account/API (*not verified*) | Public domain (US) | Global | 16 days | 30 m | Not integrated | 17/35 |
| **NOAA NDBC historical stdmet** ✅ | Real buoy time series (training) | Open `.txt.gz` archive, no auth | U.S. federal work, public domain | Offshore Hawaii/Florida only — **no Indonesian buoys** | 10-minute cadence, 2022–2024 used | Point measurements | Stable; 41,104 valid rows | **30/35** |
| Copernicus Marine Service | Modelled/observed ocean physics | Registration + credentials (*not verified*) | Free with attribution | Global/regional, includes Indonesian seas | Daily/hourly model fields | ~9 km | Not integrated | 25/35 |
| BMKG public marine products | Official Indonesian forecasts | Public website; **no verified machine API used** | Government terms; usage not confirmed | Excellent (Indonesia) | Forecast cycles | Varies | Would need explicit permission/terms | 24/35 |
| NASA POWER | Meteorological/climate context | Open API (documented; *not verified here*) | Public | Global, coarse | Daily/hourly | ~0.5° | Candidate for context only | 20/35 |
| OpenStreetMap tiles | Base map | Open tile service | ODbL, attribution required | Global | Live | Vector/raster tiles | Used with attribution | 26/35 (context only) |

## 2. Selected primary sources

### 2.1 Copernicus Data Space Ecosystem — Sentinel-2 L2A STAC

- **Dataset title:** Sentinel-2 Level-2A (surface reflectance) catalogue items
- **Provider:** ESA / European Commission, served by Copernicus Data Space Ecosystem
- **Landing page:** <https://dataspace.copernicus.eu/>
- **API docs:** <https://documentation.dataspace.copernicus.eu/APIs/STAC.html>
- **Endpoint used:** `GET https://stac.dataspace.copernicus.eu/v1/search`
- **Authentication:** none required for catalogue search or the quicklook asset used here
- **Query parameters:** `collections=sentinel-2-l2a`, `bbox=minLon,minLat,maxLon,maxLat`,
  `datetime=from/ to`, `limit`
- **Fields stored:** product id, collection, acquisition datetime, footprint (GeoJSON), cloud cover
  (`eo:cloud_cover`), GSD (`gsd`), CRS (`proj:code`), platform/instruments, processing level and
  version, orbit state, grid code, product asset URI, quicklook thumbnail
- **Verified sample:** `S2A_MSIL2A_20261116T030141_N0513_R032_T48MYU_20261116T092508`,
  acquired `2026-11-16T03:01:41Z`, bbox `[106.80, -6.42, 107.80, -5.42]`, cloud 99.87%, CRS
  `EPSG:32748`
- **Limitations:** optical (cloud-affected), historical acquisition times, **no wave-height
  measurement**, full raster download requires OIDC/S3 credentials and is out of scope
- **Redistribution:** quicklook thumbnails cached locally for the demo with attribution; Sentinel
  data are free and open, but the proposal should retain the Copernicus attribution line
- **Fallback:** cached datasets with original acquisition dates and an explicit stale/unavailable
  indicator

### 2.2 NOAA NDBC historical standard meteorological data (training only)

- **Dataset title:** NOAA National Data Buoy Center historical stdmet
- **Provider:** NOAA NDBC (U.S. National Oceanic and Atmospheric Administration)
- **Landing page:** <https://www.ndbc.noaa.gov/>
- **Archive:** <https://www.ndbc.noaa.gov/data/historical/stdmet/>
- **Access:** direct HTTPS GET, no authentication, e.g.
  `https://www.ndbc.noaa.gov/data/historical/stdmet/51002h2024.txt.gz`
- **Licence:** work of the U.S. federal government, public domain; attribution appreciated
- **Stations used:**
  - `51002` — SOUTHWEST HAWAII, 215 NM SSW of Hilo; 17.070 N 157.755 W; water depth 4,979 m
  - `41010` — CANAVERAL EAST, 120 NM east of Cape Canaveral; 28.860 N 78.478 W; depth 903.1 m
- **Years:** 2022, 2023, 2024
- **Rows:** 41,104 valid after removing NDBC sentinels (99/999/9999) and rows missing a core variable
- **Cadence:** typically 10 minutes, with sensor outages preserved
- **Schema mapping:** `WVHT→wave_height_m`, `DPD→wave_period_s`, `MWD→wave_direction_deg`,
  `WSPD→wind_speed_mps`, `WDIR→wind_direction_deg`, `WTMP→sea_temperature_c`,
  `PRES→air_pressure_hpa`
- **Limitations:** not Indonesian waters; no hazard labels; wave sensor outages at 51002 in 2024
  (only 3,182 valid rows for that year) — this is visible in the data and documented rather than
  patched
- **Use:** offline model training and proxy evaluation only. Simulated telemetry is the inference
  input in this prototype.

### 2.3 OpenStreetMap base map

- Tiles from `tile.openstreetmap.org`, attribution "© OpenStreetMap contributors".
- Used only as a base map; no OSM data is stored, mined or re-served.
- Tile usage policy: <https://operations.osmfoundation.org/policies/tiles/>. For heavy production
  traffic, switch to a paid tile provider.

## 3. Reproduce the research

```bash
# 1. Satellite catalogue (no auth)
curl "https://stac.dataspace.copernicus.eu/v1/search?collections=sentinel-2-l2a&bbox=106.7,-6.4,107.0,-6.0&datetime=2026-11-01T00:00:00Z/2026-11-18T23:59:59Z&limit=1"

# 2. NDBC archive
curl -O "https://www.ndbc.noaa.gov/data/historical/stdmet/51002h2024.txt.gz"

# 3. Repository pipeline
python backend/scripts/fetch_training_data.py
python backend/scripts/bootstrap_demo.py
curl "http://localhost:8000/api/v1/satellite/datasets?limit=5"
```

## 4. Rejected / deferred options and why

| Option | Reason |
| --- | --- |
| Sentinel Hub Processing API | Requires account/plan; no evidence of a free tier usable for judging. Metadata from CDSE STAC is sufficient and verifiable. |
| Full Sentinel-2 SAFE raster | Product download requires OIDC/S3 credentials, ~760 MB per scene; unnecessary for provenance demonstration. |
| Sentinel-1 SAR | Would need careful radar interpretation; out of scope and easy to misrepresent. |
| Copernicus Marine fields | Requires registration; would be the best next step for real ocean physics context. |
| BMKG machine access | No documented, permitted public API was verified. BMKG is cited as the authority users must consult, not as an ingested source. |
| NASA POWER | Useful context but adds a third provenance class without improving the vertical slice; deferred. |
| Scraping provider sites | Explicitly forbidden by project rules. |

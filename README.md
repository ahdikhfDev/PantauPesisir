# CEWS — Coastal Early Warning System

A public, deployable web prototype that combines **simulated buoy telemetry**, **real Copernicus
Sentinel-2 acquisition metadata**, a **FastAPI + PostgreSQL/PostGIS backend**, and **machine-learning
anomaly screening** with a transparent risk rubric — presented in a Next.js dashboard.

> **Prototype, not authority.** CEWS is a student-competition decision-support demonstrator. It is
> not an operational tsunami warning system, not a certified forecasting system, and not a
> replacement for BMKG, BPBD, port authorities or any official source. Buoy readings are synthetic
> and labelled as such; satellite records are historical optical imagery shown for coastal context.
>
> **Submission status:** source-complete and locally verified; public deployment and the demo video
> are still pending (see [docs/COMPETITION_CHECKLIST.md](docs/COMPETITION_CHECKLIST.md)).

---

## 1. What actually works

| Capability | Implementation | Verified |
| --- | --- | --- |
| Coherent synthetic buoy simulator | Deterministic AR(1)-style generator, 3 scenarios, manual burst + automatic interval loop, separate `simulation_id` namespace | ✅ tests + live |
| Validated ingestion | Pydantic + plausibility ranges + timezone checks + provenance checks + duplicate prevention + quarantine of invalid rows | ✅ 8 tests |
| Real satellite connector | Copernicus Data Space Ecosystem STAC search (no auth) + quicklook thumbnails cached locally + provenance metadata | ✅ live, 7+ records |
| Time alignment | 30-minute configurable prototype window; unmatched datasets preserved | ✅ tests |
| Anomaly detection | scikit-learn Isolation Forest trained on 41,104 real NOAA NDBC observations | ✅ reproducible artifact |
| Prototype risk grading | Transparent `prototype_rubric_v1` over absolute wave/wind/pressure/period | ✅ tests |
| AI explanations | Contributing factors, window, model version, caveats, data quality | ✅ live |
| Alerts | Persisted lifecycle open → acknowledged → resolved, dedupe, API-key protected | ✅ tests + live |
| Degradation | Cached satellite metadata with original acquisition dates; explicit provider failure status | ✅ tests |
| Dashboard | 6 responsive pages reading only from the API | ✅ browser-checked |

Everything visible in the UI is wired to the backend. There are no placeholder metrics, no
hard-coded charts, and no dead buttons: privileged controls require the documented demo API key.

## 2. The console

CEWS is a dashboard application with a persistent workspace shell (sidebar + status bar), not a
marketing landing page. Every screen reads live API data; privileged actions use the documented demo
key.

![CEWS operations overview](docs/screenshots/overview.png)

| Route | Workspace |
| --- | --- |
| **`/` Overview** | KPI row (buoy sites, mean wave, open alerts, satellite records, model), sea-state chart with per-zone/mean scope, zone status list, AI snapshot with contributing factors, alert queue, source freshness and simulator state |
| **`/ocean`** | Seven-parameter telemetry, wave/wind and pressure/period charts, readings table, full provenance panel, simulator controls |
| **`/satellite`** | Leaflet map (zone polygons, buoys, Sentinel-2 footprints), real STAC sync form, acquisition gallery with quicklooks, cloud cover, CRS and attribution |
| **`/ai`** | Model card, run form, anomaly gauge, risk score, contributing factors, recommendation, caveats and analysis history |
| **`/alerts`** | Filterable alert workflow with acknowledgement and resolution |
| **`/sources`** | Database/model/simulator/provider health, source freshness, validation gates, lineage and the public API surface |

More screenshots: [ocean](docs/screenshots/ocean.png) ·
[satellite](docs/screenshots/satellite.png) · [AI](docs/screenshots/ai.png) ·
[alerts](docs/screenshots/alerts.png) · [sources](docs/screenshots/sources.png) ·
[mobile](docs/screenshots/mobile.png).

## 3. Quick start

Prerequisites: Python 3.12+, Node.js 20+ (npm), no Docker required for the demo.
The demo database is SQLite; production targets PostgreSQL + PostGIS.

### 3.1 Backend

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
source .venv/bin/activate
pip install -r requirements.txt

# 1. Download the real NOAA NDBC training archive (public, no auth)
python scripts/fetch_training_data.py

# 2. Train the anomaly model and write backend/ml/artifacts/cews-iforest-v1.joblib
python scripts/train_model.py --version cews-iforest-v1

# 3. Create the schema, seed zones/buoys, run a real Copernicus sync and first analyses
python scripts/bootstrap_demo.py

# 4. Serve the API
uvicorn app.main:app --reload --port 8000
```

API docs: <http://localhost:8000/docs> · health: <http://localhost:8000/api/v1/system/health>

Create `.env` from `.env.example` first (the backend reads it from the repository root). For a
self-updating demo set `SIMULATOR_AUTOSTART=true` and `SIMULATOR_ZONE_CODE=ALL`.

### 3.2 Frontend

```bash
cd frontend
cp .env.local.example .env.local     # sets API base + public demo key
npm install
npm run dev                          # http://localhost:3000
```

### 3.3 Demo API key

`DEMO_MODE=true` enables the documented public demo key:

```
cews-demo-2026
```

It unlocks **only** ingestion, simulator control, satellite sync, analysis runs and alert updates.
It is intentionally visible in the browser (`NEXT_PUBLIC_DEMO_API_KEY`) and in this README. A real
deployment must rotate `API_SECRET_KEY` and disable `DEMO_MODE` for real operator access; the demo
key is not a privileged production credential.

### 3.4 Tests

```bash
cd backend
python -m pytest -q
# 37 passed (SQLite, isolated temp database, seeded fixtures)
```

Rebuild the model and sanity-check its behaviour:

```bash
python scripts/train_model.py --version cews-iforest-v1
python scripts/check_model_behavior.py
```

## 4. Architecture at a glance

```
┌──────────────┐   X-API-Key    ┌──────────────────────────┐
│ Buoy         │ ─────────────▶ │ FastAPI /api/v1          │
│ simulator    │                │ ingestion · validation   │
│ (synthetic)  │                │ time alignment · jobs    │
└──────────────┘                └───────────┬──────────────┘
                                            │ SQLAlchemy 2
┌──────────────┐   public STAC   ┌──────────▼──────────────┐
│ Copernicus   │ ◀────────────── │ PostgreSQL + PostGIS    │
│ CDSE STAC    │   metadata +    │ (SQLite in local demo)  │
│ (real)       │   quicklook     └──────────┬──────────────┘
└──────────────┘                            │
                                 ┌──────────▼──────────────┐
                                 │ Isolation Forest        │
                                 │ trained on NOAA NDBC    │
                                 │ + prototype rubric      │
                                 └──────────┬──────────────┘
                                            │ /api/v1 (JSON)
                                 ┌──────────▼──────────────┐
                                 │ Next.js dashboard       │
                                 │ Leaflet · Recharts      │
                                 └─────────────────────────┘
```

Details and diagrams: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## 5. Data sources (verified 2026-11-18)

| Source | What CEWS uses | Access | Licence / attribution | Verified |
| --- | --- | --- | --- | --- |
| **Copernicus Data Space Ecosystem — Sentinel-2 L2A STAC** | Product metadata, footprint, acquisition time, cloud cover, CRS, quicklook thumbnail. **No raster download.** | `GET https://stac.dataspace.copernicus.eu/v1/search`, no authentication | Free and open Sentinel data under Copernicus Data Space Ecosystem terms; "Contains modified Copernicus Sentinel data" | Live calls returned real items; quicklooks cached |
| **NOAA NDBC historical stdmet** | Real 10-minute wave/weather observations used to **train** the anomaly model | `https://www.ndbc.noaa.gov/data/historical/stdmet/{station}h{year}.txt.gz`, no authentication | U.S. federal government work, public domain | 41,104 valid rows, stations 51002 + 41010, 2022–2024 |
| **OpenStreetMap** | Base map tiles only | `tile.openstreetmap.org` | © OpenStreetMap contributors, ODbL | Used with attribution |

Full comparison, scorecard and rejected alternatives: [docs/DATA_CATALOG.md](docs/DATA_CATALOG.md).
What each UI element means: [docs/DATA_PROVENANCE.md](docs/DATA_PROVENANCE.md).

**What the satellite layer is not:** Sentinel-2 imagery does not measure wave height, bathymetry or
tsunami potential. The 30-minute temporal association is a prototype policy, not a scientific
co-location standard, and does not validate a buoy reading.

## 6. Model

- Algorithm: `sklearn.ensemble.IsolationForest` (250 trees, `random_state=42`).
- Training data: 41,104 real NDBC rows → 32,883 training / 8,221 chronological validation rows.
- Features: absolute wave height and pressure plus **cadence-aware local deviations** (relative
  wave height/period/steepness/wind, pressure residual and rate, wave-change ratio, SST residual,
  direction change). Relative features let one model work across open-ocean training data and
  coastal simulation without treating a warm, short-period bay as "anomalous" by definition.
- Operating threshold: calibrated on 90 documented **normal-scenario windows** to a 10% flag rate.
  This makes it a *scenario-calibrated demonstration detector*, not an operational model.
- Risk levels: a separate, readable rubric (`prototype_rubric_v1`), not the model.
- Evaluation (real validation slice): 0.16% flagged at the deployed threshold; at a 1% reference
  threshold, 6.5% recall of the top-5% rapid pressure changes and 2.2% of the top-5% rapid wave
  changes, against a 1.0% random baseline. Flagged rows have a median wave height of 6.29 m versus
  2.12 m unflagged. No hazard labels exist, so these are proxy checks only.

Read the model card: [docs/AI_MODEL_CARD.md](docs/AI_MODEL_CARD.md). Reproduce it:
`python scripts/fetch_training_data.py && python scripts/train_model.py`.

## 7. API

Base path `/api/v1`, JSON, UTC ISO 8601. Full contract with examples:
[docs/API_CONTRACT.md](docs/API_CONTRACT.md), interactive docs at `/docs`.

Public reads: `/buoy/latest`, `/buoy/history`, `/coastal/zones`, `/satellite/datasets`,
`/analytics/latest`, `/analytics/history`, `/analytics/model-info`, `/alerts`, `/system/health`,
`/system/data-sources`, `/system/overview`.

Key-protected writes: `POST /ingestion/buoy`, `POST /simulator/scenarios`, `POST /simulator/tick`,
`POST /simulator/stop`, `POST /satellite/sync`, `POST /analytics/run`, `PATCH /alerts/{id}`.

## 8. Repository layout

```
backend/
  app/            FastAPI app, models, schemas, services, ML inference, seed
  scripts/        fetch_training_data.py · train_model.py · bootstrap_demo.py · check_model_behavior.py
  alembic/        initial migration (PostGIS extension + GiST indexes on PostgreSQL)
  ml/             features, calibration, rubric, artifacts (joblib + metrics)
  tests/          37 pytest tests
frontend/
  app/            Overview, Ocean, Satellite, AI, Alerts, Sources
  components/     header/footer, charts, map, simulator, UI primitives
  lib/            API client, types, hooks, formatting
docs/             architecture, API, data catalog, provenance, model card, schema, tests, demo, checklist
data/             local SQLite database, cached quicklooks, raw downloads (gitignored)
```

## 9. Deployment

No public URL has been deployed yet by the agent — deployment needs project credentials. The
intended setup is documented and reproducible:

1. **Database:** managed PostgreSQL with PostGIS (e.g. Neon/Supabase with the `postgis` extension
   enabled). Run `alembic upgrade head` with `DATABASE_URL=postgresql+psycopg://...`.
2. **Backend:** Python host (Render/Railway/Fly). Root `backend/`, install
   `pip install -r requirements.txt`, start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
   Set `DATABASE_URL`, `API_SECRET_KEY`, `CORS_ORIGINS`, `SIMULATOR_AUTOSTART=true`,
   `SIMULATOR_ZONE_CODE=ALL`, satellite variables. Keep `DEMO_MODE=true` only for the public demo.
3. **Frontend:** Vercel, root `frontend/`, env `NEXT_PUBLIC_API_BASE_URL=https://<backend>/api/v1`
   and `NEXT_PUBLIC_DEMO_API_KEY=cews-demo-2026`.
4. Verify `/api/v1/system/health`, then keep the deployment alive through 30 November 2026.

PostGIS-specific DDL (extension, GiST indexes) is implemented in the migration but has not been
exercised against a live PostgreSQL instance in this environment — only SQLite was available.
Treat PostgreSQL verification as an outstanding deployment task.

## 10. Theme positioning (IT RUSH 2026 — subtheme 3)

Per the team's most recent decision, the work is positioned under **Ekonomi dan Pemberdayaan
Masyarakat**. CEWS supports coastal economic resilience by giving fishers, small coastal businesses
and port operators **verified coastal-condition intelligence**: what was observed, when, how fresh,
how unusual, and what caveats apply — so avoidable disruption and unsafe departures can be reduced.

CEWS does **not** predict fish prices, income or market demand, and it does not claim that buoy or
satellite data alone can do so. If the team reverts to *Mitigasi Bencana dan Perubahan Iklim*, the
proposal must be updated consistently (the technical prototype already fits that framing).

## 11. Limitations and honest gaps

- No buoy hardware is deployed; all telemetry is simulated (clearly labelled).
- The model is trained on offshore Hawaiian/Florida NDBC stations, not Indonesian waters. Domain
  shift is real and measured (see model card); the threshold is calibrated on synthetic normal
  windows, not on real coastal buoy deployments.
- Satellite integration stores metadata + quicklooks only; full-resolution Sentinel-2 raster
  download requires a Copernicus OIDC/S3 account and is out of scope.
- The 30-minute buoy/satellite association window is a prototype parameter.
- Risk levels are demonstration rubric output, not BMKG criteria, probabilities or official alerts.
- PostgreSQL/PostGIS deployment path is implemented but only SQLite was available for verification.
- Rate limiting is per process, not distributed; production deployment needs a shared limiter.
- Public deployment, PDF proposal, originality/AI declaration and the 3–5 minute demo video are
  required submission items still outstanding.

## 12. Third-party and AI disclosure

Libraries: FastAPI, Starlette, Pydantic, SQLAlchemy, Alembic, GeoAlchemy2, Shapely, NumPy, pandas,
scikit-learn, joblib, httpx, pytest; Next.js, React, TypeScript, Tailwind CSS, Recharts, Leaflet,
react-leaflet, lucide-react. No UI template was copied; the visual system was built for this project.

Data: NOAA NDBC (public domain), Copernicus Data Space Ecosystem (free/open Sentinel data),
OpenStreetMap (ODbL, base map only).

AI assistance: the codebase, documentation and design were produced with an AI coding agent
(Zed agent, DeepSeek V4.1 Flash). Every external API, dataset, licence and result reported here was
verified by running it — API responses, downloaded archives, model metrics and 37 automated tests —
rather than accepted from model output. Disclose this assistance in the proposal and the
originality/AI declaration as required by the guidebook.

## 13. License

MIT — see [LICENSE](LICENSE). The team should confirm the final licence before submission.

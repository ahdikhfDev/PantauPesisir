# Test plan and results

Last run: **2026-11-18** · Python 3.12.10 · FastAPI 0.163.1 · SQLAlchemy 2.1.9 · scikit-learn 1.9.1 ·
pandas 3.1.1 · Node 26.13.0 · Next.js 15.5.29

```bash
cd backend
python -m pytest -q
# 37 passed, 1 warning (Starlette TestClient deprecation)
```

The suite runs against an isolated temporary SQLite database with seeded zones and `DEMO_MODE=true`.
No provider network calls are made in tests: the satellite adapter is exercised with
`httpx.MockTransport` and the job/orchestration path with a fake provider.

## 1. Backend and integration tests

| # | Test | File | Expected | Result |
| --- | --- | --- | --- | --- |
| 1 | Health reports database + model availability | `test_system.py` | DB ok, model available, 3 zones, observations > 0 | PASS |
| 2 | Seeded zones have boundaries/notes/buoys | `test_system.py` | 3 zones, prototype note, simulated buoy | PASS |
| 3 | Latest observations labelled simulated | `test_system.py` | source_type simulated, valid, age ≥ 0 | PASS |
| 4 | History filters + pagination | `test_system.py` | total > 0, page size respected, invalid filter 422 | PASS |
| 5 | Data sources + overview payload | `test_system.py` | buoy/NDBC sources, 3 zones, provenance notice | PASS |
| 6 | Satellite provider description is honest | `test_system.py` | provider copernicus-stac, note says not wave height | PASS |
| 7 | Ingestion requires API key | `test_ingestion.py` | 401 unauthorized | PASS |
| 8 | Valid ingestion + idempotent replay | `test_ingestion.py` | 201 valid; replay 200 duplicate | PASS |
| 9 | Missing parameter rejected | `test_ingestion.py` | 422 with field issue | PASS |
| 10 | Naive timestamp rejected | `test_ingestion.py` | 422 timezone message | PASS |
| 11 | Out-of-range coordinates rejected | `test_ingestion.py` | 422 | PASS |
| 12 | Implausible wave height quarantined | `test_ingestion.py` | 201, accepted false, invalid, out_of_range | PASS |
| 13 | Unknown buoy | `test_ingestion.py` | 404 | PASS |
| 14 | Provenance mismatch quarantined | `test_ingestion.py` | 201 invalid, provenance_mismatch | PASS |
| 15 | Manual scenario coherent + labelled | `test_simulator.py` | completed, rows match count, distinct times, warning label | PASS |
| 16 | Generator deterministic + bounded | `test_simulator.py` | identical series, physical bounds | PASS |
| 17 | Unknown zone rejected | `test_simulator.py` | 404 | PASS |
| 18 | Auto mode starts/stops | `test_simulator.py` | 202, running true, stop false | PASS |
| 19 | Analysis explainable prototype output | `test_analytics.py` | version, factors, caveats, rubric metadata, simulated flag | PASS |
| 20 | Extreme scenario escalates risk + alert | `test_analytics.py` | moderate/high, alert exists | PASS |
| 21 | Latest/detail/history endpoints | `test_analytics.py` | consistent IDs, 1–5 history items | PASS |
| 22 | Analysis requires key | `test_analytics.py` | 401 | PASS |
| 23 | Model info documents limitations | `test_analytics.py` | IsolationForest, >10k rows, proxy method, NDBC | PASS |
| 24 | Alert acknowledge + resolve | `test_alerts.py` | timestamps/actor set, note appended, 409 on reopen | PASS |
| 25 | Alert filters and counts | `test_alerts.py` | status/severity aggregates present | PASS |
| 26 | Alert patch requires key | `test_alerts.py` | 401 | PASS |
| 27 | Satellite sync stores metadata + quicklook | `test_satellite.py` | completed, 2 stored, thumbnail JPEG | PASS |
| 28 | Provider failure degrades to cache | `test_satellite.py` | completed_with_fallback, used_cache, cached rows kept | PASS |
| 29 | STAC adapter parses + filters cloud | `test_satellite.py` | 2 of 3 products, CRS, concept note, thumbnail bytes | PASS |
| 30 | STAC adapter timeout + malformed handling | `test_satellite.py` | `timeout` and `malformed` error kinds | PASS |
| 31 | Feature frame is trailing-only | `test_ml.py` | mutating the last row does not change earlier features | PASS |
| 32 | Scoring deterministic + explainable | `test_ml.py` | identical scores, factors present, 0–1 bounds | PASS |
| 33 | Extreme conditions flagged | `test_ml.py` | severity above normal, flag true | PASS |
| 34 | Insufficient data rejected | `test_ml.py` | `InsufficientDataError` | PASS |
| 35 | Artifact exposes metrics/provenance | `test_ml.py` | >10k rows, proxy method, NDBC, licence | PASS |
| 36 | Feature matrix requires columns | `test_ml.py` | `KeyError` | PASS |
| 37 | Rubric monotonic + transparent | `test_ml.py` | low < moderate < high, components sum | PASS |

## 2. Manual / live verifications

| Check | Method | Result |
| --- | --- | --- |
| Copernicus STAC reachable without auth | `curl` search for Jakarta Bay | 200, real Sentinel-2 item returned |
| Quicklook download | `curl` asset URL with redirects | 200, valid JPEG (343×343) |
| NDBC archive download | `curl` `.txt.gz` files | 200 for 5 station-years |
| Training dataset | `fetch_training_data.py` | 41,104 rows, 2022-01-01 → 2024-12-31 |
| Model training | `train_model.py` | artifact + metrics written |
| Demo bootstrap with live sync | `bootstrap_demo.py` | 7 datasets across 3 zones, 1–3 per zone |
| End-to-end alert flow | API: extreme scenario → analysis → PATCH | risk high 94.9, anomaly 0.99, alert created + acknowledged |
| Chart rendering | Headless Chrome screenshots | charts, map, tables, alert card render |
| Alembic fresh database | `alembic upgrade head` on SQLite | 11 tables + `alembic_version` |
| Frontend production build | `npm run build` | compiled, 9/9 static pages, types valid |
| Frontend typecheck | `npx tsc --noEmit` | clean |

## 3. Not verified (must be done before submission)

| Item | Why | Action |
| --- | --- | --- |
| PostgreSQL + PostGIS migration | No PostgreSQL/Docker available in this environment | Run `alembic upgrade head` on managed Postgres, confirm extension + GiST indexes |
| Public frontend deployment | Requires Vercel credentials | Deploy `frontend/` and set `NEXT_PUBLIC_API_BASE_URL` |
| Public backend deployment | Requires Python host credentials | Deploy `backend/` with Postgres URL + secrets |
| Demo video | Recording/permissions | Record 3–5 minutes, upload unlisted |
| Cross-browser check | Only Chromium headless available | Check Safari/Firefox before judging |
| Mobile device check | Responsive CSS written but not device-tested | Screenshot at 390 px and verify menu/pills |
| Load/rate-limit behaviour | Per-process limiter | Test with concurrent clients; consider shared limiter |
| Real coastal buoy validation | No hardware | Out of scope; state in proposal |

## 4. Frontend checks (manual)

- Overview renders KPI cards, per-zone sea-state chart, zone status, AI snapshot, alert queue and source strip.
- Loading skeletons shown before API data; API errors show retry messages.
- Unsupported/empty states: alerts empty state, satellite empty catalogue, AI "no analysis yet".
- Privileged buttons surface the demo-key hint on 401.
- Charts show units and UTC labels; simulated badge visible.
- Map shows zone polygons, buoy markers and Sentinel-2 footprints with OSM attribution.
- Alert card actions update status and timestamps after refresh.
- Numbers use tabular monospace; long product IDs wrap safely.

## 5. Reproduce

```bash
# backend
cd backend && python -m pytest -q

# frontend
cd frontend && npx tsc --noEmit && npm run build

# data + model
python backend/scripts/fetch_training_data.py
python backend/scripts/train_model.py --version cews-iforest-v1
python backend/scripts/check_model_behavior.py

# migration
cd backend && DATABASE_URL="sqlite:///data/alembic_test.db" python -m alembic upgrade head
```

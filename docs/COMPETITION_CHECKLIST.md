# IT RUSH 2026 submission checklist

Deadline recorded in the guidebook: **20 November 2026, 23:59 WIB**. Judging 28–29 November 2026.
Winner announcement 30 November 2026. The deployed site must stay live through 30 November 2026.

Status legend: ✅ done · 🟡 partially done / needs team action · ⛔ not done yet

## 1. Deliverables

| Requirement | Status | Evidence / action |
| --- | --- | --- |
| Website application, public and deployed | ⛔ | Source complete; deploy `frontend/` + `backend/` + PostGIS (steps in README §9). Requires team credentials. |
| Public GitHub/GitLab repository | ⛔ | Local repository is not initialised. `git init`, add commits in increments, publish. Do not rewrite history. |
| AI integrated in at least one feature | ✅ | Isolation Forest anomaly screening + transparent risk rubric; `/ai` page; model card. |
| Live site remains active through 30 Nov 2026 | ⛔ | Follows deployment; set reminders and uptime checks. |
| Tech stack free / templates disclosed | ✅ | README §12 discloses libraries, data and AI assistance. |
| Demo login (if login exists) | ✅ (n/a) | No user login. Public demo key `cews-demo-2026` documented in README; no privileged credentials exposed. |
| Unlisted YouTube demo video, 3–5 min | ⛔ | Script ready: `docs/DEMO_SCRIPT.md` (4:00). |
| PDF proposal `ITRUSH26_Nama Tim_JudulKarya.pdf` | ⛔ | Content available in README/docs; needs team formatting and submission. |
| PDF originality and AI declaration (organiser template) | ⛔ | Use organiser template; disclose AI coding assistance and open-source libraries. |
| Registration / participant proof documents | ⛔ | Team responsibility; not handled in this repository. |

## 2. Functional acceptance criteria

| # | Criterion | Status | Where |
| --- | --- | --- | --- |
| 1 | Buoy simulator sends data automatically and manually | ✅ | `POST /simulator/scenarios` (manual/auto), `/simulator/tick`, `/ocean#simulator` |
| 2 | Backend validates and stores observations | ✅ | `validation.py`, 8 ingestion tests |
| 3 | At least one satellite API researched + working integration or documented fallback | ✅ | Copernicus CDSE STAC live; cached fallback tested |
| 4 | Satellite metadata and acquisition time preserved | ✅ | `satellite_datasets`, `/satellite` page |
| 5 | Buoy/satellite association without forced matches | ✅ | 30-min window, unmatched IDs preserved |
| 6 | ML model loads and produces reproducible outputs | ✅ | `cews-iforest-v1`, seeded artifact, tests |
| 7 | Risk analysis clearly prototype decision support | ✅ | Caveats, rubric version, recommendation wording |
| 8 | Frontend displays backend data, not hard-coded values | ✅ | All pages fetch `/api/v1` |
| 9 | Provider failure does not break buoy monitoring | ✅ | Fallback test + status rows |
| 10 | Public website and public repository available | ⛔ | Deployment + repo publication pending |
| 11 | README, data catalog, model card, setup complete | ✅ | README + `docs/*` |
| 12 | No false operational warning claims | ✅ | Copy, caveats, model card, footer disclaimer |

## 3. Documentation

| Deliverable | Status | File |
| --- | --- | --- |
| README (setup, architecture, env, demo, deployment) | ✅ | `README.md` |
| Architecture + diagrams | ✅ | `docs/ARCHITECTURE.md` |
| API contract | ✅ | `docs/API_CONTRACT.md` |
| Data catalog + scorecard + licences | ✅ | `docs/DATA_CATALOG.md` |
| Data provenance map | ✅ | `docs/DATA_PROVENANCE.md` |
| AI model card | ✅ | `docs/AI_MODEL_CARD.md` |
| Database schema / ERD / migrations | ✅ | `docs/DATABASE_SCHEMA.md` |
| Test plan + results | ✅ | `docs/TEST_PLAN.md` |
| Demo script | ✅ | `docs/DEMO_SCRIPT.md` |
| Competition checklist | ✅ | this file |
| `.env.example` | ✅ | repository root + `frontend/.env.local.example` |
| LICENSE | 🟡 | MIT file added; team must confirm licence choice |

## 4. Judging criteria mapping

| Criterion (weight) | How CEWS addresses it | Evidence |
| --- | --- | --- |
| Website functionality & technical quality (25%) | Working API/database/ML/UI vertical slice, validation, tests, error/empty/stale states, deployment-ready config | 37 tests, live API checks, build |
| Innovation & solution accuracy (20%) | Separation of behavioural anomaly detection and absolute severity; verified provider integration; calibrated threshold with published limitations | Model card, `/ai` UI |
| Theme relevance & impact (15%) | Subtheme 3: verified coastal-condition intelligence for fishers, small businesses, port operators | README §10, recommendations copy |
| UI/UX design (15%) | Purpose-built responsive design, consistent data-source badges, units everywhere, honest caveats | 6 pages, screenshots in `docs/screenshots/` |
| Source-code quality (15%) | Modular monolith, typed schemas, documented decisions, dialected geometry, adversarial tests | repository structure, docs |
| Documentation (10%) | All mandatory docs present with verified sources and dated results | `docs/` |

## 5. Known gaps before submission

1. **Deploy** backend + frontend + managed PostGIS; verify PostgreSQL migration/GiST indexes.
2. **Initialise git** and commit in meaningful increments; publish the repository publicly.
3. **Record** the demo video and upload unlisted.
4. **Write and export** the proposal PDF with the required filename, and complete the AI/originality
   declaration.
5. **Cross-browser/mobile check** (only headless Chromium was available during development).
6. **Rotate secrets** for production and set `DEMO_MODE=false` if real operator accounts are added.
7. **Confirm the subtheme** with the team. If subtheme 1 (disaster mitigation) is chosen instead,
   rewrite the proposal positioning consistently; the prototype supports either framing.

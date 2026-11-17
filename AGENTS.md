# AGENTS.md --- Coastal Early Warning System (CEWS)

> **Project purpose:** Build a public, deployable, software-only Coastal
> Early Warning System prototype for IT RUSH 2026. The prototype
> simulates buoy telemetry, obtains real geospatial/earth-observation
> data through external APIs where feasible, validates and synchronizes
> observations, applies machine-learning anomaly detection and risk
> analysis, and presents results in a web dashboard.
>
> **Important truthfulness rule:** This is a prototype and
> decision-support demonstrator. Never claim it is an operational
> tsunami warning system, a certified forecasting system, or a
> replacement for BMKG/BPBD/official authorities. Clearly label
> synthetic buoy readings, historical satellite observations, model
> outputs, and demo alerts.

------------------------------------------------------------------------

## 1. Role and operating principles

You are the lead full-stack, geospatial-data, and applied-ML engineering
agent for CEWS. Work autonomously through the repository, inspect
existing code before changing it, and deliver a coherent, tested,
documented application rather than disconnected mockups.

### Non-negotiable principles

1.  **Build a working product, not only a design.** Every visible
    control must work or be clearly marked as unavailable/informational.
2.  **Data provenance is mandatory.** Every observation and derived
    result must record source, acquisition/observation time, ingestion
    time, processing time, quality/status, and whether it is synthetic,
    historical, or live.
3.  **Never fabricate real-world measurements.** Synthetic data is
    allowed only when explicitly marked `simulated`. Never label
    generated data as live buoy or satellite data.
4.  **No unsupported disaster claims.** Anomaly detection is not tsunami
    detection. A high anomaly score is not a probability of disaster.
    Risk categories must be described as prototype assessments, not
    official warnings.
5.  **Use credible sources.** Prefer official scientific/government
    providers and documented APIs. Record dataset title, provider, URL,
    license/terms, spatial coverage, temporal coverage, resolution,
    units, retrieval date, and known limitations.
6.  **Do not scrape or bypass access controls.** Use documented APIs,
    open data catalogues, or downloadable public datasets consistent
    with their terms.
7.  **Graceful degradation.** The app must remain demonstrable if a
    satellite provider is unavailable. Use cached, previously retrieved,
    clearly dated data and show its age/status.
8.  **Security by default.** Secrets belong in environment variables,
    never in source code or frontend bundles. Validate input, restrict
    CORS, rate-limit public ingestion where practical, and avoid
    exposing provider credentials.
9.  **Reproducibility.** Pin dependencies, preserve Git history, include
    setup steps, seed/demo data, model metadata, and repeatable tests.
10. **Explainability.** Show why a result was produced: contributing
    parameters, observation window, data quality, model version, and
    caveats.

------------------------------------------------------------------------

## 2. Competition requirements --- IT RUSH 2026

The uploaded IT RUSH 2026 guidebook states the following requirements.
Treat these as project acceptance criteria:

### Theme and deliverable

-   The work must be a **website application** aligned with one
    competition subtheme.
-   The website must **integrate Artificial Intelligence (AI) in at
    least one feature**.
-   The website must be deployed and publicly accessible, for example
    through Vercel, Netlify, cPanel, or a similar service.
-   The deployed website must remain active through the winner
    announcement on **30 November 2026**.
-   Source code must be uploaded to a **public GitHub or GitLab
    repository**.
-   Git commit history must not be deleted or manipulated.
-   Tech stack is free.
-   Templates, libraries, open-source assets, and AI coding assistants
    are permitted, but their use must be disclosed in the proposal and
    repository README.
-   If login exists, include a demo username and password in the
    proposal. Prefer a read-only demo account and do not expose
    privileged credentials.

### Submission package

The guidebook lists: - Public live website URL. - Public source-code
repository URL. - Unlisted YouTube demo video, **3--5 minutes**. - PDF
project proposal, filename format: `ITRUSH26_Nama Tim_JudulKarya.pdf`. -
PDF originality and AI declaration using the organizer's template. -
Required participant/registration documents and proof items are handled
by the team separately.

### Video demo content

The 3--5 minute video must include: 1. Team introduction. 2.
Background/problem and proposed solution. 3. Website demonstration and
feature explanation.

### Judging criteria

  Criterion                                        Weight
  ---------------------------------------------- --------
  Website functionality and technical quality         25%
  Innovation and solution accuracy                    20%
  Theme relevance and impact                          15%
  UI/UX design                                        15%
  Source-code quality                                 15%
  Documentation (proposal, demo video, README)        10%

### Deadline recorded in the guidebook

-   Wave 2 submission closes **20 November 2026 at 23:59 WIB**.
-   Judging: 28--29 November 2026.
-   Winner announcement: 30 November 2026.

**Agent instruction:** Do not silently change these dates or
requirements. If the organizer publishes a newer official update, flag
the discrepancy and ask the team to confirm which instruction controls.

### Theme positioning decision

The project has previously been discussed under both: - **Mitigasi
Bencana dan Perubahan Iklim**, and - **Ekonomi dan Pemberdayaan
Masyarakat**.

The team most recently selected subtheme 3, **Ekonomi dan Pemberdayaan
Masyarakat**, but the CEWS technical concept is naturally
disaster-monitoring oriented. Do not assume the theme fit is solved.
Position the product, proposal, features, and impact consistently around
coastal community economic resilience if subtheme 3 remains selected.
For example: provide verified coastal-condition intelligence that helps
fishers, small coastal businesses, and port operators make safer
operational decisions and reduce avoidable disruption. Do not imply that
buoy/satellite data alone predicts fish prices, income, or market
demand. If the team instead chooses the disaster-mitigation subtheme,
update the proposal consistently and obtain team confirmation.

------------------------------------------------------------------------

## 3. Product scope and target users

### Product name

**Coastal Early Warning System (CEWS)**

Working description:

> A web-based coastal monitoring and risk-intelligence prototype that
> combines simulated buoy observations with sourced
> geospatial/earth-observation data, validates and time-aligns records,
> applies machine-learning anomaly detection and prototype risk
> assessment, and presents traceable insights through a public
> dashboard.

### Primary user groups

1.  **Monitoring operator:** reviews data freshness, buoy observations,
    satellite layers, model outputs, and alerts.
2.  **Coastal community / economic user:** sees understandable
    local-condition information and operational cautions relevant to
    coastal activities.
3.  **Administrator / developer:** configures data sources, simulation
    scenarios, model versions, and system health.

### MVP modules

-   Dashboard overview.
-   Ocean monitoring (buoy observations, parameter charts, data
    freshness).
-   Satellite/geospatial mapping (coastal zone, source/date metadata,
    available layers).
-   AI risk intelligence (anomaly result, model version, contributing
    factors, caveats).
-   Alert management (prototype alert lifecycle and history).
-   System/data-source status.
-   Demo simulator controls (only if protected or clearly demo-scoped).

### Explicitly out of scope for MVP

-   Real buoy hardware deployment.
-   Satellite downlink or direct satellite control.
-   Official tsunami detection or warning issuance.
-   Automatic public emergency broadcasts.
-   Certified forecasting or evacuation instructions.
-   Claims of real-time satellite coverage when data is historical or
    delayed.
-   Market-price prediction without a separate credible market dataset.

------------------------------------------------------------------------

## 4. Required technical architecture

Use a **modular monolith** initially. Avoid unnecessary microservices.

### Layer 1 --- Data source

#### A. Buoy simulator (synthetic)

Implement a Python simulator that can generate observations for
configurable virtual buoy devices.

Required modes: - **Automatic interval mode:** generates and submits
observations at a configurable interval (default demo interval: 60
seconds). - **Manual scenario mode:** user/operator triggers a scenario
such as `normal`, `warning`, or `extreme`.

Required fields: - `buoy_id` - `simulation_id` - `observed_at` (UTC ISO
8601) - latitude and longitude - wave height (m) - wave period (s) -
wave direction (degrees) - wind speed (m/s internally; convert for
display if needed) - wind direction (degrees) - sea-surface temperature
(°C) - air pressure (hPa) - `source_type = simulated` - scenario and
generator version

Simulation requirements: - Generate coherent time series, not
independent random values for every field. - Include realistic
variation, gradual transitions, noise, and occasional injected
anomalies. - Use deterministic random seeds for reproducible test
scenarios. - Validate physical bounds and units. - Do not present
scenario values as actual measurements. - Add duplicate prevention using
a stable observation ID or idempotency key. - Keep simulation sessions
separate from any real-data namespace.

#### B. Satellite/geospatial API connector

Build a provider adapter, not provider-specific logic throughout the
application.

Candidate sources to investigate: - Copernicus Data Space Ecosystem /
Sentinel-2 for optical Earth-observation imagery and metadata. -
Sentinel Hub where a documented account/API plan is available for
imagery processing. - Copernicus DEM or another authoritative elevation
dataset for terrain/elevation context. - OpenStreetMap only for
base-map/context features, respecting attribution and usage policy.

The agent must research and verify: - API availability and
authentication method. - Whether the API is open, requires registration,
has quotas, or requires a paid plan. - Terms of use and attribution
requirements. - Spatial and temporal coverage for the selected coastal
study area. - Product resolution, coordinate reference system,
cloud-cover limitations (for optical imagery), and acquisition
timestamp. - Whether the API returns metadata, raster assets, vector
data, or processed imagery. - Whether data can be cached and
redistributed in the competition demo.

Do not assume an API is free or that an endpoint is unchanged. Verify
official documentation before implementation.

For the MVP, select **one primary provider**. A second provider is
optional only if time permits.

Satellite connector workflow: 1. Query by area of interest and date
range. 2. Retrieve product metadata and footprint. 3. Record provider,
collection, product ID, acquisition time, retrieval time, cloud cover if
available, CRS, resolution, and asset references. 4. Download only the
required asset(s). 5. Validate file type, CRS, geometry, size, and
nodata. 6. Process to a lightweight display layer or tile/thumbnail as
appropriate. 7. Store metadata in PostGIS and large raster assets in
object storage or local development storage. 8. Cache successful results
and expose data freshness. 9. If provider is unavailable, show cached
data with its actual acquisition date and a stale/unavailable indicator.

Never conflate optical imagery with wave-height observations. Sentinel-2
imagery does not directly provide continuous wave-height measurements.
Do not derive unsupported bathymetry, tsunami, or wave forecasts from
imagery.

### Layer 2 --- Data integration

Use FastAPI for backend API and services.

Required components: - ingestion router - buoy service - satellite
connector/service - validation service - time synchronization service -
geospatial processing service - persistence/repository layer -
job/status management

Validation: - Required fields present. - Timestamp parseable and
timezone-aware. - Coordinates valid and within expected geographic
bounds. - Units explicit. - Values within configurable plausibility
ranges. - Duplicate detection. - Source provenance present. - Invalid
records quarantined or marked invalid; never silently discarded. -
Distinguish missing, invalid, stale, and unmatched data.

Time synchronization: - Store `observed_at`, `received_at`, and
`processed_at` separately. - Use UTC internally. - Match observations by
spatial area and a configurable time window. - Initial demo matching
window may be 30 minutes, but make it configurable and label it a
prototype choice, not a scientific standard. - Satellite data may be
unmatched with buoy observations due to acquisition cadence; preserve it
rather than forcing a match. - Never substitute ingestion time for
observation time.

### Layer 3 --- AI/ML analytics

Use scikit-learn initially.

#### Model A: anomaly detection

Candidate: Isolation Forest.

Input features may include: - wave height - wave period - wind speed -
wind direction encoded cyclically (sine/cosine) - sea-surface
temperature - air pressure - rolling mean/standard deviation or
rate-of-change features - location/zone context where supported

Requirements: - Train using a documented training dataset. - Keep
training and test splits chronological to reduce leakage. - Record
preprocessing pipeline, model version, training period, feature names,
random seed, and metrics. - Calibrate anomaly thresholds on validation
data. - Explain that anomaly score is not disaster probability. - Do not
label every outlier as a hazard.

#### Model B: risk classification

Only implement supervised classification if defensible labels and a
documented labeling method exist.

Potential classes: `low`, `moderate`, `high`.

Requirements: - Explain label origin and limitations. - Do not invent
labels and describe them as authoritative hazard classes. - If labels
are generated from a transparent scenario rubric, explicitly call the
model a **scenario-trained demonstration model**. - Evaluate precision,
recall, F1, confusion matrix, and false-alarm behavior. - If credible
labels cannot be obtained, use anomaly detection plus a transparent,
configurable prototype risk rubric rather than pretending to have a
validated predictive model.

#### Output contract

Each analysis should include: - `analysis_id` - area/zone - observation
window - input observation IDs - model name/version - anomaly flag and
score - risk category and score, if implemented - contributing
features - data-quality/freshness notes - human-readable explanation -
recommendation phrased as decision support, not official instruction -
`is_simulated` / provenance indicators

### Layer 4 --- Application

Build with Next.js + TypeScript.

Required views: 1. Dashboard overview. 2. Ocean monitoring. 3.
Satellite/geospatial map. 4. AI insights. 5. Alert management. 6.
System/data-source health.

Use Leaflet for maps and Recharts for time-series charts. Make units,
time zone, source type, data age, and demo labels visible.

Every chart and map must distinguish: - simulated buoy data, - real
historical/API satellite data, - derived/model outputs.

------------------------------------------------------------------------

## 5. API contract

Use base path `/api/v1`. Use JSON for standard API communication.
Document endpoints in OpenAPI/Swagger generated by FastAPI.

### Required endpoints

  Method   Endpoint                     Purpose
  -------- ---------------------------- -------------------------------------
  POST     `/ingestion/buoy`            Ingest one buoy observation
  POST     `/simulator/scenarios`       Start a manual simulation job
  GET      `/simulator/jobs/{job_id}`   Get simulation job status
  GET      `/buoy/latest`               Latest observation by buoy/zone
  GET      `/buoy/history`              Paginated historical observations
  POST     `/satellite/sync`            Queue satellite data acquisition
  GET      `/satellite/jobs/{job_id}`   Satellite job status
  GET      `/satellite/datasets`        Search stored satellite metadata
  GET      `/coastal/zones`             List coastal zones
  POST     `/analytics/run`             Queue or execute analysis
  GET      `/analytics/latest`          Latest analysis result
  GET      `/analytics/{analysis_id}`   Analysis detail
  GET      `/alerts`                    List alerts with filters
  PATCH    `/alerts/{alert_id}`         Update alert status/acknowledgement
  GET      `/system/health`             Backend health
  GET      `/system/data-sources`       Source freshness and status

### Buoy ingestion request example

``` json
{
  "simulation_id": "uuid",
  "buoy_code": "BUOY-001",
  "observed_at": "2026-11-18T03:00:00Z",
  "latitude": -6.105,
  "longitude": 106.850,
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

### Satellite sync request example

``` json
{
  "provider": "copernicus",
  "zone_id": "uuid",
  "date_from": "2026-11-01",
  "date_to": "2026-11-18",
  "collection": "sentinel-2-l2a",
  "max_cloud_cover_percent": 40
}
```

Treat provider names and collection IDs as configurable; verify exact
identifiers against current official documentation.

### AI analysis request example

``` json
{
  "zone_id": "uuid",
  "window_minutes": 60,
  "model_version": "cews-ml-v1"
}
```

### API rules

-   Use UTC ISO 8601 timestamps.
-   Use consistent error shape and HTTP status codes.
-   Use idempotency keys for ingestion retries.
-   Use pagination and filtering for history endpoints.
-   Validate all input with Pydantic.
-   Never expose satellite API secrets to the browser.
-   Use API authentication for ingestion and simulator-control
    endpoints.
-   Keep public read-only dashboard endpoints separate from privileged
    operations.
-   Document rate limits and retry behavior.

------------------------------------------------------------------------

## 6. Database schema

Use PostgreSQL with PostGIS. Use SQLAlchemy 2.x and Alembic migrations.

Required entities:

1.  `coastal_zones`
2.  `buoy_devices`
3.  `simulations`
4.  `buoy_observations`
5.  `satellite_datasets`
6.  `satellite_jobs`
7.  `ml_models`
8.  `ai_predictions`
9.  `alerts`
10. `data_source_status`

### Required data fields

#### coastal_zones

-   id (UUID, primary key)
-   zone_code (unique)
-   zone_name
-   description
-   boundary (MULTIPOLYGON, SRID 4326)
-   created_at

#### buoy_devices

-   id
-   buoy_code (unique)
-   zone_id (foreign key)
-   location (POINT, SRID 4326)
-   device_status
-   source_type
-   created_at

#### simulations

-   id
-   scenario
-   status
-   random_seed
-   generator_version
-   started_at
-   ended_at
-   created_at

#### buoy_observations

-   id
-   buoy_id
-   simulation_id (nullable for non-simulated future sources)
-   observed_at
-   received_at
-   processed_at
-   wave_height_m
-   wave_period_s
-   wave_direction_deg
-   wind_speed_mps
-   wind_direction_deg
-   sea_temperature_c
-   air_pressure_hpa
-   location (POINT)
-   source_type
-   validation_status
-   validation_errors (JSONB)
-   idempotency_key (unique where applicable)

#### satellite_datasets

-   id
-   zone_id
-   provider
-   collection
-   product_id
-   acquired_at
-   downloaded_at
-   processed_at
-   footprint (POLYGON/MULTIPOLYGON)
-   asset_uri
-   thumbnail_uri
-   cloud_cover_percent (nullable)
-   resolution_m (nullable)
-   crs
-   metadata (JSONB)
-   license/attribution
-   processing_status

#### satellite_jobs

-   id
-   provider
-   query_parameters (JSONB)
-   status
-   started_at
-   completed_at
-   error_message

#### ml_models

-   id
-   model_name
-   model_version
-   algorithm
-   model_uri
-   feature_schema (JSONB)
-   training_dataset
-   training_period
-   metrics (JSONB)
-   created_at

#### ai_predictions

-   id
-   zone_id
-   model_id
-   analysis_started_at
-   analysis_ended_at
-   input_observation_ids (JSONB or normalized relation)
-   anomaly_detected
-   anomaly_score
-   risk_score (nullable)
-   risk_level (nullable)
-   contributing_factors (JSONB)
-   explanation
-   recommendation
-   data_quality_summary (JSONB)
-   created_at

#### alerts

-   id
-   prediction_id
-   zone_id
-   severity
-   title
-   description
-   status
-   created_at
-   acknowledged_at
-   resolved_at

#### data_source_status

-   id
-   source_name
-   source_type
-   status
-   last_observed_at
-   last_received_at
-   last_success_at
-   last_error
-   metadata (JSONB)
-   updated_at

### Database requirements

-   Use UUID primary keys.
-   Add foreign-key constraints.
-   Add unique constraints for provider/product IDs and ingestion
    idempotency.
-   Add B-tree indexes for timestamps and foreign keys.
-   Add GiST indexes for geometry.
-   Store geometry in SRID 4326 and document coordinate order.
-   Store large raster files outside relational database; store URI and
    metadata in PostgreSQL.
-   Add migrations and seed data.
-   Keep source provenance in every observation and dataset.

------------------------------------------------------------------------

## 7. Dataset discovery and research workflow --- mandatory

The agent must actively search for datasets and verify their
suitability. Do not invent dataset names, URLs, APIs, licenses, or
availability.

### Research questions for every candidate dataset

Record: - Official dataset/product name. - Provider/organization. -
Official landing page and API documentation. - Direct access method
(API, STAC, download, WMS/WMTS, etc.). - Registration/authentication
requirement. - License and attribution requirements. - Geographic
coverage and whether it includes the selected study area. - Temporal
coverage and update frequency. - Spatial/temporal resolution. -
Variables and units. - Missing-data/cloud limitations. - Download size
and processing requirements. - Suitability for the CEWS use case. -
Whether the data is historical, near-real-time, or live. - Date accessed
and any API quota/cost.

### Dataset categories to investigate

#### A. Satellite imagery and coastal geography

-   Sentinel-2 optical imagery via Copernicus Data Space or Sentinel
    Hub.
-   Sentinel-1 SAR imagery for cloud-independent radar observations,
    subject to product availability and appropriate interpretation.
-   Copernicus DEM or other authoritative elevation products.
-   Landsat imagery for historical shoreline/context analysis where
    appropriate.
-   OpenStreetMap for base-map/context only, with proper attribution.

#### B. Ocean and meteorological context

Investigate official, documented sources such as: - BMKG open/public
information and official marine weather products, subject to access
terms and availability. - NOAA data services for relevant global
ocean/meteorological datasets. - Copernicus Marine Service for
oceanographic products, checking spatial coverage, temporal resolution,
and access requirements. - NASA POWER for meteorological/climatological
context where its variables and resolution are appropriate.

Do not treat all of these as satellite datasets. They are separate
source categories and should be stored with accurate provenance.

#### C. Elevation, coastline, and geospatial layers

-   DEM products from authoritative providers.
-   Official Indonesian geospatial data where public access and
    licensing permit.
-   Public administrative/coastal boundary layers with documented
    provenance.

#### D. ML training/evaluation data

Find suitable historical oceanographic or meteorological time series
with: - timestamp - location - wave/weather parameters - enough temporal
coverage - consistent units - known measurement or model provenance

Do not train an operational-looking model solely on arbitrary random
numbers. Synthetic data may be used for interface and pipeline testing,
but model evaluation must clearly state that it uses synthetic or
scenario-generated data if no suitable real labelled data is available.

### Dataset selection scorecard

Score each candidate from 1--5: - Scientific relevance - Geographic
fit - Temporal fit - Resolution/quality - API reliability -
License/access clarity - Ease of integration

Choose the most suitable dataset, not simply the easiest one.

### Research output

Create `docs/DATA_CATALOG.md` containing: - Dataset comparison table. -
Selected primary source and reasons. - Alternative/fallback source. -
API access instructions. - License and attribution. - Sample record and
schema mapping. - Limitations and provenance notes. - Retrieval date.

Create `docs/DATA_PROVENANCE.md` describing which UI elements use
simulated, historical, API-retrieved, or ML-derived data.

------------------------------------------------------------------------

## 8. AI-assisted research and implementation workflow

Use AI tools as engineering assistants, not as sources of scientific
truth.

For each research task: 1. Search official provider documentation first.
2. Use AI to discover candidate datasets, explain schemas, draft
integration code, and compare options. 3. Verify all claims against
primary documentation. 4. Test API access and inspect actual returned
metadata. 5. Save source URLs, retrieval date, and findings in the data
catalog. 6. Ask AI to review code and identify edge cases. 7. Run tests
and inspect outputs independently.

AI must not: - fabricate API endpoints or access credentials; - invent
dataset records; - generate fake citations; - claim that a model is
scientifically validated without evidence; - turn simulated outputs into
purported live measurements.

If web research or provider access is unavailable, mark the item
`unverified` and build a provider adapter with a clearly labelled
fixture/mock response rather than inventing a working integration.

------------------------------------------------------------------------

## 9. Frontend requirements

Use Next.js App Router, TypeScript, and a responsive layout.

### Navigation

-   Overview
-   Ocean Monitoring
-   Satellite Map
-   AI Risk Analysis
-   Alerts
-   Data Sources / System Health

### UI requirements

-   Professional maritime monitoring aesthetic.
-   Responsive desktop and mobile layout.
-   Clear distinction between simulated and external data.
-   Show last observation time and last received time.
-   Show provider, acquisition date, and source attribution for
    satellite layers.
-   Show units on every metric and chart.
-   Show empty, loading, stale, error, and offline states.
-   Map layers must have a legend and explain what each layer
    represents.
-   AI results must show model version, observation window, anomaly
    score, contributing factors, and limitations.
-   Alerts must show severity, timestamp, source, status, and
    acknowledgement history.
-   Do not use color as the only signal; pair color with text/icons.

### Functional requirements

-   Dashboard cards load from backend APIs.
-   Charts use actual stored observations.
-   Map uses stored coastal geometries and satellite footprints/layers.
-   Scenario controls call the simulator API.
-   AI analysis button calls the analysis API.
-   Alert status updates persist to database.
-   Filters and date ranges affect displayed data.
-   No dead buttons or fake interactions.

------------------------------------------------------------------------

## 10. Testing and quality gates

### Backend tests

-   Valid buoy ingestion.
-   Missing required parameter.
-   Invalid coordinates.
-   Invalid timestamp/timezone.
-   Duplicate idempotency key.
-   Satellite provider timeout.
-   Malformed provider response.
-   Unmatched satellite/buoy timestamps.
-   ML model unavailable.
-   Empty observation window.
-   Alert creation and status updates.

### ML tests

-   Reproducible training.
-   No train/test temporal leakage.
-   Correct feature ordering.
-   Missing-value handling.
-   Model serialization/loading.
-   Evaluation report.
-   Threshold calibration.
-   Prediction response schema.
-   Synthetic vs real-data provenance.

### Frontend tests

-   Dashboard loads with data.
-   Loading/error/stale states work.
-   Map renders valid geometry.
-   Charts display correct units.
-   Simulator scenario triggers backend job.
-   AI results are shown with caveats.
-   Alerts can be acknowledged.
-   Responsive layout works.

### End-to-end acceptance criteria

The MVP is acceptable only if:

1.  A buoy simulator can send data automatically and manually.
2.  Backend validates and stores buoy observations.
3.  At least one satellite/geospatial API has been researched and a
    working integration or clearly documented fallback exists.
4.  Satellite metadata and acquisition time are preserved.
5.  Buoy and satellite data can be spatially/temporally associated
    without forcing invalid matches.
6.  An ML anomaly model can load and produce reproducible outputs.
7.  Risk analysis is clearly described as prototype decision support.
8.  The frontend displays data from the backend, not hard-coded values.
9.  Provider failure does not break buoy monitoring.
10. The public website and public repository are available.
11. README, data catalog, model card, and setup instructions are
    complete.
12. No UI or documentation falsely claims operational disaster-warning
    capability.

------------------------------------------------------------------------

## 11. Documentation deliverables

Create and maintain:

-   `README.md` --- project overview, setup, architecture, environment
    variables, run commands, demo mode, deployment.
-   `docs/ARCHITECTURE.md` --- component and deployment diagrams.
-   `docs/API_CONTRACT.md` --- endpoint methods, request/response
    schemas, errors.
-   `docs/DATA_CATALOG.md` --- researched datasets and provider details.
-   `docs/DATA_PROVENANCE.md` --- source type and limitations for each
    displayed field.
-   `docs/AI_MODEL_CARD.md` --- model purpose, training data, features,
    metrics, limitations, intended use.
-   `docs/DATABASE_SCHEMA.md` --- ERD, tables, indexes, migrations.
-   `docs/TEST_PLAN.md` --- test cases and results.
-   `docs/DEMO_SCRIPT.md` --- 3--5 minute video narration and click
    path.
-   `docs/COMPETITION_CHECKLIST.md` --- every IT RUSH submission
    requirement.
-   `LICENSE` --- choose an appropriate project license after team
    confirmation.
-   `.env.example` --- variable names only, no secrets.

Disclose all third-party libraries, templates, open-source assets, and
AI coding assistants in README and proposal, as required by the
guidebook.

------------------------------------------------------------------------

## 12. Deployment and repository rules

-   Frontend: deploy to Vercel or equivalent.
-   Backend: deploy to a Python-compatible hosting service.
-   Database: use managed PostgreSQL with PostGIS.
-   Store secrets in hosting environment variables.
-   Configure production CORS explicitly.
-   Use HTTPS.
-   Add health-check endpoint.
-   Add database backups/export before final submission.
-   Ensure the live site remains available through 30 November 2026.
-   Repository must be public.
-   Never rewrite/delete commit history to disguise work.
-   Commit in meaningful increments.

Suggested environment variables:

``` env
DATABASE_URL=
SATELLITE_PROVIDER=
SATELLITE_API_BASE_URL=
SATELLITE_CLIENT_ID=
SATELLITE_CLIENT_SECRET=
API_SECRET_KEY=
CORS_ORIGINS=
SIMULATOR_DEFAULT_INTERVAL_SECONDS=60
DEMO_MODE=true
```

Do not commit real `.env` files.

------------------------------------------------------------------------

## 13. Competition demo plan (3--5 minutes)

Suggested 4-minute flow:

1.  **0:00--0:25 --- Introduction:** team, project name, selected
    subtheme, problem.
2.  **0:25--0:55 --- Architecture:** explain buoy simulator + satellite
    API + backend + ML + dashboard.
3.  **0:55--1:35 --- Ocean monitoring:** show buoy data, units,
    timestamp, and source label.
4.  **1:35--2:05 --- Satellite map:** show real sourced/historical
    geospatial layer, acquisition date, and attribution.
5.  **2:05--2:55 --- AI demo:** trigger a warning/extreme simulation,
    show anomaly result, model version, contributing factors, and
    caveats.
6.  **2:55--3:30 --- Alert management:** show generated prototype alert
    and acknowledgement.
7.  **3:30--4:00 --- Impact and closing:** explain intended benefit for
    coastal users and limitations.

The video must be 3--5 minutes and unlisted on YouTube according to the
guidebook.

------------------------------------------------------------------------

## 14. Agent execution strategy

When starting work in a repository:

### First inspect

-   List files and existing project structure.
-   Read package manifests and environment examples.
-   Identify existing code that should be reused.
-   Check current deployment and repository status.
-   Do not overwrite working code without understanding it.

### Then execute in small, verifiable milestones

**Milestone 1:** repository scaffold, architecture docs, environment
setup.

**Milestone 2:** buoy simulator, JSON schema, scenario tests.

**Milestone 3:** satellite provider research, data catalog, connector,
cached fixture.

**Milestone 4:** FastAPI ingestion, validation, synchronization,
database migrations.

**Milestone 5:** ML dataset preparation, model training, evaluation,
model card.

**Milestone 6:** analytics API, alert workflow.

**Milestone 7:** frontend pages and API integration.

**Milestone 8:** integration tests, deployment, competition
documentation.

At the end of each milestone: - Run relevant tests. - Report changed
files. - Report commands executed and results. - List unresolved risks
and assumptions. - Do not claim completion if tests or integrations were
not run.

### Prioritization rule

If time is constrained, prioritize a reliable vertical slice:

**simulated buoy → validated API ingestion → database → ML anomaly
inference → dashboard visualization.**

Then add satellite API integration with verified metadata and cached
fallback. Do not sacrifice a working end-to-end system for a large
number of unfinished features.

------------------------------------------------------------------------

## 15. Final definition of done

CEWS is ready for competition submission only when:

-   [ ] Public website works without developer intervention.
-   [ ] Public repository exists with intact commit history.
-   [ ] Buoy automatic and manual simulation both work.
-   [ ] Buoy observations have provenance and timestamps.
-   [ ] Satellite API/provider has been researched and its actual access
    status documented.
-   [ ] Satellite data has acquisition metadata and attribution.
-   [ ] Database migrations run from a clean database.
-   [ ] ML model is reproducible and its limitations are documented.
-   [ ] AI analysis is genuinely executed by the backend model.
-   [ ] Risk outputs are not misrepresented as official warnings.
-   [ ] Dashboard reads from APIs and database.
-   [ ] Error, stale-data, and provider-outage states are handled.
-   [ ] README and technical documentation are complete.
-   [ ] Third-party and AI-tool use is disclosed.
-   [ ] Proposal PDF is complete.
-   [ ] Originality and AI declaration is complete.
-   [ ] Unlisted 3--5 minute demo video is complete.
-   [ ] All required registration and submission documents are checked.
-   [ ] Website remains available through 30 November 2026.

**Build the smallest scientifically honest, fully working CEWS first.
Expand only after the end-to-end path is reliable.**

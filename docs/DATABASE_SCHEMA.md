# Database schema

- Production: **PostgreSQL + PostGIS**, geometry `SRID 4326` (lon/lat order).
- Local demo / tests: **SQLite**, geometry stored as WKT via a dialect-aware type decorator.
- ORM: SQLAlchemy 2.x declarative models; migrations: Alembic.
- UUID primary keys everywhere; foreign keys enforced (`PRAGMA foreign_keys=ON` on SQLite).

## 1. ER diagram

```mermaid
erDiagram
  COASTAL_ZONES ||--o{ BUOY_DEVICES : contains
  COASTAL_ZONES ||--o{ SIMULATIONS : scopes
  COASTAL_ZONES ||--o{ SATELLITE_DATASETS : covers
  COASTAL_ZONES ||--o{ SATELLITE_JOBS : targets
  COASTAL_ZONES ||--o{ AI_PREDICTIONS : assesses
  COASTAL_ZONES ||--o{ ALERTS : raises
  BUOY_DEVICES ||--o{ BUOY_OBSERVATIONS : emits
  SIMULATIONS ||--o{ BUOY_OBSERVATIONS : generates
  ML_MODELS ||--o{ AI_PREDICTIONS : produces
  AI_PREDICTIONS ||--o{ ALERTS : explains

  COASTAL_ZONES {
    uuid id PK
    string zone_code UK
    string zone_name
    text description
    geometry boundary "MULTIPOLYGON 4326"
    string boundary_note
    timestamptz created_at
  }
  BUOY_DEVICES {
    uuid id PK
    string buoy_code UK
    uuid zone_id FK
    geometry location "POINT 4326"
    string device_status
    string source_type
    timestamptz created_at
  }
  SIMULATIONS {
    uuid id PK
    string scenario
    string mode
    string status
    int random_seed
    string generator_version
    uuid zone_id FK
    int interval_seconds
    int observations_count
    text notes
    timestamptz started_at
    timestamptz ended_at
    timestamptz created_at
  }
  BUOY_OBSERVATIONS {
    uuid id PK
    uuid buoy_id FK
    uuid simulation_id FK
    timestamptz observed_at
    timestamptz received_at
    timestamptz processed_at
    float wave_height_m
    float wave_period_s
    float wave_direction_deg
    float wind_speed_mps
    float wind_direction_deg
    float sea_temperature_c
    float air_pressure_hpa
    geometry location "POINT 4326"
    string source_type
    string scenario
    string generator_version
    string validation_status
    json validation_errors
    string idempotency_key UK
    timestamptz created_at
  }
  SATELLITE_DATASETS {
    uuid id PK
    uuid zone_id FK
    string provider
    string collection
    string product_id
    timestamptz acquired_at
    timestamptz downloaded_at
    timestamptz processed_at
    geometry footprint "POLYGON 4326"
    text asset_uri
    text thumbnail_uri
    float cloud_cover_percent
    float resolution_m
    string crs
    json metadata
    string license
    text attribution
    string processing_status
    timestamptz created_at
  }
  SATELLITE_JOBS {
    uuid id PK
    string provider
    uuid zone_id FK
    json query_parameters
    string status
    int datasets_found
    int datasets_stored
    bool used_cache
    json warnings
    timestamptz started_at
    timestamptz completed_at
    text error_message
    timestamptz created_at
  }
  ML_MODELS {
    uuid id PK
    string model_name
    string model_version UK
    string algorithm
    text model_uri
    json feature_schema
    text training_dataset
    string training_period
    json metrics
    bool is_active
    timestamptz created_at
  }
  AI_PREDICTIONS {
    uuid id PK
    uuid zone_id FK
    uuid model_id FK
    string model_version
    timestamptz analysis_started_at
    timestamptz analysis_ended_at
    timestamptz observation_window_start
    timestamptz observation_window_end
    json input_observation_ids
    json matched_satellite_dataset_ids
    int windows_evaluated
    bool anomaly_detected
    float anomaly_score
    float anomaly_threshold
    float risk_score
    string risk_level
    json contributing_factors
    text explanation
    text recommendation
    json caveats
    json data_quality_summary
    bool is_simulated
    timestamptz created_at
  }
  ALERTS {
    uuid id PK
    uuid prediction_id FK
    uuid zone_id FK
    string severity
    string title
    text description
    string status
    string source
    timestamptz created_at
    timestamptz acknowledged_at
    string acknowledged_by
    timestamptz resolved_at
  }
  DATA_SOURCE_STATUS {
    uuid id PK
    string source_name UK
    string source_type
    string status
    timestamptz last_observed_at
    timestamptz last_received_at
    timestamptz last_success_at
    text last_error
    json metadata
    timestamptz updated_at
  }
```

## 2. Constraints and indexes

| Table | Constraint / index | Purpose |
| --- | --- | --- |
| `coastal_zones` | `zone_code` unique | Stable zone lookup |
| `buoy_devices` | `buoy_code` unique; FK `zone_id`; index `zone_id` | Device identity |
| `buoy_observations` | unique `(buoy_id, observed_at)`; unique `idempotency_key`; index `observed_at`; index `(source_type, observed_at)`; FK `buoy_id`, `simulation_id` | Duplicate prevention + history queries |
| `satellite_datasets` | unique `(provider, product_id)`; index `acquired_at`, `product_id`, `zone_id` | Idempotent catalogue sync |
| `satellite_jobs` | FK `zone_id`; index on zone | Job tracking |
| `ml_models` | unique `model_version` | Registry |
| `ai_predictions` | FK `zone_id`, `model_id`; indexes | Latest/history queries |
| `alerts` | FK `prediction_id`, `zone_id`; index `status` | Lifecycle filters |
| `data_source_status` | unique `source_name` | Freshness table |
| PostGIS geometry columns | GiST indexes created by migration | Spatial queries (production) |

## 3. Geometry handling

`backend/app/db/types.py` defines a `Geometry` `TypeDecorator`:

- On **PostgreSQL** it renders `geoalchemy2.Geometry(POINT|POLYGON|MULTIPOLYGON, srid=4326)` and
  binds Shapely geometries through GeoAlchemy2.
- On **SQLite** it renders `TEXT` and stores WKT, returning Shapely objects to the application.
- API responses always convert geometry to GeoJSON.

Zone boundaries are approximate prototype polygons. The UI displays a `boundary_note` on every
zone making that explicit. They are **not** official administrative or forecast boundaries.

## 4. Migrations

```bash
cd backend
export DATABASE_URL="postgresql+psycopg://user:pass@host:5432/cews"
python -m alembic upgrade head
```

`alembic/versions/0001_initial.py`:

1. creates the PostGIS extension on PostgreSQL,
2. creates all tables from the SQLAlchemy metadata (works for SQLite too),
3. creates GiST indexes on zone boundaries, device locations, observation locations and satellite
   footprints on PostgreSQL.

Trade-off: the initial revision uses `metadata.create_all` rather than hand-written `op.create_table`
calls. It is idempotent and dialect-aware; future schema changes should be generated with
`alembic revision --autogenerate`. The PostgreSQL/PostGIS branch has **not** been executed against a
live PostgreSQL instance in this environment — verify during deployment.

## 5. Seed data

`app/db/seed.py` runs on API startup if no zones exist (also callable via
`python scripts/bootstrap_demo.py`):

- 3 zones: `JKT-BAY` (Jakarta Bay), `SMR-UTC` (Semarang Coast), `MKS-STR` (Makassar Strait), each
  with an approximate bounding `MULTIPOLYGON` and one virtual buoy.
- 8 hours of synthetic 5-minute telemetry per buoy, deterministic seed selected so the baseline
  window contains no injected spike.
- Model registry row from the committed artifact metrics and reference data-source rows.

Idempotent: re-running does not duplicate zones. To regenerate the demo database:

```bash
rm -f data/cews.db data/cews.db-wal data/cews.db-shm
python backend/scripts/bootstrap_demo.py
```

## 6. Backup / export

```bash
# PostgreSQL
pg_dump "$DATABASE_URL" > cews_backup_$(date +%F).sql

# SQLite demo
python -c "import sqlite3,shutil;src=sqlite3.connect('data/cews.db');dst=sqlite3.connect('data/cews_backup.db');src.backup(dst)"
```

Cached quicklooks live in `data/satellite/` and are not stored in the database; back them up with the
database if the demo must keep its imagery.

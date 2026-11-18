# Skema basis data

- Produksi: **PostgreSQL + PostGIS**, geometri `SRID 4326` (urutan lon/lat).
- Demo lokal / pengujian: **SQLite**, geometri disimpan sebagai WKT melalui type decorator yang sadar
  dialek.
- ORM: model deklaratif SQLAlchemy 2.x; migrasi: Alembic.
- Primary key UUID di semua tabel; foreign key ditegakkan (`PRAGMA foreign_keys=ON` pada SQLite).

## 1. Diagram ER

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

## 2. Batasan dan index

| Tabel | Batasan / index | Tujuan |
| --- | --- | --- |
| `coastal_zones` | `zone_code` unique | Pencarian zona yang stabil |
| `buoy_devices` | `buoy_code` unique; FK `zone_id`; index `zone_id` | Identitas perangkat |
| `buoy_observations` | unique `(buoy_id, observed_at)`; unique `idempotency_key`; index `observed_at`; index `(source_type, observed_at)`; FK `buoy_id`, `simulation_id` | Pencegahan duplikat + kueri riwayat |
| `satellite_datasets` | unique `(provider, product_id)`; index `acquired_at`, `product_id`, `zone_id` | Sinkronisasi katalog yang idempoten |
| `satellite_jobs` | FK `zone_id`; index pada zone | Pelacakan job |
| `ml_models` | unique `model_version` | Registry |
| `ai_predictions` | FK `zone_id`, `model_id`; index | Kueri terbaru/riwayat |
| `alerts` | FK `prediction_id`, `zone_id`; index `status` | Filter siklus hidup |
| `data_source_status` | unique `source_name` | Tabel kesegaran |
| Kolom geometri PostGIS | Index GiST dibuat oleh migrasi | Kueri spasial (produksi) |

## 3. Penanganan geometri

`backend/app/db/types.py` mendefinisikan sebuah `Geometry` `TypeDecorator`:

- Pada **PostgreSQL** ia merender `geoalchemy2.Geometry(POINT|POLYGON|MULTIPOLYGON, srid=4326)` dan
  mengikat geometri Shapely melalui GeoAlchemy2.
- Pada **SQLite** ia merender `TEXT` dan menyimpan WKT, mengembalikan objek Shapely ke aplikasi.
- Respons API selalu mengonversi geometri ke GeoJSON.

Batas zona adalah poligon pemantauan yang bersifat perkiraan. UI menampilkan `boundary_note` pada
setiap zona sebagai catatan area pemantauan.

## 4. Migrasi

```bash
cd backend
export DATABASE_URL="postgresql+psycopg://user:pass@host:5432/cews"
python -m alembic upgrade head
```

`alembic/versions/0001_initial.py`:

1. membuat ekstensi PostGIS pada PostgreSQL,
2. membuat semua tabel dari metadata SQLAlchemy (juga berfungsi untuk SQLite),
3. membuat index GiST pada batas zona, lokasi perangkat, lokasi observasi dan footprint satelit pada
   PostgreSQL.

Trade-off: revisi awal menggunakan `metadata.create_all` alih-alih panggilan `op.create_table` yang
ditulis tangan. Revisi itu idempoten dan sadar dialek; perubahan skema di masa depan sebaiknya
dihasilkan dengan `alembic revision --autogenerate`. Cabang PostgreSQL/PostGIS **belum** dieksekusi
terhadap instance PostgreSQL yang aktif di lingkungan ini — verifikasi saat penerapan.

## 5. Data seed

`app/db/seed.py` berjalan saat startup API jika belum ada zona (juga dapat dipanggil melalui
`python scripts/bootstrap_demo.py`):

- 3 zona: `JKT-BAY` (Teluk Jakarta), `SMR-UTC` (Pantai Semarang), `MKS-STR` (Selat Makassar),
  masing-masing dengan `MULTIPOLYGON` pembatas perkiraan dan satu buoy virtual.
- 8 jam telemetri sintetis berinterval 5 menit per buoy, seed deterministik dipilih agar jendela
  baseline tidak memuat lonjakan yang disuntikkan.
- Baris registry model dari metrik artefak yang di-commit serta baris sumber data referensi.

Idempoten: menjalankan ulang tidak menggandakan zona. Untuk meregenerasi basis data demo:

```bash
rm -f data/cews.db data/cews.db-wal data/cews.db-shm
python backend/scripts/bootstrap_demo.py
```

## 6. Backup / ekspor

```bash
# PostgreSQL
pg_dump "$DATABASE_URL" > cews_backup_$(date +%F).sql

# SQLite demo
python -c "import sqlite3,shutil;src=sqlite3.connect('data/cews.db');dst=sqlite3.connect('data/cews_backup.db');src.backup(dst)"
```

Quicklook yang di-cache berada di `data/satellite/` dan tidak disimpan di basis data; cadangkan
bersamaan dengan basis data jika demo harus mempertahankan citranya.

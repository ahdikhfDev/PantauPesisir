# Arsitektur

PantauPesisir adalah monolit modular: satu backend FastAPI, satu frontend Next.js, satu basis data
relasional (PostgreSQL/PostGIS di produksi, SQLite untuk demo) dan satu artefak model. Tidak ada
mikroservis.

## 1. Komponen

```mermaid
flowchart LR
  subgraph Sources
    SIM[Gateway telemetri<br/>buoy tervalidasi]
    STAC[Copernicus CDSE STAC<br/>real Sentinel-2 metadata]
    NDBC[NOAA NDBC archive<br/>real training rows]
  end

  subgraph Backend["FastAPI modular monolith"]
    ING[Ingestion router<br/>API key + rate limit]
    VAL[Validation service]
    TSP[Time alignment service]
    SAT[Satellite adapter<br/>provider-agnostic]
    JOB[Job manager<br/>simulation / satellite]
    ANA[Analytics service]
    ALR[Alert service]
    SRC[Source status service]
    ML[Isolation Forest<br/>+ rubric]
  end

  DB[(PostgreSQL + PostGIS<br/>SQLite demo)]
  CACHE[Local quicklook cache<br/>data/satellite]
  UI[Next.js dashboard<br/>Leaflet · Recharts]

  SIM --> ING
  ING --> VAL --> DB
  VAL --> SRC --> DB
  STAC --> SAT --> CACHE
  SAT --> DB
  NDBC -. offline training .-> ML
  DB --> TSP --> ANA
  CACHE --> UI
  ML --> ANA --> DB
  ANA --> ALR --> DB
  DB --> UI
  UI -- X-API-Key --> ING
  UI -- X-API-Key --> JOB
  UI -- X-API-Key --> SAT
  UI -- X-API-Key --> ANA
```

### Lapisan

| Lapisan | Modul | Tanggung jawab |
| --- | --- | --- |
| Sumber | `app/services/simulator.py` | Deret telemetri yang koheren, profil kondisi, mode batch + interval, seed deterministik |
| Sumber | `app/services/satellite/` | Protokol penyedia, adapter Copernicus STAC, caching thumbnail, fallback |
| Integrasi | `app/services/ingestion.py` | Jalur ingesti tunggal yang dipakai oleh API, gateway telemetri, dan seed |
| Integrasi | `app/services/validation.py` | Kewajaran, zona waktu, posisi, provenans, duplikat |
| Integrasi | `app/services/time_sync.py` | Asosiasi 30 menit, ringkasan kualitas |
| Analitik | `app/ml/` | Fitur, kalibrasi, ambang, penilaian skor, rubrik |
| Analitik | `app/services/analytics.py` | Pemilihan jendela, persistensi, penjelasan, pembuatan peringatan |
| Aplikasi | `app/api/v1/routers/` | Pembacaan publik, penulisan berhak istimewa, OpenAPI |
| Aplikasi | `frontend/` | Shell aplikasi dasbor (sidebar, bilah status) + enam ruang kerja yang membaca dari API |

## 2. Urutan ingesti

```mermaid
sequenceDiagram
  participant S as Gateway telemetri / client
  participant A as POST /ingestion/buoy
  participant V as Validation
  participant D as Database
  participant H as Data-source status

  S->>A: observation + X-API-Key + idempotency key
  A->>A: Pydantic structure + timezone check (422 on failure)
  A->>D: lookup buoy and zone (404 if unknown)
  A->>D: duplicate lookup by key or (buoy, observed_at)
  alt duplicate
    D-->>A: existing row
    A-->>S: 200 accepted=false duplicate=true
  else new
    A->>V: ranges, distance, envelope, provenance
    V-->>A: valid | invalid + error list
    A->>D: INSERT (invalid rows are kept for audit)
    A->>H: update last_observed/received/success
    A-->>S: 201 validation_status
  end
```

## 3. Akuisisi satelit

```mermaid
sequenceDiagram
  participant U as UI / operator
  participant A as POST /satellite/sync
  participant J as Background job
  participant P as Copernicus STAC
  participant C as Quicklook host
  participant D as Database

  U->>A: zone, date range, max cloud, max products
  A->>D: INSERT satellite_jobs (queued)
  A-->>U: 202 + job id
  A->>J: run_job
  J->>P: GET /search (bbox, datetime, collection)
  P-->>J: features + geometry + cloud + assets
  loop each product
    J->>C: GET thumbnail (follow redirects, validate JPEG/PNG, ≤5 MB)
    J->>D: UPSERT satellite_datasets (unique provider+product)
  end
  J->>D: job completed, source status online
  U->>A: GET /satellite/jobs/{id}
  A-->>U: status, found/stored counts, warnings
```

Jika penyedia tidak tersedia, job berakhir `completed_with_fallback`, sumber menjadi `unavailable`
dan dataset yang di-cache tetap terlihat tanpa perubahan. Pemantauan buoy dan analitik tidak
bergantung pada ketersediaan satelit.

## 4. Analisis AI

```mermaid
flowchart TB
  O[Valid observations<br/>last N minutes] --> F[Feature frame<br/>trailing only]
  F --> ISO[IsolationForest score_samples]
  ISO --> C[Logistic calibration<br/>0.5 = operating threshold]
  F --> RU[Absolute risk rubric]
  C --> P[AIPrediction row]
  RU --> P
  F --> Q[Data-quality summary]
  S[Satellite datasets in zone] --> TS[30-min association]
  TS --> P
  Q --> P
  P --> AL{moderate/high?}
  AL -- yes --> A[Alert row<br/>deduped 30 min]
  AL -- no --> N[No alert]
```

## 5. Keputusan desain utama

1. **Provenans di dalam skema, bukan di prosa.** `source_type`, `validation_status`,
   `validation_errors`, `simulation_id`, `idempotency_key`, timestamp akuisisi dan atribusi
   disimpan per baris dan ditampilkan di UI.
2. **Jam yang terpisah.** `observed_at`, `received_at`, `processed_at` tidak pernah dicampur.
3. **Tidak valid ≠ dihapus.** Baris di luar rentang disimpan dengan `validation_status="invalid"` dan
   dikecualikan dari grafik/analitik.
4. **Fitur yang sadar irama.** Model harus bertransfer dari irama NDBC 10 menit ke telemetri
   1–10 menit. Deviasi relatif dan laju per jam menggantikan statistik sampel-ke-sampel mentah.
5. **Kalibrasi bersifat eksplisit.** Ambang operasional di-fit pada jendela skenario normal yang
   terdokumentasi; metadata kalibrasi menyertai artefak dan ditampilkan di UI.
6. **Model ≠ risiko.** Skor anomali mengukur perilaku yang tidak biasa; rubrik menilai tingkat
   keparahan absolut. Keduanya dapat diperiksa secara independen.
7. **Geometri yang sadar dialek.** `app/db/types.py` menyimpan geometri Shapely sebagai PostGIS
   POINT/POLYGON/MULTIPOLYGON pada PostgreSQL dan teks WKT pada SQLite, sehingga satu lapisan model
   melayani keduanya.
8. **Fail closed pada penulisan.** Endpoint berhak istimewa mewajibkan `X-API-Key`; jika tidak ada
   key yang dikonfigurasi, API mengembalikan 503 alih-alih mengizinkan penulisan anonim.
9. **Panggilan penyedia yang terbatas.** Timeout, batas ukuran respons, pemeriksaan content-type dan
   jenis error eksplisit (`timeout`, `network`, `http`, `malformed`) untuk degradasi yang dapat
   ditindaklanjuti.
10. **Koherensi demo.** Burst skenario manual menggantikan pembacaan sebelumnya di dalam
    jendela replay-nya dan mencatat jumlah yang digantikan pada catatan job, sehingga grafik tidak
    pernah mencampur dua alur cerita. Baris nyata/teramati tidak pernah disentuh oleh aturan ini.

## 6. Topologi runtime

```mermaid
flowchart LR
  B[Browser] -->|HTTPS| F[Next.js / Vercel]
  F -->|HTTPS JSON| A[FastAPI / Python host]
  A -->|SQL| P[(PostgreSQL + PostGIS)]
  A -->|STAC search| C[Copernicus CDSE]
  A -->|thumbnail| Q[Quicklook host]
  A -->|read artifact| M[cews-iforest-v1.joblib]
  A -->|cache JPEG| D[data/satellite]
```

Demo lokal: `uvicorn` pada :8000, `next dev` pada :3000, SQLite di `data/cews.db`, quicklook yang
di-cache di `data/satellite/`.

## 7. Postur keamanan

- Secret hanya melalui variabel environment (`.env`, di-gitignore).
- Key demo publik memang disengaja dan terdokumentasi; produksi merotasi `API_SECRET_KEY` dan
  menonaktifkan `DEMO_MODE`.
- CORS dibatasi pada origin yang dikonfigurasi; metode dan header eksplisit.
- Rate limit ingesti (sliding window per proses) mengembalikan 429 dengan `Retry-After`.
- Jalur thumbnail di-resolve dan dibatasi pada direktori cache sebelum disajikan.
- Kredensial satelit (`SATELLITE_CLIENT_ID/SECRET`) tersedia untuk pengunduhan terautentikasi di masa
  depan tetapi tidak dipakai dan tidak pernah dikirim ke browser.
- Respons API tidak pernah menyertakan kredensial penyedia atau jalur filesystem lokal kecuali jalur
  artefak model di `/analytics/model-info` (informasi administratif).

## 8. Mode kegagalan

| Kegagalan | Perilaku |
| --- | --- |
| Timeout penyedia / 5xx / JSON malformed | Job gagal atau fallback ke cache; sumber `unavailable`; daftar peringatan |
| Pengunduhan thumbnail gagal | Dataset disimpan `metadata_only`; job tetap selesai dengan peringatan |
| Artefak model hilang/rusak | `/analytics/run` mengembalikan 503; health menampilkan `degraded` |
| Jendela observasi kosong | `/analytics/run` mengembalikan 422 dengan instruksi untuk menghasilkan data |
| Ingesti duplikat | 200 dengan `duplicate: true`, tanpa baris kedua |
| Pengukuran tidak valid | 201 dengan `validation_status: invalid`, disimpan untuk audit |
| Pelanggaran transisi peringatan | 409 dengan siklus hidup yang diizinkan |
| Basis data tidak dapat dijangkau | Health `degraded`; UI menampilkan status error dengan retry |

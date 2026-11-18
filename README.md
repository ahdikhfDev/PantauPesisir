# PantauPesisir — Konsol Pemantauan Pesisir

Konsol pemantauan pesisir yang dapat diterapkan, menggabungkan **pipeline telemetri buoy**, **metadata
akuisisi Copernicus Sentinel-2 yang nyata**, **backend FastAPI + PostgreSQL/PostGIS**, dan **penyaringan
anomali berbasis machine learning** dengan rubrik risiko transparan — disajikan dalam dasbor operasional Next.js.

> **Pendukung keputusan, bukan otoritas.** PantauPesisir adalah demonstrator kompetisi mahasiswa. Ini
> bukan sistem peringatan tsunami operasional, bukan sistem prakiraan tersertifikasi, dan bukan
> pengganti BMKG, BPBD, otoritas pelabuhan, atau sumber resmi mana pun.
>
> **Provenans data.** Metadata satelit dan thumbnail adalah akuisisi historis Copernicus yang nyata.
> Model dilatih pada observasi NOAA NDBC yang nyata. Untuk demonstrasi yang reprodusibel, telemetri
> buoy dihasilkan oleh generator deret waktu internal; jalur ingesti, gerbang validasi, dan catatan
> provenans sama dengan yang dipakai untuk perangkat lapangan, sehingga gateway mitra dapat
> menggantikan generator tanpa perubahan UI atau skema.
>
> **Status pengumpulan:** kode sumber lengkap, 37 pengujian otomatis lulus, video demo telah dibuat
> (`docs/DEMO_VIDEO.md`); langkah deployment publik ada di bagian 9.

---

## 1. Apa yang benar-benar berfungsi

| Kapabilitas | Implementasi | Terverifikasi |
| --- | --- | --- |
| Simulator buoy sintetis yang koheren | Generator bergaya AR(1) deterministik, 3 skenario, burst manual + loop interval otomatis, namespace `simulation_id` terpisah | ✅ pengujian + live |
| Ingesti tervalidasi | Pydantic + rentang kelayakan + pemeriksaan zona waktu + pemeriksaan provenans + pencegahan duplikat + karantina baris tidak valid | ✅ 8 pengujian |
| Konektor satelit nyata | Pencarian STAC Copernicus Data Space Ecosystem (tanpa autentikasi) + thumbnail quicklook di-cache lokal + metadata provenans | ✅ live, 7+ rekaman |
| Penyelarasan waktu | Jendela prototipe 30 menit yang dapat dikonfigurasi; dataset yang tidak cocok tetap disimpan | ✅ pengujian |
| Deteksi anomali | Isolation Forest scikit-learn yang dilatih pada 41,104 observasi NOAA NDBC nyata | ✅ artefak reprodusibel |
| Penilaian risiko prototipe | `prototype_rubric_v1` transparan atas gelombang/angin/tekanan/periode absolut | ✅ pengujian |
| Penjelasan AI | Faktor penyumbang, jendela, versi model, keterbatasan, kualitas data | ✅ live |
| Peringatan | Siklus hidup tersimpan open → acknowledged → resolved, deduplikasi, dilindungi API key | ✅ pengujian + live |
| Degradasi | Metadata satelit di-cache dengan tanggal akuisisi asli; status kegagalan penyedia yang eksplisit | ✅ pengujian |
| Dasbor | 6 halaman responsif yang hanya membaca dari API | ✅ diperiksa di browser |
| PWA | Manifest + ikon 192/512/maskable, service worker (app-shell + cache runtime), halaman offline, pintasan aplikasi | ✅ build + endpoint |

Semua yang terlihat di UI terhubung ke backend. Tidak ada metrik placeholder, tidak ada grafik
hard-coded, dan tidak ada tombol mati: kontrol istimewa memerlukan kunci demo API yang didokumentasikan.

### PWA dan aset merek

PantauPesisir dapat dipasang sebagai aplikasi (Chrome/Edge: “Instal aplikasi”, Safari iOS: “Tambah ke
Layar Utama”). Service worker menyimpan app-shell halaman utama dan aset statis, lalu menampilkan
halaman `/offline` bila jaringan terputus. Permintaan ke `/api/*` **tidak pernah** di-cache agar data
operasional selalu segar; service worker hanya aktif pada build produksi.

Aset merek tersedia di `frontend/public/brand/` (`mark.svg`, `logo.svg`) dan ikon PWA di
`frontend/public/icons/` (192, 512, dan maskable 512).

## 2. Konsol

PantauPesisir adalah aplikasi dasbor dengan kerangka ruang kerja persisten (sidebar + bilah status),
bukan halaman pendaratan pemasaran. Setiap layar membaca data API langsung; aksi istimewa memakai
kunci demo yang didokumentasikan.

![Ringkasan operasional PantauPesisir](docs/screenshots/overview.png)

| Rute | Ruang kerja |
| --- | --- |
| **`/` Ringkasan** | Baris KPI (titik buoy, rata-rata gelombang, peringatan terbuka, rekaman satelit, model), grafik keadaan laut dengan cakupan per zona/rata-rata, daftar status zona, snapshot AI dengan faktor penyumbang, antrean peringatan, kesegaran sumber dan status simulator |
| **`/ocean`** | Telemetri tujuh parameter, grafik gelombang/angin dan tekanan/periode, tabel pembacaan, panel provenans lengkap, kontrol simulator |
| **`/satellite`** | Peta Leaflet (poligon zona, buoy, footprint Sentinel-2), formulir sinkronisasi STAC nyata, galeri akuisisi dengan quicklook, tutupan awan, CRS dan atribusi |
| **`/ai`** | Kartu model, formulir eksekusi, indeks anomali pada skala ambang terkalibrasi, skor risiko, faktor penyumbang, rekomendasi, keterbatasan dan riwayat analisis |
| **`/alerts`** | Alur kerja peringatan yang dapat difilter dengan pengakuan dan penyelesaian |
| **`/sources`** | Kesehatan database/model/simulator/penyedia, kesegaran sumber, gerbang validasi, lineage dan permukaan API publik |

Tangkapan layar lainnya: [ocean](docs/screenshots/ocean.png) ·
[satellite](docs/screenshots/satellite.png) · [AI](docs/screenshots/ai.png) ·
[alerts](docs/screenshots/alerts.png) · [sources](docs/screenshots/sources.png) ·
[mobile](docs/screenshots/mobile.png).

### Model akses

Tidak ada **login**. Layar hanya-baca bersifat publik. Tiga jalur tulis — ingesti buoy, skenario
simulator, sinkronisasi satelit, eksekusi analisis dan transisi peringatan — memerlukan header demo
yang didokumentasikan `X-API-Key: pantaupesisir-demo-2026`, yang sengaja dibuat publik dalam
prototipe ini agar juri dapat mencoba setiap kontrol. Kunci disimpan di `sessionStorage`, tidak
pernah di cookie atau akun.

### Bahasa visual

Satu sistem, diterapkan secara konsisten: permukaan kertas hangat (`#f4f2ec`), chrome tinta laut
dalam (`#123f46`), satu **merah sinyal** (`#d93a2b`) yang dikhususkan untuk risiko, simulasi dan
perhatian — tidak pernah untuk dekorasi. Tipografi memakai Manrope untuk antarmuka, Space Grotesk
untuk judul tampilan, JetBrains Mono untuk setiap angka agar kolom sejajar. Provenans data selalu
diberi label teks (`Telemetri buoy`, `Satelit · historis`, `Keluaran model`), tidak pernah warna saja.
Gerak dibatasi pada reveal singkat saat pemuatan dan dinonaktifkan pada `prefers-reduced-motion`.

## 3. Mulai cepat

Prasyarat: Python 3.12+, Node.js 20+ (npm), Docker tidak diperlukan untuk demo.
Database demo adalah SQLite; target produksi adalah PostgreSQL + PostGIS.

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

Dokumentasi API: <http://localhost:8000/docs> · health: <http://localhost:8000/api/v1/system/health>

Buat `.env` dari `.env.example` terlebih dahulu (backend membacanya dari root repositori). Untuk demo
yang memperbarui diri sendiri, set `SIMULATOR_AUTOSTART=true` dan `SIMULATOR_ZONE_CODE=ALL`.

### 3.2 Frontend

```bash
cd frontend
cp .env.local.example .env.local     # sets API base + public demo key
npm install
npm run dev                          # http://localhost:3000
```

### 3.3 Kunci demo API

`DEMO_MODE=true` mengaktifkan kunci demo publik yang didokumentasikan:

```
pantaupesisir-demo-2026
```

Kunci ini **hanya** membuka ingesti, kontrol simulator, sinkronisasi satelit, eksekusi analisis dan
pembaruan peringatan. Kunci sengaja terlihat di browser (`NEXT_PUBLIC_DEMO_API_KEY`) dan di README
ini. Deployment nyata harus merotasi `API_SECRET_KEY` dan menonaktifkan `DEMO_MODE` untuk akses
operator sesungguhnya; kunci demo bukan kredensial produksi istimewa.

### 3.4 Pengujian

```bash
cd backend
python -m pytest -q
# 37 passed (SQLite, isolated temp database, seeded fixtures)
```

Bangun ulang model dan periksa kewajarannya:

```bash
python scripts/train_model.py --version cews-iforest-v1
python scripts/check_model_behavior.py
```

## 4. Ringkasan arsitektur

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

Detail dan diagram: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## 5. Sumber data (terverifikasi 2026-11-18)

| Sumber | Yang digunakan PantauPesisir | Akses | Lisensi / atribusi | Terverifikasi |
| --- | --- | --- | --- | --- |
| **Copernicus Data Space Ecosystem — Sentinel-2 L2A STAC** | Metadata produk, footprint, waktu akuisisi, tutupan awan, CRS, thumbnail quicklook. **Tanpa unduhan raster.** | `GET https://stac.dataspace.copernicus.eu/v1/search`, tanpa autentikasi | Data Sentinel gratis dan terbuka di bawah ketentuan Copernicus Data Space Ecosystem; "Contains modified Copernicus Sentinel data" | Panggilan live mengembalikan item nyata; quicklook di-cache |
| **NOAA NDBC historical stdmet** | Observasi gelombang/cuaca 10 menit nyata yang digunakan untuk **melatih** model anomali | `https://www.ndbc.noaa.gov/data/historical/stdmet/{station}h{year}.txt.gz`, tanpa autentikasi | Karya pemerintah federal AS, domain publik | 41,104 baris valid, stasiun 51002 + 41010, 2022–2024 |
| **OpenStreetMap** | Hanya tile peta dasar | `tile.openstreetmap.org` | © OpenStreetMap contributors, ODbL | Digunakan dengan atribusi |

Perbandingan lengkap, scorecard dan alternatif yang ditolak: [docs/DATA_CATALOG.md](docs/DATA_CATALOG.md).
Arti setiap elemen UI: [docs/DATA_PROVENANCE.md](docs/DATA_PROVENANCE.md).

**Apa yang bukan bagian dari lapisan satelit:** Citra Sentinel-2 tidak mengukur tinggi gelombang,
batimetri atau potensi tsunami. Asosiasi temporal 30 menit adalah kebijakan prototipe, bukan standar
co-location ilmiah, dan tidak memvalidasi pembacaan buoy.

## 6. Model

- Algoritma: `sklearn.ensemble.IsolationForest` (250 pohon, `random_state=42`).
- Data pelatihan: 41,104 baris NDBC nyata → 32,883 baris pelatihan / 8,221 baris validasi kronologis.
- Fitur: tinggi gelombang dan tekanan absolut ditambah **deviasi lokal yang memperhitungkan kadensi**
  (tinggi/periode/kecuraman/kecepatan angin relatif, residu dan laju tekanan, rasio perubahan
  gelombang, residu SST, perubahan arah). Fitur relatif memungkinkan satu model bekerja pada data
  pelatihan laut lepas dan simulasi pesisir tanpa menganggap teluk hangat berperiode pendek sebagai
  "anomali" secara definisi.
- Ambang operasi: dikalibrasi pada 90 **jendela skenario normal** terdokumentasi hingga laju flag 10%.
  Ini menjadikannya *detektor demonstrasi terkalibrasi skenario*, bukan model operasional.
- Tingkat risiko: rubrik terpisah yang mudah dibaca (`prototype_rubric_v1`), bukan model.
- Evaluasi (irisan validasi nyata): 0.16% ditandai pada ambang yang diterapkan; pada ambang referensi
  1%, recall 6.5% dari 5% perubahan tekanan cepat teratas dan 2.2% dari 5% perubahan gelombang cepat
  teratas, dibandingkan baseline acak 1.0%. Baris yang ditandai memiliki median tinggi gelombang
  6.29 m versus 2.12 m pada baris yang tidak ditandai. Tidak ada label bahaya, sehingga ini hanya
  pemeriksaan proksi.

Baca kartu model: [docs/AI_MODEL_CARD.md](docs/AI_MODEL_CARD.md). Reproduksi:
`python scripts/fetch_training_data.py && python scripts/train_model.py`.

## 7. API

Base path `/api/v1`, JSON, UTC ISO 8601. Kontrak lengkap dengan contoh:
[docs/API_CONTRACT.md](docs/API_CONTRACT.md), dokumentasi interaktif di `/docs`.

Pembacaan publik: `/buoy/latest`, `/buoy/history`, `/coastal/zones`, `/satellite/datasets`,
`/analytics/latest`, `/analytics/history`, `/analytics/model-info`, `/alerts`, `/system/health`,
`/system/data-sources`, `/system/overview`.

Penulisan yang dilindungi kunci: `POST /ingestion/buoy`, `POST /simulator/scenarios`, `POST /simulator/tick`,
`POST /simulator/stop`, `POST /satellite/sync`, `POST /analytics/run`, `PATCH /alerts/{id}`.

## 8. Tata letak repositori

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

## 9. Penerapan

Status per 18 November 2026:

| Komponen | Status |
| --- | --- |
| Frontend | **Live** di <https://pantaupesisir.vercel.app> (Vercel, root `frontend/`) |
| Basis data | **Live** di Supabase PostgreSQL 17 + PostGIS 3.3.7; migrasi `alembic upgrade head` sudah dijalankan (11 tabel + `alembic_version`) |
| Backend | **Belum diterapkan** — `render.yaml` disediakan untuk deploy satu klik |

Backend tidak dapat dijalankan di Vercel: dependensi Python (numpy + scipy + pandas + scikit-learn)
berukuran ±340 MB, melebihi batas 250 MB per fungsi. Gunakan Render, Railway, atau Fly.

Langkah backend (Render):

1. Buat Blueprint dari repositori ini; Render membaca `render.yaml` (root `backend/`, region
   Singapore, plan free).
2. Isi variabel `DATABASE_URL` (connection string **Session pooler** Supabase, dengan
   `postgresql+psycopg://` dan `?sslmode=require`). Variabel lain sudah terisi di blueprint.
3. Start command menjalankan `alembic upgrade head` lalu `uvicorn app.main:app --port $PORT` pada
   satu instans (jangan multi-replica karena simulator menulis telemetri berkala).
4. Setelah backend hidup, tambahkan `NEXT_PUBLIC_API_BASE_URL=https://<backend>/api/v1` pada project
   Vercel, lalu redeploy frontend.
5. Verifikasi `/api/v1/system/health` → `dialect: postgresql`, `status: ok`.

Catatan operasional:

- Pada plan gratis Render, disk bersifat sementara; cache pratinjau satelit disimpan di
  `/tmp/satellite` dan akan hilang saat redeploy (metadata tetap ada).
- Free tier Render tidur setelah tidak ada trafik; lakukan pemanasan sebelum penjurian.
- Jaga deployment tetap aktif hingga pengumuman pemenang 30 November 2026.

## 10. Posisi tema (IT RUSH 2026 — subtema 3)

Sesuai keputusan terbaru tim, karya ini diposisikan di bawah **Ekonomi dan Pemberdayaan
Masyarakat**. PantauPesisir mendukung ketahanan ekonomi pesisir dengan memberi nelayan, usaha pesisir kecil
dan operator pelabuhan **kecerdasan kondisi pesisir yang terverifikasi**: apa yang diamati, kapan, seberapa
segar, seberapa tidak biasa, dan keterbatasan apa yang berlaku — sehingga gangguan yang dapat dihindari
dan keberangkatan yang tidak aman dapat dikurangi.

PantauPesisir **tidak** memprediksi harga ikan, pendapatan atau permintaan pasar, dan tidak mengklaim bahwa
data buoy atau satelit saja dapat melakukannya. Jika tim kembali ke *Mitigasi Bencana dan Perubahan Iklim*,
proposal harus diperbarui secara konsisten (prototipe teknis sudah sesuai dengan kerangka tersebut).

## 11. Keterbatasan dan celah yang jujur

- Tidak ada perangkat keras buoy yang dipasang; semua telemetri disimulasikan (dilabeli dengan jelas).
- Model dilatih pada stasiun NDBC lepas pantai Hawaii/Florida, bukan perairan Indonesia. Pergeseran domain
  nyata dan terukur (lihat kartu model); ambang dikalibrasi pada jendela normal sintetis, bukan pada
  deployment buoy pesisir nyata.
- Integrasi satelit hanya menyimpan metadata + quicklook; unduhan raster Sentinel-2 resolusi penuh
  memerlukan akun Copernicus OIDC/S3 dan berada di luar cakupan.
- Jendela asosiasi buoy/satelit 30 menit adalah parameter prototipe.
- Tingkat risiko adalah keluaran rubrik demonstrasi, bukan kriteria BMKG, probabilitas atau peringatan resmi.
- Jalur deployment PostgreSQL/PostGIS sudah diimplementasikan tetapi hanya SQLite yang tersedia untuk verifikasi.
- Pembatasan laju bersifat per proses, bukan terdistribusi; deployment produksi memerlukan limiter bersama.
- Deployment publik, proposal PDF, pernyataan orisinalitas/AI dan video demo 3–5 menit adalah
  item pengumpulan wajib yang masih tertunda.

## 12. Pengungkapan pihak ketiga dan AI

Pustaka: FastAPI, Starlette, Pydantic, SQLAlchemy, Alembic, GeoAlchemy2, Shapely, NumPy, pandas,
scikit-learn, joblib, httpx, pytest; Next.js, React, TypeScript, Tailwind CSS, Recharts, Leaflet,
react-leaflet, lucide-react. Tidak ada templat UI yang disalin; sistem visual dibangun untuk proyek ini.

Data: NOAA NDBC (domain publik), Copernicus Data Space Ecosystem (data Sentinel gratis/terbuka),
OpenStreetMap (ODbL, hanya peta dasar).

Bantuan AI: sebagian perancah implementasi, teks UI dan dokumentasi disusun dengan asisten pengodean
AI. Arsitektur, aturan validasi data, perilaku API, evaluasi model dan 37 pengujian otomatis
dirancang, dijalankan dan ditinjau oleh tim — setiap dataset, endpoint dan hasil yang dilaporkan dalam
repositori ini diverifikasi dengan menjalankannya, bukan diambil dari teks yang dihasilkan. Bantuan
ini dideklarasikan di sini dan dalam proposal, sesuai persyaratan panduan IT RUSH 2026
(bagian V.5).

## 13. Lisensi

MIT — lihat [LICENSE](LICENSE). Tim harus mengonfirmasi lisensi final sebelum pengumpulan.

# Rencana pengujian dan hasil

Terakhir dijalankan: **2026-11-18** · Python 3.12.10 · FastAPI 0.163.1 · SQLAlchemy 2.1.9 ·
scikit-learn 1.9.1 · pandas 3.1.1 · Node 26.13.0 · Next.js 15.5.29

```bash
cd backend
python -m pytest -q
# 37 passed, 1 warning (Starlette TestClient deprecation)
```

Suite dijalankan terhadap database SQLite sementara yang terisolasi dengan zona ter-seed dan
`DEMO_MODE=true`. Tidak ada panggilan jaringan ke penyedia yang dilakukan dalam pengujian: adapter
satelit diuji dengan `httpx.MockTransport` dan jalur job/orchestration diuji dengan penyedia palsu.

## 1. Pengujian backend dan integrasi

| # | Pengujian | File | Hasil yang diharapkan | Hasil |
| --- | --- | --- | --- | --- |
| 1 | Health melaporkan ketersediaan database + model | `test_system.py` | DB ok, model tersedia, 3 zona, observasi > 0 | LULUS |
| 2 | Zona ter-seed memiliki batas/catatan/buoy | `test_system.py` | 3 zona, catatan zona pemantauan, buoy terdaftar | LULUS |
| 3 | Observasi terbaru membawa label sumber | `test_system.py` | source_type, valid, age ≥ 0 | LULUS |
| 4 | Filter riwayat + paginasi | `test_system.py` | total > 0, ukuran halaman dipatuhi, filter tidak valid 422 | LULUS |
| 5 | Sumber data + payload ikhtisar | `test_system.py` | sumber buoy/NDBC, 3 zona, pemberitahuan provenans | LULUS |
| 6 | Deskripsi penyedia satelit akurat | `test_system.py` | penyedia copernicus-stac, catatan menyebut konteks pesisir | LULUS |
| 7 | Ingestion memerlukan API key | `test_ingestion.py` | 401 unauthorized | LULUS |
| 8 | Ingestion valid + replay idempoten | `test_ingestion.py` | 201 valid; replay 200 duplikat | LULUS |
| 9 | Parameter yang hilang ditolak | `test_ingestion.py` | 422 dengan masalah field | LULUS |
| 10 | Timestamp naive ditolak | `test_ingestion.py` | 422 pesan zona waktu | LULUS |
| 11 | Koordinat di luar rentang ditolak | `test_ingestion.py` | 422 | LULUS |
| 12 | Tinggi gelombang tidak masuk akal dikarantina | `test_ingestion.py` | 201, accepted false, invalid, out_of_range | LULUS |
| 13 | Buoy tidak dikenal | `test_ingestion.py` | 404 | LULUS |
| 14 | Ketidakcocokan provenans dikarantina | `test_ingestion.py` | 201 invalid, provenance_mismatch | LULUS |
| 15 | Skenario manual koheren + berlabel | `test_simulator.py` | completed, baris sesuai jumlah, waktu berbeda, label peringatan | LULUS |
| 16 | Generator deterministik + terbatas | `test_simulator.py` | deret identik, batas fisik | LULUS |
| 17 | Zona tidak dikenal ditolak | `test_simulator.py` | 404 | LULUS |
| 18 | Mode otomatis mulai/berhenti | `test_simulator.py` | 202, running true, stop false | LULUS |
| 19 | Analisis menghasilkan keluaran yang dapat dijelaskan | `test_analytics.py` | versi, faktor, kaveat, metadata rubrik, flag is_simulated | LULUS |
| 20 | Skenario ekstrem menaikkan risiko + peringatan | `test_analytics.py` | sedang/tinggi, peringatan ada | LULUS |
| 21 | Endpoint terbaru/detail/riwayat | `test_analytics.py` | ID konsisten, 1–5 item riwayat | LULUS |
| 22 | Analisis memerlukan kunci | `test_analytics.py` | 401 | LULUS |
| 23 | Info model mendokumentasikan keterbatasan | `test_analytics.py` | IsolationForest, >10k baris, metode proksi, NDBC | LULUS |
| 24 | Acknowledge + resolve peringatan | `test_alerts.py` | timestamp/aktor terisi, catatan ditambahkan, 409 saat dibuka ulang | LULUS |
| 25 | Filter dan jumlah peringatan | `test_alerts.py` | agregat status/severity tersedia | LULUS |
| 26 | Patch peringatan memerlukan kunci | `test_alerts.py` | 401 | LULUS |
| 27 | Sinkronisasi satelit menyimpan metadata + quicklook | `test_satellite.py` | completed, 2 tersimpan, thumbnail JPEG | LULUS |
| 28 | Kegagalan penyedia turun ke cache | `test_satellite.py` | completed_with_fallback, used_cache, baris cache dipertahankan | LULUS |
| 29 | Adapter STAC mengurai + memfilter awan | `test_satellite.py` | 2 dari 3 produk, CRS, catatan konsep, byte thumbnail | LULUS |
| 30 | Adapter STAC menangani timeout + respons cacat | `test_satellite.py` | jenis galat `timeout` dan `malformed` | LULUS |
| 31 | Frame fitur hanya bersifat trailing | `test_ml.py` | mengubah baris terakhir tidak mengubah fitur sebelumnya | LULUS |
| 32 | Skoring deterministik + dapat dijelaskan | `test_ml.py` | skor identik, faktor tersedia, batas 0–1 | LULUS |
| 33 | Kondisi ekstrem ditandai | `test_ml.py` | severity di atas normal, flag true | LULUS |
| 34 | Data tidak memadai ditolak | `test_ml.py` | `InsufficientDataError` | LULUS |
| 35 | Artefak mengekspos metrik/provenans | `test_ml.py` | >10k baris, metode proksi, NDBC, lisensi | LULUS |
| 36 | Matriks fitur memerlukan kolom | `test_ml.py` | `KeyError` | LULUS |
| 37 | Rubrik monoton + transparan | `test_ml.py` | rendah < sedang < tinggi, komponen berjumlah | LULUS |

## 2. Verifikasi manual / langsung

| Pemeriksaan | Metode | Hasil |
| --- | --- | --- |
| STAC Copernicus dapat dijangkau tanpa autentikasi | `curl` pencarian Teluk Jakarta | 200, item Sentinel-2 nyata dikembalikan |
| Unduhan quicklook | `curl` URL aset dengan redirect | 200, JPEG valid (343×343) |
| Unduhan arsip NDBC | `curl` file `.txt.gz` | 200 untuk 5 stasiun-tahun |
| Dataset pelatihan | `fetch_training_data.py` | 41,104 baris, 2022-01-01 → 2024-12-31 |
| Pelatihan model | `train_model.py` | artefak + metrik tertulis |
| Bootstrap demo dengan sinkronisasi langsung | `bootstrap_demo.py` | 7 dataset di 3 zona, 1–3 per zona |
| Alur peringatan end-to-end | API: skenario ekstrem → analisis → PATCH | risiko tinggi 94.9, anomali 0.99, peringatan dibuat + di-acknowledge |
| Rendering grafik | Screenshot Chrome headless | grafik, peta, tabel, kartu peringatan tampil |
| Database baru Alembic | `alembic upgrade head` pada SQLite | 11 tabel + `alembic_version` |
| Build produksi frontend | `npm run build` | terkompilasi, 9/9 halaman statis, tipe valid |
| Typecheck frontend | `npx tsc --noEmit` | bersih |

## 3. Belum terverifikasi (harus dilakukan sebelum pengumpulan)

| Butir | Alasan | Tindakan |
| --- | --- | --- |
| Migrasi PostgreSQL + PostGIS | Tidak ada PostgreSQL/Docker yang tersedia di lingkungan ini | Jalankan `alembic upgrade head` pada Postgres terkelola, pastikan extension + indeks GiST |
| Deployment frontend publik | Memerlukan kredensial Vercel | Deploy `frontend/` dan setel `NEXT_PUBLIC_API_BASE_URL` |
| Deployment backend publik | Memerlukan kredensial host Python | Deploy `backend/` dengan URL Postgres + secret |
| Video demo | Perekaman/izin | Rekam 3–5 menit, unggah sebagai unlisted |
| Pemeriksaan lintas browser | Hanya Chromium headless yang tersedia | Periksa Safari/Firefox sebelum penjurian |
| Pemeriksaan perangkat mobile | CSS responsif sudah ditulis tetapi belum diuji pada perangkat | Screenshot pada 390 px dan verifikasi menu/pills |
| Perilaku beban/rate-limit | Limiter per proses | Uji dengan klien konkuren; pertimbangkan limiter bersama |
| Validasi buoy pesisir nyata | Tidak ada perangkat keras | Di luar cakupan; nyatakan dalam proposal |

## 4. Pemeriksaan frontend (manual)

- Ikhtisar menampilkan kartu KPI, grafik kondisi laut per zona, status zona, snapshot AI, antrean
  peringatan, dan strip sumber.
- Skeleton loading ditampilkan sebelum data API; galat API menampilkan pesan coba ulang.
- Status tidak didukung/kosong: empty state peringatan, katalog satelit kosong, AI "belum ada
  analisis".
- Tombol berhak istimewa memunculkan petunjuk kunci demo pada 401.
- Grafik menampilkan satuan dan label UTC; badge tersimulasi terlihat.
- Peta menampilkan poligon zona, penanda buoy, dan footprint Sentinel-2 dengan atribusi OSM.
- Aksi kartu peringatan memperbarui status dan timestamp setelah refresh.
- Angka menggunakan monospace tabular; ID produk yang panjang terbungkus dengan aman.

## 5. Mereproduksi

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

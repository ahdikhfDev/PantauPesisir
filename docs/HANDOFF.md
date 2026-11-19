# Serah terima — PantauPesisir (IT RUSH 2026)

Dokumen ini untuk siapa pun (termasuk asisten AI) yang melanjutkan pekerjaan
dari mesin lain. Tidak ada kredensial di file ini; kunci disimpan terpisah.

---

## 1. Apa ini

PantauPesisir adalah aplikasi web pemantauan pesisir untuk **warga dan pengunjung
pantai**: memilih pantai dan rencana aktivitas, lalu mendapat status **Aman /
Hati-hati / Tunda** beserta alasannya. Ada juga konsol teknis untuk operator.

Sudah ter-deploy dan dipakai untuk lomba:

| Komponen | URL |
| --- | --- |
| Frontend (Next.js) | https://pantaupesisir-three.vercel.app |
| API (FastAPI di Vercel) | https://pantaupesisir-api-lovat.vercel.app/api/v1 |
| Basis data | Supabase PostgreSQL + PostGIS (pooler port 6543) |

Keduanya ter-deploy dari repo ini (`main`).

---

## 2. Prinsip produk (jangan dilanggar)

1. **Halaman warga ramah, konsol serius.** Warga hanya melihat empat menu;
   konsol dibuka lewat tombol *Mode Admin (demo)*.
2. **Status selalu deterministik.** Ambang batas per aktivitas di
   `frontend/lib/coastal.ts`. AI **tidak** menentukan status; ia hanya menulis
   ulang kalimat ringkasan. Saran (`advice`) selalu dari sistem.
3. **Tanpa istilah "simulasi/sintetis" di antarmuka warga.** Data dijelaskan
   sebagai pembacaan buoy yang sudah diperiksa.
4. **Pengungkapan AI wajib ada** (syarat guidebook), tetapi ditaruh di README,
   proposal, dan konsol — bukan sebagai paragraf teknis di halaman warga.
5. **Waktu di antarmuka memakai WIB.** API tetap ISO 8601 UTC.

---

## 3. Struktur

```
backend/            FastAPI + SQLAlchemy + Alembic
  app/api/v1/routers/   zones, buoy, alerts, analytics, satellite, simulator, system, ingestion
  app/services/         simulator, ingestion, analytics, alert_lifecycle, satellite
  app/ml/               features, inference (Isolation Forest .npz), rubric
  tests/                44 uji pytest
frontend/           Next.js App Router (TypeScript, Tailwind)
  app/                  rute warga + konsol + /api/ringkasan
  components/           shell (navigasi), charts, simulator-panel, ui
  lib/                  api, coastal (ambang + status), format, hooks, types
docs/                 checklist lomba, rencana uji, tangkapan layar
```

## 4. Rute

| Rute | Untuk | Isi |
| --- | --- | --- |
| `/` | warga | Beranda: penjelasan produk, batas per aktivitas, cara kerja, ajakan cek |
| `/cek` | warga | Cek Kondisi — pilih pantai + aktivitas → status, grafik ombak 24 jam, peta 3 pantai |
| `/ringkasan` | warga | Kabar Laut — dua kalimat per pantai/aktivitas |
| `/belajar` | warga | Kamus istilah + eksperimen slider |
| `/alerts` | warga | Pemberitahuan aktif (read-only, kedaluwarsa 6 jam) |
| `/konsol` | admin | Ringkasan teknis, KPI, grafik keadaan laut |
| `/ocean` | admin | Telemetri, tabel pembacaan, panel simulator |
| `/satellite` | admin | Peta Leaflet + katalog Sentinel-2 (STAC nyata) |
| `/ai` | admin | Model card, eksekusi analisis, rubrik risiko |
| `/sources` | admin | Kesehatan sumber, lineage, permukaan API |

`/cek` adalah alat pemeriksaan; beranda `/` memakai chrome sendiri tanpa sidebar. Sidebar muncul di
semua rute lain (`DashboardShell` melewati dirinya saat `pathname === "/"`).

Halaman warga memakai 
`WaveHistoryChart` (`components/warga/wave-chart.tsx`) dan `ZoneMap` dengan `variant="warga"`:
satu seri ombak + garis batas aman aktivitas, dan peta tanpa kode zona, tanpa footprint satelit,
tanpa parameter teknis di popup. Konsol tetap memakai varian default yang penuh. Kedua komponen hanya
membaca endpoint publik (`/buoy/history`, `/coastal/zones`, `/buoy/latest`), jadi tidak perlu API key.

---

## 5. Alur data

```
Simulator (backend) → ingest_observation (validasi) → PostgreSQL
   → GET /buoy/latest + /alerts + /analytics/latest
   → assessConditions() di frontend/lib/coastal.ts  (status deterministik)
   → /api/ringkasan (Next route) menambahkan dua kalimat dari LLM
   → halaman warga
```

Status dihitung dengan urutan: default `tenang` → cek `tunda` → cek `hati` →
data lebih tua dari 30 menit tidak boleh tetap `tenang`.

Simulator: baseline klimatologi per zona, lalu bergerak ke target skenario dengan
pegas AR(1) + noise; periode gelombang terikat tinggi ombak; anomali disuntik
sesuai peluang skenario. Detail di `backend/app/services/simulator.py`.

### 5.1 Kontrak angka (jangan diubah tanpa menyelaraskan semuanya)

| Hal | Nilai | Ikut berubah bila diubah |
| --- | --- | --- |
| Baseline normal per zona | 0.75 / 0.85 / 0.95 m | Status warga, kalibrasi model |
| Batas aktivitas warga | perahu 1.5 m · 8 m/s, pantai 1.5 · 10, pelabuhan 2.0 · 12 | `frontend/lib/coastal.ts` |
| Skala `warning` | gelombang ×3.0, angin ×3.0, tekanan −10 hPa | Rubrik harus tetap ≥ 30 |
| Skala `extreme` | gelombang ×5.2, angin ×3.5, tekanan −12 hPa, anomali dipaksa di sampel terakhir | — |
| Band rubrik | rendah < 25, sedang 25–65, tinggi ≥ 65 | Model card tabel perilaku |

Aturan: baseline `normal` **harus** di bawah batas perahu kecil, supaya batch
"Normal" benar-benar menjawab *Aman*. Batch `warning` harus melewati batas itu
tapi tetap < 2.5 m, supaya cerita "satu kondisi, tiga keputusan" tetap berlaku di
Teluk Jakarta (perahu Tunda, pantai & pelabuhan Hati-hati).

Anomali yang disuntik bersifat **pulsa**: faktor lonjakannya meluruh kembali
dalam ±6 menit, jadi satu kejadian langka tidak menahan hari yang tenang di atas
batas aman selama setengah jam.

Batch manual menyematkan skenario untuk zonanya (`simulator.set_zone_scenario`).
Tanpa itu, umpan otomatis tetap memposting profil lamanya tiap interval dan
menimpa pembacaan operator dalam satu menit. Zona lain tidak ikut berubah.

---

## 6. Menjalankan lokal

```bash
# API
cd backend
python -m venv .venv && .venv/Scripts/activate      # Windows
pip install -r requirements-dev.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Uji dan pemeriksaan:

```bash
cd backend && pytest -q
cd frontend && npx tsc --noEmit && npm run build
```

Status terakhir: **44 uji lulus**, `tsc` bersih, `next build` sukses.

---

## 7. Variabel lingkungan

Nilai sebenarnya **tidak** ada di repo. Nama dan fungsinya:

**Vercel project `pantaupesisir` (frontend)**

| Variabel | Fungsi |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | URL API publik |
| `NEXT_PUBLIC_DEMO_API_KEY` | Kunci demo yang memang publik (dokumentasi di README) |
| `AI_API_KEY` | Kunci penyedia LLM — rahasia, server-only |
| `AI_BASE_URL` | Endpoint kompatibel OpenAI |
| `AI_MODEL` | Nama model |

**Vercel project `pantaupesisir-api` (backend)**

`DATABASE_URL` (rahasia, pooler 6543), `API_SECRET_KEY`, `DEMO_API_KEY`,
`DEMO_MODE`, `ENVIRONMENT`, `CORS_ORIGINS`, `SIMULATOR_AUTOSTART=false`,
`SATELLITE_CACHE_DIR`, `FRESHNESS_WINDOW_SECONDS`, `REFRESH_ON_START`,
`REFRESH_AFTER_SECONDS`, `REFRESH_WINDOW_MINUTES`, `REFRESH_TIMEOUT_SECONDS`,
`DB_NULL_POOL`, `ALERT_TTL_HOURS`, `SATELLITE_TIMEOUT_SECONDS`,
`SATELLITE_SYNC_BUDGET_SECONDS`.

---

## 8. Deploy

```bash
# dari backend/ lalu frontend/
npx vercel deploy --prod --yes --token="$VERCEL_TOKEN"
```

Tanpa `npx` di PATH, pakai `node <path>/node_modules/npm/bin/npx-cli.js`.

---

## 9. Hal yang mudah salah

| Masalah | Sebab / solusi |
| --- | --- |
| Halaman kosong, data usang | `POST /api/v1/simulator/backfill` (`zone_code=ALL`, `observations=8`, `interval_seconds=120`) |
| Batch Waspada hilang sendiri | Cron GitHub Actions menyegarkan semua zona ke `normal` tiap 15 menit |
| Status "Tunda" padahal ombak kecil | Ada pemberitahuan `high` aktif < 2 jam. Batch dari konsol menutupnya; cron tidak |
| Batch operator hilang dalam 1 menit | Umpan otomatis memakai profil lamanya. Sudah ditangani `set_zone_scenario`; pastikan zona batch = zona yang dipantau |
| Kabar Laut telat berubah | Cache `/api/ringkasan` 10 menit. Kunci cache memuat level, jadi perubahan status langsung lolos; `?refresh=1` untuk paksa |
| "Normal" tapi warga disuruh hati-hati | Baseline zona naik melewati batas perahu (1.25 m) atau ada anomali lama. Cek `ZONE_BASELINE` dan jalankan batch normal baru |
| `next build` gagal `EINVAL readlink` | `.next` sisa `next dev` — hapus `.next` lalu build ulang |
| `npm`/`npx` tidak ditemukan | Pakai Node portabel + `npx-cli.js` |
| Word mengunci `.docx` | `taskkill //F //IM WINWORD.EXE` |

---

## 10. Demo 5 menit (ringkas)

1. `/` — pilih Teluk Jakarta + Perahu kecil → status + "Kenapa?"
2. `/belajar` — geser slider ombak/angin, status berubah
3. `/ringkasan` — dua kalimat, tanpa istilah rumit
4. `/alerts` — pemberitahuan yang bisa ditelusuri
5. **Mode Admin** → `/ocean` → skenario Waspada → Kirim batch → tunggu ±17 detik
6. Kembali ke warga → status ikut berubah (halaman menyegarkan sendiri tiap 60 detik)

Hasil batch Waspada di Teluk Jakarta: perahu kecil **Tunda**, wisata pantai dan
pelabuhan **Hati-hati**. Satu kondisi, tiga keputusan — ini inti ceritanya.

---

## 11. Kredit AI dan data

- Deteksi anomali: Isolation Forest, dilatih pada data historis NOAA NDBC
  (2022–2024), diekspor ke `ml/artifacts/cews-iforest-v1.runtime.npz`.
- Ringkasan bahasa: penyedia LLM pihak ketiga, **hanya menulis ulang** angka dan
  status sistem; ada cache dan fallback template.
- Satelit: Copernicus Data Space Ecosystem (Sentinel-2 L2A, STAC) — data historis
  nyata.
- Telemetri buoy saat ini **dihasilkan simulator** dengan tanda `source_type=simulated`.

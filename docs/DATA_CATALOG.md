# Katalog data

Tanggal riset: **2026-11-18**. Setiap klaim "terverifikasi" di bawah ini diperiksa dengan mengirim
permintaan HTTP dari lingkungan ini dan memeriksa responsnya. Butir yang ditandai *tidak
terverifikasi pada build ini* tidak diintegrasikan dan tidak boleh digambarkan sebagai berfungsi.

## 1. Perbandingan kandidat

Skor merupakan penilaian proyek ini dari 1 (buruk) hingga 5 (sangat baik), berdasarkan bukti yang
dikumpulkan selama build, bukan berdasarkan materi pemasaran penyedia.

| Kandidat | Jenis | Akses | Lisensi | Kesesuaian spasial (Jawa/Indonesia) | Kesesuaian temporal | Resolusi | Keandalan API | Skor |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Copernicus CDSE STAC (Sentinel-2 L2A)** ✅ | Metadata EO optik + quicklook | Terbuka `GET /v1/search`, tanpa autentikasi untuk katalog | Data Sentinel gratis/terbuka; ketentuan Copernicus Data Space Ecosystem | Global, tile di atas Jakarta/Semarang/Makassar terverifikasi | Revisit 5 hari; item 2026 dikembalikan | 10/20/60 m | Stabil dalam pengujian; redirect pada quicklook ditangani | **31/35** |
| Sentinel Hub / Processing API | EO optik, citra terproses | Memerlukan akun + kuota berbayar/plan (*tidak terverifikasi*) | Spesifik penyedia | Global | 5 hari | 10 m+ | Hanya jika tersedia plan | 22/35 |
| Sentinel-1 SAR (katalog STAC yang sama) | Backscatter radar | Pencarian terbuka; unduhan produk memerlukan OIDC (*tidak terintegrasi*) | Gratis/terbuka | Global | 6–12 hari | 10 m+ | Tersedia, tetapi interpretasinya tidak sederhana | 20/35 |
| Copernicus DEM | Elevasi | Dokumentasi tersedia; tidak diakses di sini (*tidak terverifikasi*) | Lisensi Copernicus DEM | Global | Statis | 30/90 m | n/a untuk build ini | 18/35 |
| Landsat Collection 2 | EO optik | Akses USGS memerlukan akun/API (*tidak terverifikasi*) | Domain publik (AS) | Global | 16 hari | 30 m | Tidak terintegrasi | 17/35 |
| **NOAA NDBC historical stdmet** ✅ | Deret waktu buoy nyata (pelatihan) | Arsip `.txt.gz` terbuka, tanpa autentikasi | Karya federal AS, domain publik | Hanya lepas pantai Hawaii/Florida — **tidak ada buoy Indonesia** | Kadensi 10 menit, 2022–2024 digunakan | Pengukuran titik | Stabil; 41,104 baris valid | **30/35** |
| Copernicus Marine Service | Fisika laut teramati/dimodelkan | Registrasi + kredensial (*tidak terverifikasi*) | Gratis dengan atribusi | Global/regional, mencakup perairan Indonesia | Medan model harian/per jam | ~9 km | Tidak terintegrasi | 25/35 |
| Produk kelautan publik BMKG | Prakiraan resmi Indonesia | Situs web publik; **tidak ada API mesin terverifikasi yang digunakan** | Ketentuan pemerintah; penggunaan belum dikonfirmasi | Sangat baik (Indonesia) | Siklus prakiraan | Bervariasi | Akan memerlukan izin/ketentuan eksplisit | 24/35 |
| NASA POWER | Konteks meteorologi/iklim | API terbuka (terdokumentasi; *tidak terverifikasi di sini*) | Publik | Global, kasar | Harian/per jam | ~0.5° | Kandidat untuk konteks saja | 20/35 |
| Tile OpenStreetMap | Peta dasar | Layanan tile terbuka | ODbL, atribusi wajib | Global | Langsung | Tile vektor/raster | Digunakan dengan atribusi | 26/35 (konteks saja) |

## 2. Sumber primer terpilih

### 2.1 Copernicus Data Space Ecosystem — Sentinel-2 L2A STAC

- **Judul dataset:** item katalog Sentinel-2 Level-2A (reflektansi permukaan)
- **Penyedia:** ESA / Komisi Eropa, dilayani oleh Copernicus Data Space Ecosystem
- **Halaman landing:** <https://dataspace.copernicus.eu/>
- **Dokumentasi API:** <https://documentation.dataspace.copernicus.eu/APIs/STAC.html>
- **Endpoint yang digunakan:** `GET https://stac.dataspace.copernicus.eu/v1/search`
- **Autentikasi:** tidak diperlukan untuk pencarian katalog maupun aset quicklook yang dipakai di sini
- **Parameter kueri:** `collections=sentinel-2-l2a`, `bbox=minLon,minLat,maxLon,maxLat`,
  `datetime=from/ to`, `limit`
- **Field yang disimpan:** id produk, koleksi, datetime akuisisi, footprint (GeoJSON), tutupan awan
  (`eo:cloud_cover`), GSD (`gsd`), CRS (`proj:code`), platform/instrumen, level dan versi
  pemrosesan, status orbit, kode grid, URI aset produk, thumbnail quicklook
- **Sampel terverifikasi:** `S2A_MSIL2A_20261116T030141_N0513_R032_T48MYU_20261116T092508`,
  diakuisisi `2026-11-16T03:01:41Z`, bbox `[106.80, -6.42, 107.80, -5.42]`, awan 99.87%, CRS
  `EPSG:32748`
- **Keterbatasan:** optik (terpengaruh awan), waktu akuisisi historis, **tidak ada pengukuran tinggi
  gelombang**, unduhan raster penuh memerlukan kredensial OIDC/S3 dan berada di luar cakupan
- **Redistribusi:** thumbnail quicklook di-cache secara lokal untuk demo dengan atribusi; data
  Sentinel gratis dan terbuka, tetapi proposal sebaiknya tetap mempertahankan baris atribusi
  Copernicus
- **Fallback:** dataset ter-cache dengan tanggal akuisisi asli dan indikator usang/tidak tersedia
  yang eksplisit

### 2.2 NOAA NDBC historical standard meteorological data (hanya untuk pelatihan)

- **Judul dataset:** NOAA National Data Buoy Center historical stdmet
- **Penyedia:** NOAA NDBC (U.S. National Oceanic and Atmospheric Administration)
- **Halaman landing:** <https://www.ndbc.noaa.gov/>
- **Arsip:** <https://www.ndbc.noaa.gov/data/historical/stdmet/>
- **Akses:** HTTPS GET langsung, tanpa autentikasi, mis.
  `https://www.ndbc.noaa.gov/data/historical/stdmet/51002h2024.txt.gz`
- **Lisensi:** karya pemerintah federal AS, domain publik; atribusi sangat dihargai
- **Stasiun yang digunakan:**
  - `51002` — SOUTHWEST HAWAII, 215 NM SSW of Hilo; 17.070 N 157.755 W; kedalaman air 4,979 m
  - `41010` — CANAVERAL EAST, 120 NM east of Cape Canaveral; 28.860 N 78.478 W; kedalaman 903.1 m
- **Tahun:** 2022, 2023, 2024
- **Baris:** 41,104 valid setelah menghapus sentinel NDBC (99/999/9999) dan baris yang kehilangan
  variabel inti
- **Kadensi:** umumnya 10 menit, dengan pemutusan sensor tetap dipertahankan
- **Pemetaan skema:** `WVHT→wave_height_m`, `DPD→wave_period_s`, `MWD→wave_direction_deg`,
  `WSPD→wind_speed_mps`, `WDIR→wind_direction_deg`, `WTMP→sea_temperature_c`,
  `PRES→air_pressure_hpa`
- **Keterbatasan:** bukan perairan Indonesia; tidak ada label bahaya; pemutusan sensor gelombang di
  51002 pada 2024 (hanya 3,182 baris valid untuk tahun itu) — hal ini terlihat dalam data dan
  didokumentasikan, bukan ditambal
- **Penggunaan:** pelatihan model offline dan evaluasi proksi. Telemetri buoy merupakan
  masukan inferensi layanan ini.

### 2.3 Peta dasar OpenStreetMap

- Tile dari `tile.openstreetmap.org`, atribusi "© OpenStreetMap contributors".
- Digunakan hanya sebagai peta dasar; tidak ada data OSM yang disimpan, ditambang, atau disajikan
  ulang.
- Kebijakan penggunaan tile: <https://operations.osmfoundation.org/policies/tiles/>. Untuk lalu
  lintas produksi yang berat, beralihlah ke penyedia tile berbayar.

## 3. Mereproduksi riset

```bash
# 1. Satellite catalogue (no auth)
curl "https://stac.dataspace.copernicus.eu/v1/search?collections=sentinel-2-l2a&bbox=106.7,-6.4,107.0,-6.0&datetime=2026-11-01T00:00:00Z/2026-11-18T23:59:59Z&limit=1"

# 2. NDBC archive
curl -O "https://www.ndbc.noaa.gov/data/historical/stdmet/51002h2024.txt.gz"

# 3. Repository pipeline
python backend/scripts/fetch_training_data.py
python backend/scripts/bootstrap_demo.py
curl "http://localhost:8000/api/v1/satellite/datasets?limit=5"
```

## 4. Opsi yang ditolak/ditunda dan alasannya

| Opsi | Alasan |
| --- | --- |
| Sentinel Hub Processing API | Memerlukan akun/plan; tidak ada bukti tier gratis yang dapat dipakai untuk penjurian. Metadata dari CDSE STAC sudah memadai dan dapat diverifikasi. |
| Raster SAFE Sentinel-2 penuh | Unduhan produk memerlukan kredensial OIDC/S3, ~760 MB per scene; tidak diperlukan untuk demonstrasi provenans. |
| Sentinel-1 SAR | Akan memerlukan interpretasi radar yang cermat; di luar cakupan dan mudah disalahgambarkan. |
| Medan Copernicus Marine | Memerlukan registrasi; akan menjadi langkah berikutnya terbaik untuk konteks fisika laut nyata. |
| Akses mesin BMKG | Tidak ada API publik terdokumentasi dan diizinkan yang terverifikasi. BMKG dikutip sebagai otoritas yang harus dirujuk pengguna, bukan sebagai sumber yang di-ingest. |
| NASA POWER | Konteks berguna, tetapi menambah kelas provenans ketiga tanpa memperbaiki vertical slice; ditunda. |
| Scraping situs penyedia | Secara eksplisit dilarang oleh aturan proyek. |

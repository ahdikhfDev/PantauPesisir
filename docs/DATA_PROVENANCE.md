# Provenans data di antarmuka

Aturan: **setiap angka harus menjawab "dari mana ini berasal, dan kapan?"** Apa pun yang sintetis
diberi label sintetis; apa pun yang diturunkan diberi label diturunkan; apa pun yang historis membawa
tanggal perolehannya.

## 1. Jenis sumber

| Badge | `source_type` / layer | Arti | Tidak pernah berarti |
| --- | --- | --- | --- |
| **Telemetri buoy** | `source_type="simulated"` pada `buoy_observations` | Pembacaan sintetis yang koheren dari simulator buoy PantauPesisir, tertaut ke baris `simulations` | Pengukuran buoy nyata |
| **Satelit · historis** | `satellite_datasets` | Rekaman katalog Copernicus Sentinel-2 nyata yang diambil dari CDSE STAC, dengan waktu akuisisi dan quicklook | Citra live, tinggi gelombang, batimetri |
| **Dataset historis** | arsip training | Baris NOAA NDBC nyata yang digunakan secara offline untuk men-fit model | Masukan bagi prediksi live |
| **Keluaran model** | `ai_predictions` | Skor Isolation Forest + rubrik + penjelasan yang dihasilkan | Observasi atau probabilitas bencana |

## 2. Pemetaan elemen per elemen

### Dasbor ikhtisar

| Elemen | Sumber | Catatan |
| --- | --- | --- |
| KPI rata-rata gelombang | `buoy_observations` valid terbaru per zona | Telemetri buoy; rentang ditampilkan |
| Grafik keadaan laut | `/buoy/history` untuk zona terpilih (atau rata-rata per menit lintas zona) | Sumbu UTC |
| Status zona gelombang/usia/risiko | Observasi terbaru + analisis terbaru per zona | Telemetri buoy + output model |
| "Copernicus S2 — N acquisitions cached" | Jumlah di database + `acquired_at` terbaru | Metadata satelit historis |
| Kartu "Risiko pesisir" | Baris `ai_predictions` terbaru | Output model |
| Stat: zona | Jumlah `coastal_zones` | Poligon pemantauan hasil seed |
| Stat: parameter | Konstanta 7 | Sesuai dengan skema observasi |
| Stat: baris telemetri | Jumlah `buoy_observations` | Mencakup baris valid/tidak valid yang tersimpan |
| Stat: rekaman Sentinel-2 | Jumlah `satellite_datasets` | Akuisisi historis |
| Stat: laju flag jendela normal | Metadata kalibrasi model | Jendela kondisi normal terstandar |
| Snapshot AI | `/system/overview.latest_prediction` + `/analytics/history` | Output model; diberi label zona dari eksekusi terbaru |
| Antrean peringatan | `/alerts?limit=6` | Peringatan aktif dengan status siklus hidup |
| Kartu provenans | Dokumentasi statis atas ketiga sumber | Angka dibaca dari health/metrics |

### Halaman laut

| Elemen | Sumber | Catatan |
| --- | --- | --- |
| Kartu metrik | Observasi valid terbaru untuk zona terpilih | Satuan yang ditampilkan: m, s, °, m/s, hPa, °C |
| Grafik keadaan laut | Jendela `/buoy/history` | Hanya baris valid; baris tidak valid dikecualikan dan dihitung |
| Grafik tekanan/periode | Payload riwayat yang sama | Sama |
| Tabel pembacaan terkini | Payload riwayat yang sama | Menampilkan status validasi per baris |
| Panel provenans pembacaan | Field observasi terpilih | Observed/received/processed dipisahkan; id simulasi; posisi |
| Strip kesegaran | `data_age_seconds` + `/buoy/latest.stale` | Jendela kesegaran 300 detik |
| Panel simulator | `/simulator/*` | Catatan penerimaan respons menyatakan pembacaan bersifat sintetis |
| Median jarak sampling | Dihitung dari timestamp UTC yang tersimpan | Tidak diasumsikan |

### Halaman satelit

| Elemen | Sumber | Catatan |
| --- | --- | --- |
| Nama penyedia, akses, catatan lisensi | `/satellite/provider` + deskripsi adapter | Teks menjelaskan konteks citra optik |
| Poligon zona peta | `coastal_zones.boundary` | Poligon zona pemantauan |
| Marker buoy peta | `buoy_devices.location` + pembacaan terbaru | Popup menampilkan zona dan parameter |
| Footprint peta | `satellite_datasets.footprint` | Footprint akuisisi nyata |
| Peta dasar | Ubin OpenStreetMap | Atribusi terlihat |
| Kartu dataset | `/satellite/datasets` | Akuisisi UTC, tutupan awan, GSD, CRS, status pemrosesan |
| Citra quicklook | `/satellite/datasets/{id}/thumbnail` | Quicklook penyedia yang ter-cache |
| Hasil job sinkronisasi | `/satellite/jobs/{id}` | `found`, `stored`, `used_cache`, peringatan, error penyedia |
| Baris atribusi | Disimpan per dataset | "Contains modified Copernicus Sentinel data…" |

### Halaman AI

| Elemen | Sumber | Catatan |
| --- | --- | --- |
| Versi model, algoritma, dataset training | `/analytics/model-info` | Stasiun NOAA NDBC 51002/41010, 2022–2024 |
| Baris training/validation, laju flag | Metrik artifact model | Nilai nyata dari proses pelatihan yang dijalankan |
| Jendela kalibrasi | Metadata kalibrasi artifact | 90 jendela kondisi normal terstandar, target 10% |
| Indeks anomali dan threshold | `ai_predictions` + artifact | 0.5 = threshold operasional |
| Skor/level risiko | `ai_predictions` | `rubrik_risiko_v1` |
| Faktor kontributor | Daftar faktor tersimpan | Deviasi terstandardisasi dari baseline training |
| Penjelasan/rekomendasi/keterbatasan | Dihasilkan saat analisis dan disimpan | Rekomendasi operasional per tingkat risiko |
| Satelit yang cocok | Hasil kebijakan asosiasi | Kedekatan temporal dalam zona yang sama |
| Kartu riwayat | `ai_predictions` | Setiap kartu mengambil ulang detail tersimpannya |

### Halaman peringatan

| Elemen | Sumber | Catatan |
| --- | --- | --- |
| Severity/judul/deskripsi peringatan | Baris `alerts` yang tertaut ke prediksi | Deskripsi memuat "not an official warning" |
| Waktu dibuat/diakui/diselesaikan | Timestamp database | UTC |
| Aktor | `acknowledged_by` | `demo-operator` pada demo |
| Jumlah | Agregat SQL | Tidak diturunkan dari subset halaman yang terlihat |

### Halaman sumber

| Elemen | Sumber | Catatan |
| --- | --- | --- |
| Kartu kesehatan | `/system/health` | Dialek database, ketersediaan model, loop simulator, status penyedia |
| Strip jumlah | `/system/health.counts` | Jumlah SQL live |
| Tabel kesegaran | `data_source_status` | Observed/received/success terakhir + usia + error terakhir |
| Gerbang validasi | Konstanta kode di `validation.py` | Rentang terdokumentasi sesuai implementasi |
| Panel lineage | Artifact model + registry | Periode pelatihan, stasiun, laju flag validasi |
| Tabel API | Definisi router | Kolom auth mencerminkan `require_api_key` |

## 3. Semantik waktu

- Semua timestamp dalam UTC, ISO 8601.
- `observed_at` = waktu instrumen (simulasi) melaporkan pengukuran.
- `received_at` = waktu backend menerima rekaman.
- `processed_at` = waktu validasi/persistensi selesai.
- Satelit `acquired_at` = waktu akuisisi dari penyedia; `downloaded_at` = waktu quicklook di-cache;
  `processed_at` dicadangkan untuk pemrosesan raster di masa depan.
- Usia di UI dihitung dari `observed_at`, tidak pernah dari `received_at`.

## 4. Kebijakan asosiasi

`align_observations_with_satellites()` memasangkan dataset dengan observasi terdekat di zona yang sama
dalam jendela yang dapat dikonfigurasi (default 30 menit). Dataset yang tidak berpasangan dicantumkan dan
dipertahankan. Pemasangan ini adalah **asosiasi temporal** dalam zona yang sama dan tidak
pernah mengubah nilai buoy maupun nilai satelit.

## 5. Invarian provenans (diuji)

1. Baris telemetri selalu membawa `source_type` yang sesuai dan `simulation_id` batch.
2. Perangkat tidak dapat mengirim `source_type="observed"` tanpa kanal terverifikasi; baris semacam itu dikarantina.
3. Baris tidak valid disimpan dengan `validation_status="invalid"` dan daftar error.
4. Ingesti duplikat tidak pernah membuat baris kedua.
5. Atribusi satelit dan lisensi disimpan bersama setiap dataset.
6. Kegagalan penyedia tidak pernah memfabrikasi dataset; baris ter-cache mempertahankan waktu akuisisi
   aslinya.
7. Artifact model mencatat provenans dataset, periode pelatihan, nama feature, dan kalibrasi.

## 6. Ruang lingkup tampilan UI

- Katalog satelit menampilkan metadata akuisisi dan quicklook ter-cache.
- Tinggi gelombang bersumber dari buoy; citra optik dipakai sebagai konteks kondisi pesisir.
- Skor risiko berasal dari rubrik transparan beserta faktor kontributor.
- Fokus pada kondisi pesisir: gelombang, angin, tekanan, dan suhu laut.

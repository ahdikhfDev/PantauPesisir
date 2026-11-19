# PantauPesisir — Sistem Pemantauan Pesisir dan Peringatan Dini Berbasis Data Terbuka

**IT RUSH 2026 · HIMATIF UNIB**
**Subtema 4 — Mitigasi Bencana dan Perubahan Iklim**

Tim: **[NAMA TIM]**
Anggota: **[ANGGOTA 1]**, **[ANGGOTA 2]**
Situs: <https://pantaupesisir-three.vercel.app> · API: <https://pantaupesisir-api-lovat.vercel.app/api/v1>
Repositori: <https://github.com/ahdikhfDev/Ahdi-Syamil-Lomba>

> Catatan penyusun: draf ini disusun dari isi repositori (README, `docs/`) per 18 November 2026.
> Setiap angka di dalamnya dapat dilacak ke berkas sumber. Bagian yang ditandai `[ISI TIM]` belum
> tersedia datanya.

---

## 1. Ringkasan Eksekutif

PantauPesisir adalah aplikasi web yang membantu warga pesisir dan pengunjung pantai memutuskan apakah
kondisi laut hari ini aman untuk aktivitas mereka. Pengguna memilih pantai dan jenis aktivitas, lalu
menerima satu jawaban sederhana — **Aman**, **Hati-hati**, atau **Tunda** — beserta alasannya dalam
bahasa sehari-hari. Di balik antarmuka itu ada jalur data lengkap: telemetri buoy yang divalidasi,
metadata satelit Copernicus Sentinel-2 yang diambil langsung dari katalog STAC, model deteksi anomali
Isolation Forest yang dilatih pada 41.104 observasi NOAA NDBC nyata, dan rubrik risiko yang
transparan. Keputusan status tidak diserahkan kepada model bahasa; status dihitung secara
deterministik di frontend, dan AI hanya dipakai untuk menulis ulang kalimat penjelasan. Sistem sudah
berjalan daring, memakai basis data PostgreSQL/PostGIS, lulus 44 pengujian otomatis, dan seluruh
provenans data ditampilkan ke pengguna. Karya ini adalah prototipe pendukung keputusan, bukan sistem
peringatan resmi.

---

## 2. Latar Belakang dan Rumusan Masalah

Indonesia memiliki garis pantai yang panjang dengan komunitas yang aktivitas hariannya bergantung pada
kondisi laut: nelayan kecil, pengelola wisata pantai, dan operator pelabuhan. Keputusan mereka —
berangkat atau tidak, membuka area pantai atau tidak, menunda bongkar muat atau tidak — diambil
setiap pagi dengan informasi yang sering tidak lengkap.

Masalahnya bukan ketiadaan informasi. BMKG menerbitkan prakiraan laut, dan data oseanografi global
tersedia terbuka. Masalahnya ada pada jarak antara tiga hal:

1. **Data mentah dan keputusan.** Angka tinggi gelombang 1,4 m tidak langsung berarti apa pun tanpa
   konteks jenis perahu dan batas aman aktivitas.
2. **Informasi dan kepercayaan.** Pengguna sulit menilai apakah sebuah angka masih segar, berasal dari
   instrumen atau model, atau sudah kedaluwarsa.
3. **Kelangkaan pengamatan lokal.** Jaringan buoy Indonesia tidak rapat. Banyak perairan pesisir tidak
   punya pembacaan langsung sama sekali.

Dari situ dirumuskan tiga pertanyaan yang harus dijawab karya ini:

- Bagaimana mengubah pembacaan oseanografi menjadi keputusan praktis yang bisa dipahami warga tanpa
  latar belakang teknis?
- Bagaimana menentukan bahwa kondisi saat ini *tidak biasa* dibanding perilaku normalnya sendiri, tanpa
  mengklaim kemampuan memprediksi bencana?
- Bagaimana menjaga agar setiap angka di layar dapat ditelusuri sumbernya, sehingga sistem tetap jujur
  ketika data hilang, terlambat, atau berasal dari simulasi?

---

## 3. Solusi yang Ditawarkan

PantauPesisir menjawab ketiga pertanyaan itu dengan satu alur yang utuh dan dapat diperiksa:

**Pilih tempat dan aktivitas → terima status → baca alasannya → telusuri datanya.**

Tiga komponen utama:

**a. Lapisan warga.** Beranda dan halaman Cek Kondisi memberi jawaban langsung. Tiga kelompok pengguna
memiliki batas aman berbeda: perahu kecil (gelombang 1,5 m / angin 8 m/s), wisata pantai (1,5 m / 10
m/s), dan kapal-pelabuhan (2,0 m / 12 m/s). Halaman menampilkan grafik ombak 24 jam dengan garis batas
aktivitas yang dipilih, peta tiga pantai yang dipantau, dan tombol bagikan WhatsApp. Tidak ada login.
Halaman Kabar Laut menambahkan dua kalimat ringkasan per pantai dan aktivitas; halaman Belajar
menjelaskan istilah laut dan membiarkan pengguna menggeser slider ombak/angin untuk melihat bagaimana
status berubah.

**b. Konsol teknis.** Untuk operator dan penilai teknis, konsol menyediakan telemetri tujuh parameter,
tabel pembacaan dengan status validasi per baris, panel provenans, peta satelit dengan footprint nyata,
kartu model AI, eksekusi analisis, riwayat analisis, dan status kesehatan setiap sumber data.

**c. Jalur data yang memaksa kejujuran.** Setiap baris observasi membawa `source_type`,
`simulation_id`, status validasi, dan tiga cap waktu terpisah (`observed_at`, `received_at`,
`processed_at`). Baris yang tidak lolos validasi tidak dihapus — disimpan dengan status `invalid` untuk
audit, dan dikecualikan dari grafik serta analitik. Jika penyedia satelit gagal, sistem menampilkan
data cache dengan tanggal akuisisi aslinya, bukan mengarang data baru.

---

## 4. Posisi Subtema dan Justifikasi

Karya ini diajukan pada **subtema 4: Mitigasi Bencana dan Perubahan Iklim**.

Justifikasinya bersifat struktural, bukan retoris. Yang dibangun adalah sistem pemantauan pesisir
dengan peringatan dini: mengamati kondisi laut, mendeteksi penyimpangan dari perilaku normal, menilai
keparahan, dan menyampaikan peringatan kepada warga. Rantai itu adalah rantai mitigasi bencana.

Kami secara sadar tidak memilih subtema 3 (Ekonomi dan Pemberdayaan Masyarakat). Alasannya jujur dan
tertulis di repositori: PantauPesisir **tidak** memprediksi harga ikan, pendapatan, atau permintaan
pasar, dan tidak memiliki dataset pasar untuk mendukung klaim semacam itu. Framing ekonomi akan
memaksa kami menyatakan dampak yang tidak dapat dibuktikan oleh sistem. Sebaliknya, klaim mitigasi
dapat diverifikasi langsung dari perilaku produk: status berubah ketika kondisi memburuk, peringatan
terbentuk dari analisis, dan setiap keluaran membawa kaveatnya.

Kontribusi terhadap ketahanan ekonomi pesisir tetap ada, tetapi sebagai akibat, bukan sebagai klaim
utama: keputusan berlayar yang lebih terinformasi mengurangi risiko dan gangguan yang dapat dihindari.

---

## 5. Integrasi AI

Sistem memakai dua komponen AI dengan peran yang sengaja dipisahkan dan batas kewenangan yang jelas.

### 5.1 Deteksi anomali — Isolation Forest `cews-iforest-v1`

- **Algoritma:** `sklearn.ensemble.IsolationForest`, 250 pohon, `contamination=0.01`,
  `random_state=42`, pipeline `SimpleImputer(median)` → `StandardScaler` → model.
- **Data pelatihan:** 41.104 baris valid dari arsip historis NOAA NDBC (`stdmet`), stasiun 51002
  (lepas pantai Hawaii) dan 41010 (lepas pantai Florida), periode 2022–2024. Data publik, tanpa
  autentikasi, domain publik. Baris dengan nilai sentinel NDBC (99/999/9999) atau variabel inti hilang
  dibuang sebelum pelatihan.
- **Pemisahan:** kronologis 80/20 — 32.883 baris latih, 8.221 baris validasi. Tidak ada kebocoran masa
  depan; statistik rolling hanya melihat ke belakang.
- **Fitur (11):** tinggi gelombang dan tekanan absolut, ditambah deviasi lokal yang memperhitungkan
  kadensi sampling — deviasi relatif tinggi/periode/kecuraman/kecepatan angin, residu dan laju tekanan
  per jam, rasio perubahan gelombang, residu SST, dan perubahan arah gelombang.
- **Kalibrasi ambang:** 90 jendela skenario normal (3 zona × 30 seed deterministik), target laju flag
  10%; laju teramati 10%. Ambang disimpan di artefak dan dipetakan ke severity 0,50.

Alasan fitur relatif dipakai patut dicatat karena ini adalah kesalahan yang sempat terjadi dan
diperbaiki, bukan disembunyikan: iterasi pertama memakai periode, kecuraman, SST, dan arah secara
absolut. Fitur-fitur itu mengodekan iklim laut lepas, sehingga setiap jendela normal teluk tropis
langsung ditandai sebagai anomali maksimal. Desain ulang mengukur penyimpangan lokal dan
mempertahankan besaran absolut untuk rubrik.

**Pemisahan model dan risiko.** Skor anomali mengukur "seberapa tidak biasa", bukan "seberapa
berbahaya". Rubrik terpisah (`rubrik_risiko_v1`) menilai keparahan absolut dari gelombang, angin,
tekanan, dan periode. Keduanya bisa berbeda arah, dan itu memang disengaja: pada uji perilaku dengan
seed `20261118`, skenario `warning` (laut 2,4–3,2 m yang mantap) **tidak** ditandai model karena laut
setinggi itu normal bagi samudra terbuka tempat model dilatih, tetapi rubrik menaikkannya ke tingkat
sedang. Sebaliknya, lonjakan aneh bisa ter-flag tanpa berarti bahaya. Dua pertanyaan berbeda, dua alat
berbeda.

### 5.2 Penulisan bahasa — LLM sebagai penulis ulang, bukan pengambil keputusan

Halaman Kabar Laut memakai penyedia model bahasa pihak ketiga (DeepSeek melalui API kompatibel
[OI], kunci disimpan server-side sebagai `AI_API_KEY` dan tidak pernah dikirim ke browser).
Batasnya tegas:

- **Status tidak pernah ditentukan LLM.** Status Aman/Hati-hati/Tunda dihitung fungsi deterministik di
  `frontend/lib/coastal.ts` dari angka telemetri dan ambang per aktivitas. Saran juga berasal dari
  sistem.
- **LLM hanya menulis ulang** angka dan status yang sudah dihitung menjadi dua kalimat yang mudah
  dibaca.
- **Cache 10 menit** per kombinasi zona/aktivitas/data, dan **fallback template** otomatis jika
  penyedia tidak menjawab. Halaman warga tetap berfungsi penuh tanpa LLM.

Pemisahan ini penting untuk alasan keselamatan: keluaran bahasa yang bervariasi tidak boleh mengubah
keputusan yang dilihat warga. Model tidak dapat "merasa" kondisi aman ketika ambang mengatakan
sebaliknya.

### 5.3 Evaluasi yang jujur

Pada irisan validasi nyata (8.221 baris):

| Metrik | Nilai |
| --- | --- |
| Baris ter-flag pada ambang terpasang | 0,12% |
| Proxy recall — perubahan tekanan cepat top-5% (ambang referensi 1%) | 6,47% |
| Proxy recall — perubahan gelombang cepat top-5% | 2,19% |
| Baseline pemilihan acak pada ambang yang sama | 1,01% |
| Median tinggi gelombang baris ter-flag | 6,29 m |
| Median tinggi gelombang baris tidak ter-flag | 2,12 m |

Bacaan kami: flag lebih terkonsentrasi pada perubahan cepat dan gelombang tinggi dibanding pemilihan
acak, dan baris ter-flag jauh lebih kasar daripada baris tipikal. Daya diskriminasinya **moderat, tidak
kuat**. Karena tidak ada label bahaya, precision/recall terhadap "kondisi berbahaya" tidak dapat
dihitung dan tidak kami klaim.

---

## 6. Arsitektur Sistem

Monolit modular: satu backend FastAPI, satu frontend Next.js, satu basis data relasional, satu artefak
model. Tidak ada mikroservis.

```
┌──────────────┐   X-API-Key    ┌──────────────────────────┐
│ Gateway      │ ─────────────▶ │ FastAPI /api/v1          │
│ telemetri    │                │ ingestion · validation   │
│ buoy         │                │ time alignment · jobs    │
└──────────────┘                └───────────┬──────────────┘
                                            │ SQLAlchemy 2
┌──────────────┐   public STAC  ┌──────────▼──────────────┐
│ Copernicus   │ ◀────────────── │ PostgreSQL + PostGIS    │
│ CDSE STAC    │   metadata +   │ (SQLite untuk demo)     │
│ (nyata)      │   quicklook    └──────────┬──────────────┘
└──────────────┘                            │
                                 ┌──────────▼──────────────┐
                                 │ Isolation Forest        │
                                 │ dilatih pada NOAA NDBC  │
                                 │ + rubrik risiko         │
                                 └──────────┬──────────────┘
                                            │ JSON /api/v1
                                 ┌──────────▼──────────────┐
                                 │ Dasbor Next.js          │
                                 │ Leaflet · Recharts      │
                                 └─────────────────────────┘
```

**Lapisan dan tanggung jawab:**

| Lapisan | Modul | Tanggung jawab |
| --- | --- | --- |
| Sumber | `services/simulator.py` | Deret telemetri koheren, tiga profil kondisi, seed deterministik |
| Sumber | `services/satellite/` | Adapter penyedia-agnostik, Copernicus STAC, cache quicklook, fallback |
| Integrasi | `services/ingestion.py` + `validation.py` | Satu jalur ingesti; rentang kewajaran, zona waktu, posisi, provenans, duplikat, karantina |
| Integrasi | `services/time_sync.py` | Asosiasi buoy–satelit dalam jendela 30 menit yang dapat dikonfigurasi |
| Analitik | `app/ml/` + `services/analytics.py` | Fitur, kalibrasi, skor, rubrik, penjelasan, pembuatan peringatan |
| Aplikasi | `api/v1/routers/` + `frontend/` | Pembacaan publik, penulisan ber-API-key, UI |

**Keputusan desain yang menentukan:**

1. **Provenans di dalam skema, bukan di prosa.** `source_type`, `validation_status`,
   `validation_errors`, `simulation_id`, `idempotency_key`, waktu akuisisi dan atribusi disimpan per
   baris dan ditampilkan di UI.
2. **Tidak valid ≠ dihapus.** Baris di luar rentang disimpan dengan status `invalid` dan dikecualikan
   dari grafik/analitik.
3. **Fail closed pada penulisan.** Endpoint istimewa mewajibkan `X-API-Key`; jika tidak ada kunci
   terkonfigurasi, API mengembalikan 503 alih-alih menerima tulisan anonim.
4. **Degradasi yang dirancang.** Timeout penyedia, respons cacat, artefak model hilang, dan jendela
   observasi kosong masing-masing punya perilaku eksplisit; kegagalan satelit tidak menghentikan
   pemantauan buoy.
5. **Topologi produksi:** frontend Next.js di Vercel, API FastAPI sebagai Vercel Function, basis data
   Supabase PostgreSQL 17 + PostGIS 3.3.7 (11 tabel + `alembic_version`). Isolation Forest diekspor
   menjadi artefak runtime `.npz` dan diskor dengan NumPy agar muat batas 250 MB per fungsi;
   scikit-learn hanya dibutuhkan saat pelatihan.
6. **Telemetri terjadwal:** workflow GitHub Actions memanggil `POST /simulator/backfill` tiap 15 menit
   agar jendela data tetap segar pada deployment serverless tanpa proses latar permanen.

---

## 7. Fitur per Halaman

### 7.1 Lapisan warga (tanpa akun, tanpa API key)

| Rute | Isi |
| --- | --- |
| `/` Beranda | Penjelasan produk, tiga kelompok pengguna dan batasnya, cara kerja tiga langkah, catatan provenans, ajakan membuka alat pemeriksaan |
| `/cek` Cek Kondisi | Pilih pantai + aktivitas → status **Aman/Hati-hati/Tunda**, alasan singkat (ombak, angin, peringatan aktif), grafik ombak 24 jam dengan garis batas aktivitas, peta tiga pantai, bagikan WhatsApp, tautan ke detail teknis |
| `/ringkasan` Kabar Laut | Dua kalimat bahasa sehari-hari per pantai dan aktivitas; fallback template bila penyedia bahasa tidak tersedia |
| `/belajar` Belajar | Kamus istilah laut (ombak, periode, angin, tekanan, peringatan) dan eksperimen slider ombak/angin per aktivitas |
| `/alerts` Pemberitahuan | Daftar peringatan aktif, read-only, berakhir otomatis setelah 6 jam |

Status dihitung berurutan: default `tenang` → cek `tunda` → cek `hati` → data lebih tua dari 30 menit
tidak boleh tetap `tenang`. Urutan ini memastikan data basi tidak pernah tampil sebagai kabar baik.

### 7.2 Konsol teknis (dibuka lewat "Mode Admin (demo)")

| Rute | Isi |
| --- | --- |
| `/konsol` | Baris KPI (titik buoy, rata-rata gelombang, peringatan terbuka, rekaman satelit, model), grafik keadaan laut per zona, status zona, snapshot AI dengan faktor penyumbang, antrean peringatan, kesegaran sumber, status gateway |
| `/ocean` | Telemetri tujuh parameter, grafik gelombang/angin dan tekanan/periode, tabel pembacaan, panel provenans lengkap, kontrol simulator |
| `/satellite` | Peta Leaflet (poligon zona, buoy, footprint Sentinel-2), formulir sinkronisasi STAC nyata, galeri akuisisi dengan quicklook, tutupan awan, CRS, atribusi |
| `/ai` | Kartu model, formulir eksekusi, indeks anomali pada skala ambang terkalibrasi, skor dan level risiko, faktor penyumbang, rekomendasi, keterbatasan, riwayat analisis |
| `/sources` | Kesehatan database/model/simulator/penyedia, kesegaran sumber, gerbang validasi, lineage, permukaan API publik |

**Model akses.** Tidak ada login pengguna. Layar baca bersifat publik. Jalur tulis (ingesti buoy,
skenario simulator, sinkronisasi satelit, eksekusi analisis) memerlukan header `X-API-Key`; antarmuka
operator mengirimkan kunci demo yang didokumentasikan (`pantaupesisir-demo-2026`) secara otomatis
sehingga setiap kontrol dapat diuji juri tanpa hambatan. Kunci demo bukan kredensial produksi dan
disimpan di `sessionStorage`, bukan cookie.

**PWA.** Aplikasi dapat dipasang (manifest, ikon 192/512/maskable, service worker, halaman offline).
Permintaan ke `/api/*` tidak pernah di-cache agar data operasional selalu segar.

---

## 8. Sumber Data dan Provenans

Prinsip: setiap angka harus menjawab "dari mana ini berasal, dan kapan?".

| Sumber | Yang dipakai | Akses | Lisensi / atribusi | Status |
| --- | --- | --- | --- | --- |
| **Copernicus Data Space Ecosystem — Sentinel-2 L2A STAC** | Metadata produk, footprint, waktu akuisisi, tutupan awan, CRS, thumbnail quicklook. Tanpa unduhan raster. | `GET https://stac.dataspace.copernicus.eu/v1/search`, tanpa autentikasi | Data Sentinel gratis/terbuka; "Contains modified Copernicus Sentinel data" | Panggilan live mengembalikan item nyata; quicklook di-cache |
| **NOAA NDBC historical stdmet** | Observasi 10 menit nyata untuk **melatih** model anomali | Arsip `.txt.gz` terbuka | Domain publik (karya pemerintah federal AS) | 41.104 baris valid, stasiun 51002 + 41010, 2022–2024 |
| **OpenStreetMap** | Hanya tile peta dasar | `tile.openstreetmap.org` | © OpenStreetMap contributors, ODbL | Dengan atribusi |
| **Telemetri buoy** | Tujuh parameter, aliran kontinu | Gateway telemetri PantauPesisir | Internal | **Disimulasikan**, diberi label `source_type="simulated"` |

**Pemisahan yang ditegakkan di UI.** Badge sumber selalu berupa teks, tidak pernah warna saja:

- `Telemetri buoy` — pembacaan sintetis dari simulator, tertaut ke baris `simulations`. Bukan
  pengukuran buoy nyata.
- `Satelit · historis` — rekaman katalog Copernicus nyata, dengan waktu akuisisi asli. Bukan citra
  live, bukan tinggi gelombang, bukan batimetri.
- `Dataset historis` — baris NOAA NDBC yang dipakai offline untuk melatih model. Bukan masukan
  prediksi live.
- `Keluaran model` — skor Isolation Forest + rubrik + penjelasan. Bukan observasi, bukan probabilitas
  bencana.

**Soal telemetri yang disimulasikan.** Kami menyatakannya terbuka di sini dan di README: saat ini
belum ada perangkat keras lapangan, sehingga deret telemetri dihasilkan simulator. Simulator
menghasilkan deret yang koheren — baseline klimatologi per zona, transisi berpegas AR(1) dengan noise,
periode gelombang terikat pada tinggi ombak, anomali berbentuk pulsa yang meluruh dalam ±6 menit — dan
mengalir melalui jalur ingesti, gerbang validasi, serta catatan provenans yang sama dengan perangkat
lapangan. Artinya gateway mitra dapat disambungkan tanpa perubahan UI atau skema. Kami tidak
menyebutnya pengukuran nyata, dan badge di antarmuka menyatakan sumbernya.

**Contoh rekaman satelit terverifikasi:** `S2A_MSIL2A_20261116T030141_N0513_R032_T48MYU_20261116T092508`,
diakuisisi `2026-11-16T03:01:41Z`, bbox `[106.80, -6.42, 107.80, -5.42]`, tutupan awan 99,87%, CRS
`EPSG:32748`. Angka tutupan awan itu sendiri menjelaskan keterbatasan citra optik — dan sistem
menampilkannya, tidak menyembunyikannya.

**Asosiasi temporal.** Buoy dan satelit dipasangkan jika berada di zona yang sama dalam jendela 30
menit (dapat dikonfigurasi). Ini kebijakan pencocokan operasional, bukan standar ilmiah. Dataset yang
tidak berpasangan tetap disimpan dan dicantumkan; nilai buoy maupun satelit tidak pernah diubah.

---

## 9. Metrik dan Evaluasi

**Pengujian otomatis.** 44 pengujian backend lulus pada 2026-11-18 (Python 3.12.10, FastAPI 0.163.1,
scikit-learn 1.9.1, Next.js 15.5.29), dijalankan terhadap SQLite sementara terisolasi dengan zona
ter-seed. Tidak ada panggilan jaringan ke penyedia selama pengujian: adapter satelit diuji dengan
`httpx.MockTransport`. `npx tsc --noEmit` bersih; `next build` menghasilkan 9/9 halaman statis. Cakupan
yang diuji mencakup jalur bahagia dan jalur gagal: ingesti tanpa kunci (401), timestamp naive (422),
koordinat di luar rentang (422), tinggi gelombang tidak masuk akal (dikarantina), provenans tidak
cocok (dikarantina), duplikat idempoten, timeout penyedia, respons cacat, model tidak tersedia, jendela
observasi kosong, pemberitahuan kedaluwarsa, dan kebocoran fitur ke masa depan.

**Kontrak perilaku model** (`scripts/check_model_behavior.py`, seed `20261118`, 18 sampel, 3 zona):

| Skenario | Severity anomali | Ter-flag | Level rubrik |
| --- | --- | --- | --- |
| normal | 0,06–0,11 | tidak | rendah (14–17) |
| warning | ~0,00 | tidak (memang) | sedang (35,6–43,5) |
| extreme | 0,97 | ya | sedang–tinggi (54–67) |

**Kontrak cerita produk.** Satu kondisi, tiga keputusan. Batch manual 12 × 300 detik pada Teluk
Jakarta: skenario Normal → ketiga aktivitas **Aman** (0,9 m); Waspada (2,35 m, rubrik 33,3) → perahu
kecil **Tunda**, wisata pantai dan pelabuhan **Hati-hati**; Ekstrem (7,7 m) → semua **Tunda**. Aturan
ini diuji secara otomatis agar batch "Normal" tidak pernah melewati batas perahu kecil.

**Verifikasi live.** Pencarian STAC Copernicus tanpa autentikasi mengembalikan item nyata; quicklook
JPEG 343×343 terunduh dan di-cache; arsip NDBC terunduh untuk lima stasiun-tahun; bootstrap demo
menghasilkan 7 dataset di 3 zona; alur ekstrem end-to-end menghasilkan risiko tinggi 87,5 dengan
anomali 0,98 dan pemberitahuan yang terbentuk lalu berakhir otomatis.

---

## 10. Dampak dan Keberlanjutan

**Dampak yang dapat diklaim.** Untuk nelayan kecil, wisata pantai, dan operator pelabuhan, sistem
memadatkan tiga hal yang biasanya terpisah — angka kondisi laut, batas aman aktivitas mereka, dan
kesegaran data — menjadi satu keputusan yang bisa langsung dipakai. Pengguna juga dapat melihat *mengapa*
sebuah status keluar, bukan sekadar menerimanya.

**Dampak yang tidak diklaim.** Sistem tidak mengurangi korban bencana, tidak menggantikan prakiraan
BMKG, dan tidak memiliki data lapangan Indonesia untuk mengukur akurasi lokal. Kami tidak memiliki
studi pengguna. Angka yang bisa dibuktikan adalah angka teknis di bagian 9, bukan angka dampak sosial.

**Keberlanjutan teknis.**

- Semua sumber data publik dan tanpa biaya lisensi; tidak ada ketergantungan pada API berbayar.
- Jalur ingesti sudah menerima perangkat keras nyata. Menghubungkan buoy fisik tidak memerlukan
  perubahan UI atau skema — hanya penggantian sumber telemetri dan penonaktifan label simulasi.
- Model punya jalur versi eksplisit (`cews-iforest-v1`); perubahan fitur, kalibrasi, atau data latih
  mewajibkan string versi baru, tidak pernah penimpaan diam-diam.
- Biaya operasional saat ini berada pada tier gratis Vercel dan Supabase.
- Repositori berlisensi MIT dan riwayat commit dipertahankan.

---

## 11. Keterbatasan dan Etika

Bagian ini ditulis karena kejujuran adalah bagian dari desain, bukan formalitas.

1. **Bukan peringatan resmi.** PantauPesisir adalah prototipe pendukung keputusan. Sistem ini bukan
   sistem peringatan tsunami, bukan layanan prakiraan bersertifikat, dan bukan pengganti BMKG, BPBD,
   atau otoritas lain. Pengguna harus tetap merujuk pada informasi resmi.
2. **Skor anomali bukan probabilitas bencana.** Nilai 0,97 berarti "jendela ini tidak biasa
   dibanding perilakunya sendiri", bukan "97% kemungkinan terjadi bencana". Tidak ada label bahaya
   dalam data latih, sehingga kalibrasi terhadap kejadian nyata belum mungkin dilakukan.
3. **Pergeseran domain model.** Model dilatih pada stasiun lepas pantai Hawaii dan Florida, bukan
   perairan Indonesia. Fitur relatif dan kalibrasi ambang mengurangi sensitivitas terhadap perbedaan
   rezim, tetapi validasi pada perairan lokal belum dilakukan dan masuk rencana pengujian berikutnya.
4. **Telemetri disimulasikan.** Belum ada perangkat keras lapangan. Semua pembacaan buoy saat ini
   sintetis dan diberi label demikian di skema data dan di antarmuka.
5. **Satelit optik bukan pengukur gelombang.** Sentinel-2 tidak mengukur tinggi gelombang, batimetri,
   atau potensi tsunami. Citra dipakai sebagai konteks kondisi pesisir dan tidak menggantikan
   pembacaan buoy. Asosiasi 30 menit adalah kebijakan operasional, bukan standar ilmiah.
6. **Ambang aktivitas adalah panduan prototipe.** Nilai 1,5/2,0/2,5/3,0 m dan 8/10/12 m/s disusun
   untuk pantai Indonesia kondisi tenang-sedang; ini bukan skala BMKG dan belum divalidasi bersama
   nelayan atau operator setempat.
7. **Risiko rasa aman palsu.** Skor rendah harus dibaca bersama rubrik dan tren; sistem menampilkan
   kaveat pada setiap keluaran analisis untuk alasan ini.
8. **Alarm palsu.** Skor tinggi dapat mencerminkan artefak sensor atau fluktuasi jinak. Model perilaku
   sengaja tidak menandai laut tinggi yang stabil.
9. **Cakupan pengujian.** Pengujian otomatis berjalan di SQLite; migrasi PostgreSQL/PostGIS diuji pada
   Supabase, tetapi pemeriksaan lintas peramban (Safari/Firefox) dan perangkat mobile fisik belum
   dilakukan — hanya Chromium headless selama pengembangan.
10. **Pembatasan laju per proses.** Limiter saat ini tidak terdistribusi; deployment multi-instans
    memerlukan limiter bersama.

---

## 12. Pengungkapan Penggunaan AI dan Pustaka Pihak Ketiga

**Asisten pengodean AI.** Sebagian perancah implementasi, teks antarmuka, dan dokumentasi disusun
dengan bantuan asisten pengodean AI. Pengungkapan ini diberikan sesuai persyaratan buku panduan
IT RUSH 2026 bagian V.5. Arsitektur, aturan validasi data, perilaku API, evaluasi model, dan pengujian
otomatis dirancang, dijalankan, dan ditinjau oleh tim. Setiap dataset, endpoint, dan hasil yang
dilaporkan dalam repositori diverifikasi dengan menjalankannya, bukan diambil dari teks yang
dihasilkan. Tidak ada templat UI yang disalin; sistem visual dibangun untuk proyek ini.

**Model AI dalam produk.** Dua komponen, keduanya dijelaskan di bagian 5: Isolation Forest
(`scikit-learn`) untuk deteksi anomali, dan penyedia model bahasa pihak ketiga (DeepSeek melalui API
kompatibel [OI]) untuk penulisan ulang kalimat di halaman Kabar Laut. Kunci penyedia disimpan sebagai
variabel server dan tidak pernah dikirim ke browser.

**Pustaka backend:** FastAPI, Starlette, Pydantic, SQLAlchemy, Alembic, GeoAlchemy2, Shapely, NumPy,
pandas, scikit-learn, joblib, httpx, pytest.

**Pustaka frontend:** Next.js, React, TypeScript, Tailwind CSS, Recharts, Leaflet, react-leaflet,
lucide-react.

**Data pihak ketiga:** NOAA NDBC (domain publik), Copernicus Data Space Ecosystem (data Sentinel
gratis/terbuka), OpenStreetMap (ODbL, hanya peta dasar).

**Lisensi karya:** MIT (tim perlu mengonfirmasi pilihan lisensi final sebelum pengumpulan).

**Ketersediaan kode:** <https://github.com/ahdikhfDev/Ahdi-Syamil-Lomba>, riwayat commit utuh.

---

## 13. Rencana Pengembangan

| Tahap | Sasaran | Alasan |
| --- | --- | --- |
| 1 | Validasi lapangan: satu buoy fisik atau data arus pesisir nyata | Menghapus ketergantungan pada telemetri simulasi dan menguji jalur ingesti pada perangkat sungguhan |
| 2 | Data latih perairan Indonesia (buoy lokal / Copernicus Marine Service) dan kalibrasi ulang ambang | Menutup pergeseran domain yang diakui di bagian 11 |
| 3 | Label bahaya dari advisory resmi untuk evaluasi supervised | Memungkinkan precision/recall nyata, bukan hanya proksi |
| 4 | Pemantauan drift model dan dashboard kalibrasi | Menjaga ambang tetap sahih saat data berubah |
| 5 | Unduhan raster Sentinel-2 resolusi penuh (OIDC/S3) dan layer pesisir olahan | Memperluas konteks visual di luar metadata dan quicklook |
| 6 | Limiter terdistribusi, observabilitas, dan uptime monitoring | Kesiapan multi-instans |
| 7 | Uji coba terbatas dengan kelompok nelayan/pengelola pantai setempat | Menguji keterbacaan status dan ambang aktivitas bersama pengguna nyata |

---

## 14. Daftar Pustaka dan Referensi

1. Copernicus Data Space Ecosystem. *Sentinel-2 Level-2A — STAC API documentation*.
   <https://documentation.dataspace.copernicus.eu/APIs/STAC.html> (diakses 18 November 2026).
2. Copernicus Data Space Ecosystem. *Portal data*. <https://dataspace.copernicus.eu/>
   (diakses 18 November 2026).
3. NOAA National Data Buoy Center. *Historical standard meteorological data (stdmet)*.
   <https://www.ndbc.noaa.gov/data/historical/stdmet/> (diakses 18 November 2026).
4. NOAA National Data Buoy Center. *Stasiun 51002 dan 41010*. <https://www.ndbc.noaa.gov/>
   (diakses 18 November 2026).
5. OpenStreetMap Foundation. *Tile usage policy*.
   <https://operations.osmfoundation.org/policies/tiles/> (diakses 18 November 2026).
6. Liu, F. T., Ting, K. M., & Zhou, Z.-H. (2008). Isolation Forest. *Proceedings of the 8th IEEE
   International Conference on Data Mining (ICDM)*, 413–422.
7. Dokumentasi internal proyek: `README.md`; `docs/ARCHITECTURE.md`; `docs/AI_MODEL_CARD.md`;
   `docs/DATA_CATALOG.md`; `docs/DATA_PROVENANCE.md`; `docs/DATABASE_SCHEMA.md`;
   `docs/API_CONTRACT.md`; `docs/TEST_PLAN.md`; `docs/DEMO_SCRIPT.md`.
8. Karya: PantauPesisir. <https://pantaupesisir-three.vercel.app> ·
   <https://github.com/ahdikhfDev/Ahdi-Syamil-Lomba>

---

## Lampiran A — Data yang Perlu Dilengkapi Tim

| Butir | Status |
| --- | --- |
| Nama tim resmi | `[NAMA TIM]` |
| Nama dan peran anggota | `[ANGGOTA 1]`, `[ANGGOTA 2]` |
| Asal sekolah/universitas | `[ISI TIM]` |
| URL video demo (YouTube unlisted, 3–5 menit) | `[ISI TIM]` |
| Tangkapan layar untuk lampiran | tersedia di `docs/screenshots/` |
| Pernyataan orisinalitas dan AI (templat penyelenggara) | `[ISI TIM]` |
| Konfirmasi lisensi final | MIT, perlu konfirmasi tim |

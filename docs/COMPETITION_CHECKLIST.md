# Daftar periksa pengumpulan IT RUSH 2026

Tenggat yang tercatat di buku panduan: **20 November 2026, 23:59 WIB**. Penjurian 28–29 November 2026.
Pengumuman pemenang 30 November 2026. Situs yang telah diterapkan harus tetap aktif hingga 30 November 2026.

Legenda status: ✅ selesai · 🟡 selesai sebagian / perlu tindakan tim · ⛔ belum selesai

## 1. Luaran

| Persyaratan | Status | Bukti / tindakan |
| --- | --- | --- |
| Aplikasi web, publik dan telah diterapkan | ⛔ | Kode sumber lengkap; terapkan `frontend/` + `backend/` + PostGIS (langkah di README §9). Memerlukan kredensial tim. |
| Repositori GitHub/GitLab publik | ⛔ | Repositori lokal belum diinisialisasi. Jalankan `git init`, tambahkan commit secara bertahap, publikasikan. Jangan menulis ulang riwayat. |
| AI terintegrasi pada setidaknya satu fitur | ✅ | Penyaringan anomali Isolation Forest + rubrik risiko transparan; laman `/ai`; model card. |
| Situs aktif tetap tersedia hingga 30 Nov 2026 | ⛔ | Menyusul penerapan; atur pengingat dan pemeriksaan uptime. |
| Tech stack gratis / templat diungkapkan | ✅ | README §12 mengungkapkan pustaka, data, dan bantuan AI. |
| Login demo (jika login tersedia) | ✅ (n/a) | Tidak ada login pengguna. Kunci demo publik `pantaupesisir-demo-2026` didokumentasikan di README; tidak ada kredensial istimewa yang terekspos. |
| Video demo YouTube tidak publik, 3–5 menit | ⛔ | Naskah siap: `docs/DEMO_SCRIPT.md` (4:00). |
| Proposal PDF `ITRUSH26_Nama Tim_JudulKarya.pdf` | ⛔ | Konten tersedia di README/docs; perlu pemformatan dan pengumpulan oleh tim. |
| Pernyataan orisinalitas dan AI dalam PDF (templat penyelenggara) | ⛔ | Gunakan templat penyelenggara; ungkapkan bantuan pengodean AI dan pustaka open-source. |
| Dokumen pendaftaran / bukti peserta | ⛔ | Tanggung jawab tim; tidak ditangani di repositori ini. |

## 2. Kriteria penerimaan fungsional

| # | Kriteria | Status | Lokasi |
| --- | --- | --- | --- |
| 1 | Simulator buoy mengirim data secara otomatis dan manual | ✅ | `POST /simulator/scenarios` (manual/otomatis), `/simulator/tick`, `/ocean#simulator` |
| 2 | Backend memvalidasi dan menyimpan observasi | ✅ | `validation.py`, 8 uji ingesti |
| 3 | Setidaknya satu API satelit diteliti + integrasi yang berfungsi atau fallback terdokumentasi | ✅ | Copernicus CDSE STAC live; fallback cache diuji |
| 4 | Metadata satelit dan waktu akuisisi dipertahankan | ✅ | `satellite_datasets`, laman `/satellite` |
| 5 | Asosiasi buoy/satelit tanpa pemaksaan kecocokan | ✅ | Jendela 30 menit, ID yang tidak cocok dipertahankan |
| 6 | Model ML dimuat dan menghasilkan luaran yang dapat direproduksi | ✅ | `cews-iforest-v1`, artefak dengan seed, uji |
| 7 | Analisis risiko jelas dan dapat ditelusuri | ✅ | Kaveat, versi rubrik, kata-kata rekomendasi |
| 8 | Frontend menampilkan data backend, bukan nilai hard-coded | ✅ | Semua laman mengambil `/api/v1` |
| 9 | Kegagalan penyedia tidak mengganggu pemantauan buoy | ✅ | Uji fallback + baris status |
| 10 | Situs web publik dan repositori publik tersedia | ⛔ | Penerapan + publikasi repo masih tertunda |
| 11 | README, katalog data, model card, penyiapan lengkap | ✅ | README + `docs/*` |
| 12 | Tidak ada klaim peringatan operasional yang keliru | ✅ | Teks, kaveat, model card, disclaimer footer |

## 3. Dokumentasi

| Luaran | Status | Berkas |
| --- | --- | --- |
| README (penyiapan, arsitektur, env, demo, penerapan) | ✅ | `README.md` |
| Arsitektur + diagram | ✅ | `docs/ARCHITECTURE.md` |
| Kontrak API | ✅ | `docs/API_CONTRACT.md` |
| Katalog data + scorecard + lisensi | ✅ | `docs/DATA_CATALOG.md` |
| Peta provenans data | ✅ | `docs/DATA_PROVENANCE.md` |
| Model card AI | ✅ | `docs/AI_MODEL_CARD.md` |
| Skema basis data / ERD / migrasi | ✅ | `docs/DATABASE_SCHEMA.md` |
| Rencana uji + hasil | ✅ | `docs/TEST_PLAN.md` |
| Naskah demo | ✅ | `docs/DEMO_SCRIPT.md` |
| Daftar periksa kompetisi | ✅ | berkas ini |
| `.env.example` | ✅ | root repositori + `frontend/.env.local.example` |
| LICENSE | 🟡 | Berkas MIT ditambahkan; tim harus mengonfirmasi pilihan lisensi |

## 4. Pemetaan kriteria penjurian

| Kriteria (bobot) | Cara PantauPesisir menjawabnya | Bukti |
| --- | --- | --- |
| Fungsionalitas situs web & kualitas teknis (25%) | Irisan vertikal API/basis data/ML/UI yang berfungsi, validasi, uji, status error/kosong/basi, konfigurasi siap penerapan | 37 uji, pemeriksaan API live, build |
| Inovasi & ketepatan solusi (20%) | Pemisahan deteksi anomali perilaku dan tingkat keparahan absolut; integrasi penyedia terverifikasi; ambang terkalibrasi dengan keterbatasan yang dipublikasikan | Model card, UI `/ai` |
| Relevansi tema & dampak (15%) | Subtema 3: intelijen kondisi pesisir terverifikasi bagi nelayan, usaha kecil, operator pelabuhan | README §10, teks rekomendasi |
| Desain UI/UX (15%) | Desain responsif yang dirancang khusus, badge sumber data yang konsisten, satuan di mana-mana, kaveat yang jujur | 6 laman, tangkapan layar di `docs/screenshots/` |
| Kualitas kode sumber (15%) | Monolit modular, skema bertipe, keputusan terdokumentasi, geometri terdialek, uji adversarial | struktur repositori, docs |
| Dokumentasi (10%) | Semua dokumen wajib tersedia dengan sumber terverifikasi dan hasil bertanggal | `docs/` |

## 5. Kesenjangan yang diketahui sebelum pengumpulan

1. **Terapkan** backend + frontend + PostGIS terkelola; verifikasi migrasi PostgreSQL/indeks GiST.
2. **Inisialisasi git** dan commit secara bertahap yang bermakna; publikasikan repositori secara publik.
3. **Rekam** video demo dan unggah sebagai tidak publik.
4. **Tulis dan ekspor** proposal PDF dengan nama berkas yang disyaratkan, serta lengkapi pernyataan
   AI/orisinalitas.
5. **Pemeriksaan lintas peramban/mobile** (hanya Chromium headless yang tersedia selama pengembangan).
6. **Rotasi secret** untuk produksi dan setel `DEMO_MODE=false` jika akun operator nyata ditambahkan.
7. **Konfirmasi subtema** dengan tim. Jika subtema 1 (mitigasi bencana) dipilih, tulis ulang posisi
   proposal secara konsisten; implementasi mendukung kedua kerangka tersebut.

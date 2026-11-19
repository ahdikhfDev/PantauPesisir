# Daftar periksa pengumpulan IT RUSH 2026

Tenggat yang tercatat di buku panduan: **20 November 2026, 23:59 WIB**. Penjurian 28–29 November 2026.
Pengumuman pemenang 30 November 2026. Situs yang telah diterapkan harus tetap aktif hingga 30 November 2026.

Legenda status: ✅ selesai · 🟡 selesai sebagian / perlu tindakan tim · ⛔ belum selesai

## 1. Luaran

| Persyaratan | Status | Bukti / tindakan |
| --- | --- | --- |
| Aplikasi web, publik dan telah diterapkan | ✅ | <https://pantaupesisir-three.vercel.app> (frontend) dan <https://pantaupesisir-api-lovat.vercel.app/api/v1> (API). Basis data Supabase PostgreSQL 17 + PostGIS 3.3.7. |
| Repositori GitHub/GitLab publik | ✅ | <https://github.com/ahdikhfDev/Ahdi-Syamil-Lomba> |
| AI terintegrasi pada setidaknya satu fitur | ✅ | Penyaringan anomali Isolation Forest + rubrik risiko transparan; laman `/ai`; model card. |
| Situs aktif tetap tersedia hingga 30 Nov 2026 | 🟡 | Sudah aktif. Perlu pemeriksaan berkala sampai 30 November 2026. |
| Tech stack gratis / templat diungkapkan | ✅ | README §12 mengungkapkan pustaka, data, dan bantuan AI. |
| Login demo (jika login tersedia) | ✅ (n/a) | Tidak ada login pengguna. Kunci demo publik `pantaupesisir-operator-2026` hanya membuka kendali simulator dan analisis, didokumentasikan di README; tidak ada kredensial istimewa yang terekspos. |
| Video demo YouTube tidak publik, 3–5 menit | ⛔ | Naskah siap: `docs/DEMO_SCRIPT.md` (4:00). |
| Proposal PDF `ITRUSH26_Nama Tim_JudulKarya.pdf` | 🟡 | `docs/PROPOSAL_PantauPesisir.docx` sudah mengikuti templat resmi (BAB I-IV + Daftar Pustaka, 14 rujukan). Sisa: isi `[NAMA TIM]`, `[NIM]`, `[LOGO WEBSITE]`, lalu ekspor ke PDF dengan nama berkas yang benar. |
| Pernyataan orisinalitas dan AI dalam PDF (templat penyelenggara) | 🟡 | `docs/PERNYATAAN_PantauPesisir.docx` sudah memakai templat resmi dengan opsi "Menggunakan AI" tercentang dan empat baris pengungkapan. Sisa: isi identitas tim, materai, ekspor PDF. |
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
| 10 | Situs web publik dan repositori publik tersedia | ✅ | Frontend, API, dan repositori publik sudah live |
| 11 | README, katalog data, model card, penyiapan lengkap | ✅ | README + `docs/*` |
| 12 | Tidak ada klaim peringatan operasional yang keliru | ✅ | Teks, kaveat, dan model card |

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
| Fungsionalitas situs web & kualitas teknis (25%) | Irisan vertikal API/basis data/ML/UI yang berfungsi, validasi, uji, status error/kosong/basi, konfigurasi siap penerapan | 44 uji, pemeriksaan API live, build |
| Inovasi & ketepatan solusi (20%) | Pemisahan deteksi anomali perilaku dan tingkat keparahan absolut; integrasi penyedia terverifikasi; ambang terkalibrasi dengan keterbatasan yang dipublikasikan | Model card, UI `/ai` |
| Relevansi tema & dampak (15%) | Subtema 4, mitigasi bencana dan perubahan iklim: peringatan dini lokal dari deteksi anomali, ambang per aktivitas, peringatan berbatas waktu | README §10, halaman `/ai`, `/alerts` |
| Desain UI/UX (15%) | Desain responsif yang dirancang khusus, badge sumber data yang konsisten, satuan di mana-mana, kaveat yang jujur | 6 laman, tangkapan layar di `docs/screenshots/` |
| Kualitas kode sumber (15%) | Monolit modular, skema bertipe, keputusan terdokumentasi, geometri terdialek, uji adversarial | struktur repositori, docs |
| Dokumentasi (10%) | Semua dokumen wajib tersedia dengan sumber terverifikasi dan hasil bertanggal | `docs/` |

## 5. Kesenjangan yang diketahui sebelum pengumpulan

1. **Rekam** video demo 3-5 menit dan unggah sebagai Unlisted di YouTube. Naskah di `docs/DEMO_SCRIPT.md`.
2. **Lengkapi identitas** pada `docs/PROPOSAL_PantauPesisir.docx` dan `docs/PERNYATAAN_PantauPesisir.docx`,
   lalu ekspor ke PDF dengan nama `ITRUSH26_Nama Tim_JudulKarya.pdf`.
3. **Pemeriksaan lintas peramban/mobile** (hanya Chromium headless yang tersedia selama pengembangan).
4. **Rotasi secret** yang pernah dibagikan lewat kanal tidak aman, dan setel `DEMO_MODE=false` jika
   akun operator nyata ditambahkan.
5. **Matikan domain lama** `pantaupesisir.vercel.app` bila itu deployment tim, agar penilai tidak
   membuka versi yang salah.

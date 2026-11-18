# Kartu model AI — `cews-iforest-v1`

> **Tipe model:** model penyaringan anomali berbasis Isolation Forest untuk telemetri buoy pesisir.

## 1. Tujuan

Memberi skor seberapa tidak biasa sebuah jendela singkat telemetri buoy pesisir **relatif terhadap
perilakunya sendiri yang terkini**, sehingga operator dapat melihat apakah ada yang berubah dalam satu
jam terakhir. Rubrik terpisah yang transparan menilai tingkat keparahan absolut. Model merupakan salah
satu masukan bagi tampilan intelijen risiko, bersama rubrik yang dapat ditelusuri.

## 2. Penggunaan yang dimaksudkan

- Demonstrasi dan edukasi untuk IT RUSH 2026.
- Penyaringan telemetri buoy pesisir yang mengalir melalui gateway PantauPesisir.
- Menunjukkan kepada juri dan pengguna pipeline ML yang lengkap dan dapat dijelaskan, dengan data
  training nyata dan evaluasi yang jujur.

## 3. Di luar cakupan / penggunaan yang dilarang

- Deteksi tsunami, penerbitan peringatan, atau panduan evakuasi.
- Respons darurat, navigasi, pencarian dan pertolongan, atau keputusan asuransi.
- Memprediksi harga ikan, pendapatan, permintaan pasar, atau hasil ekonomi apa pun.
- Mengklaim kesiapan operasional atau validasi ilmiah.
- Menyimpulkan tinggi gelombang, batimetri, atau arus dari citra satelit optik.

## 4. Data pelatihan

| Item | Nilai |
| --- | --- |
| Dataset | Data meteorologi standar historis NOAA NDBC (`stdmet`) |
| Penyedia | NOAA National Data Buoy Center |
| Akses | Arsip publik, tanpa autentikasi (`https://www.ndbc.noaa.gov/data/historical/stdmet/`) |
| Lisensi | Domain publik (karya pemerintah federal AS) |
| Stasiun | 51002 (SW Hawaii, 17.070 N 157.755 W) dan 41010 (Canaveral East, 28.860 N 78.478 W) |
| Tahun | 2022–2024 |
| Baris valid | 41,104 |
| Kadensi | ~10 menit, pemutusan sensor dipertahankan |
| Tanggal pengambilan | 2026-11-18 |
| File provenans | `backend/ml/data/ndbc_wave_training.provenance.json` |

Baris yang kehilangan salah satu variabel inti (tinggi gelombang, periode, kecepatan angin, arah angin,
tekanan, suhu laut) dihapus; nilai sentinel NDBC (99/999/9999) dihapus terlebih dahulu.

**Kesenjangan domain:** stasiun training berada di perairan lepas pantai AS, sedangkan operasi berjalan
pada buoy pesisir Indonesia. Model mempelajari perilaku *relatif* untuk mengurangi sensitivitas terhadap
rezim; validasi pada perairan lokal masuk rencana pengujian berikutnya.

## 5. Fitur (11, hanya trailing)

| Fitur | Rasional |
| --- | --- |
| `wave_height_m` | Tingkat absolut keadaan laut |
| `air_pressure_hpa` | Tingkat absolut tekanan |
| `wave_height_rel_dev` | (H − 6-sample mean) / mean — perubahan lokal |
| `wave_steepness_rel_dev` | Kecuraman terhadap rata-rata terkininya |
| `wind_speed_rel_dev` | Angin terhadap rata-rata terkininya |
| `wave_period_rel_dev` | Periode terhadap rata-rata terkininya |
| `pressure_residual_hpa` | Tekanan dikurangi rata-rata 6 sampel |
| `pressure_rate_hpa_per_hour` | Kecenderungan tekanan yang dinormalisasi terhadap kadensi |
| `wave_height_change_ratio` | Perubahan gelombang relatif satu sampel |
| `sst_residual_c` | SST dikurangi rata-rata terkini |
| `wave_direction_change_deg` | Perubahan sudut absolut per sampel |

Statistik rolling menggunakan jendela trailing 6 sampel (`min_periods=2`). Fitur tidak pernah melihat ke
depan, sehingga pemisahan kronologis tidak membocorkan informasi masa depan.

**Mengapa fitur relatif:** iterasi pertama memakai periode, kecuraman, SST, dan encoding arah secara
absolut. Fitur-fitur itu mengodekan klimatologi laut lepas, sehingga setiap jendela normal teluk tropis
ditandai sebagai anomali maksimal (severity 1.0). Desain ulang mengukur penyimpangan lokal dan
mempertahankan severity absolut untuk rubrik. Hal ini didokumentasikan, bukan disembunyikan.

## 6. Prosedur pelatihan

- Pemisahan kronologis 80/20 berdasarkan waktu: **32,883 train / 8,221 validation** baris.
- Periode pelatihan: 2022-01-01 → 2024-09-16 (UTC). Validasi: 2024-09-16 → 2024-12-31 (UTC).
- Pipeline: `SimpleImputer(median)` → `StandardScaler` → `IsolationForest`.
- `n_estimators=250`, `contamination=0.01`, `max_samples="auto"`, `random_state=42`, `n_jobs=-1`.
- Preprocessing di-fit hanya pada potongan training.
- Versi environment: scikit-learn 1.9.1, pandas 3.1.1, numpy 2.5.4.

## 7. Kalibrasi threshold

Distribusi skor Isolation Forest mentah pada telemetri pesisir operasional berbeda dari distribusi training,
sehingga threshold operasional dikalibrasi pada **90 jendela skenario normal**
(3 zona × 30 seed deterministik, 18 sampel dengan jarak 5 menit):

- target laju flag: 10%
- laju flag teramati pada jendela tersebut: 10%
- threshold disimpan dalam artifact; API melaporkannya sebagai severity 0.50 melalui pemetaan logistik
  dengan jendela normal median dipetakan ke 0.10.

Ini adalah **detektor demonstrasi yang dikalibrasi terhadap skenario**. Laju flag pada telemetri pesisir
nyata akan memerlukan kalibrasi ulang dengan data nyata.

## 8. Evaluasi (potongan validasi nyata)

| Metrik | Nilai |
| --- | --- |
| Baris ter-flag pada threshold terpasang (terkalibrasi skenario) | **0.12%** |
| Proxy recall: perubahan tekanan cepat top-5% pada threshold referensi 1% | **6.47%** |
| Proxy recall: perubahan tinggi gelombang satu langkah yang cepat top-5% pada referensi yang sama | **2.19%** |
| Baseline pemilihan acak pada threshold referensi tersebut | **1.01%** |
| Median tinggi gelombang baris ter-flag | **6.29 m** |
| Median tinggi gelombang baris tidak ter-flag | **2.12 m** |
| Tinggi gelombang p95 teramati pada validasi | 3.68 m |

Interpretasi: flag lebih terkonsentrasi pada peristiwa perubahan cepat dan gelombang tinggi dibandingkan
pemilihan acak, dan baris ter-flag jauh lebih kasar daripada baris tipikal. Daya diskriminasi bersifat
**moderat**, tidak kuat. Tidak tersedia hazard label, sehingga recall/precision terhadap "kondisi
berbahaya" tidak dapat dihitung dan tidak diklaim.

Pemeriksaan perilaku pada jendela simulator deterministik (seed `20261118`, 18 sampel, 3 zona):

| Skenario | Severity anomali | Ter-flag | Level rubrik |
| --- | --- | --- | --- |
| normal | 0.06–0.11 | tidak | rendah (14–17) |
| warning | ~0.00 | tidak (memang) | sedang (35.6–43.5) |
| extreme | 0.97 | ya | sedang–tinggi (54–67) |

Skenario warning sengaja **tidak** ditandai oleh model *perilaku*: laut 2.4–3.2 m yang mantap
adalah keadaan normal bagi samudra terbuka tempat model dilatih, jadi tidak ada yang "aneh" secara
perilaku. Rubrik risiko absolut yang menaikkan jendela warning ke tingkat sedang. Pemisahan ini
merupakan fitur, bukan bug: anomali perilaku ≠ bahaya, dan bahaya ≠ anomali perilaku.

Reproduksi dengan `python backend/scripts/check_model_behavior.py` (keluar kode 0 = kontrak
terpenuhi: normal tidak ter-flag dan rendah, warning naik ke sedang, ekstrem ter-flag dan naik).

## 9. Output

Setiap eksekusi `analyses` menyimpan:

- jendela observasi, jumlah jendela yang diberi skor, ID observasi masukan
- flag anomali, skor (0–1), threshold terkalibrasi
- skor/level risiko dan versi rubrik
- faktor kontributor teratas (nilai, satuan, rata-rata baseline, deviasi terstandardisasi)
- teks penjelasan dan rekomendasi
- ringkasan kualitas data (sampling, proxy kelengkapan, proporsi sumber telemetri, asosiasi satelit)
- keterbatasan dan `is_simulated`

## 10. Risiko dan pertimbangan etis

- **Rasa aman yang palsu:** skor rendah perlu dibaca bersama rubrik dan tren jendela.
- **Alarm palsu:** skor tinggi dapat mencerminkan artefak sensor atau fluktuasi yang jinak.
- **Transparansi:** UI menampilkan faktor kontributor, versi model, dan kaveat pada setiap keluaran.
- **Pergeseran domain:** stasiun training berbeda dari perairan pesisir Indonesia; validasi lokal
  masuk rencana pengujian.

## 11. Reproduksibilitas

```bash
cd backend
python scripts/fetch_training_data.py     # downloads NDBC archives (public)
python scripts/train_model.py --version cews-iforest-v1
python scripts/check_model_behavior.py
python -m pytest -q                        # includes model/feature tests
```

Artifact:

- `backend/ml/artifacts/cews-iforest-v1.joblib` (di-commit, 2.2 MB)
- `backend/ml/artifacts/cews-iforest-v1.metrics.json`
- baris registry di `ml_models` (di-seed atau ditulis oleh skrip pelatihan)

## 12. Versioning dan pemeliharaan

- String versi: `cews-iforest-v1`; URI model dan nama feature disimpan bersama artifact.
- `ml_models` menyimpan algoritma, skema feature, periode pelatihan, metrik, dan flag aktif.
- Mengubah feature, kalibrasi, atau data training memerlukan **string versi baru** dan bagian kartu model
  yang baru; jangan pernah menimpa secara diam-diam dalam konteks operasional.
- Langkah berikutnya yang bernilai nyata: data training buoy lokal Indonesia/CMEMS, label supervised yang
  diturunkan dari advisory resmi, pemantauan drift, dan kalibrasi ulang terhadap laju flag yang terukur.

# Skrip demo (3–5 menit)

Target durasi: **4:00**. Rekam sebagai unlisted di YouTube. Voice-over + tangkapan layar situs yang
sudah di-deploy. Jaga setiap klaim tetap sesuai label aplikasi: telemetri buoy, rekaman satelit
historis, dan keluaran model analitik.

## Daftar periksa pra-rekaman

- [ ] Backend sehat: `/api/v1/system/health` → `status: ok`, model tersedia.
- [ ] Simulator berjalan (`SIMULATOR_AUTOSTART=true`, scope `ALL`) sehingga kartu zona tetap segar.
- [ ] Katalog satelit terisi (jalankan satu sinkronisasi sebelum merekam).
- [ ] Sudah ada satu analisis sehingga halaman AI tidak kosong.
- [ ] Zoom browser 100%, 1440×900, dark-mode mati.
- [ ] Kunci demo `pantaupesisir-demo-2026` sudah tersimpan di tab, atau siap ditempel.
- [ ] Tutup tab/notifikasi yang tidak berkaitan.

## 0:00–0:25 — Tim dan masalah

**Layar:** dashboard Ikhtisar (sidebar + baris KPI).

> "Kami adalah [nama tim] dari [sekolah]. Masyarakat pesisir di Indonesia mengambil keputusan harian
> berdasarkan informasi yang tidak lengkap: seorang nelayan memeriksa langit, bukan umpan data.
> Informasi resmi sudah tersedia, tetapi jarak antara observasi mentah dan sinyal yang dapat dipahami
> serta dapat ditelusuri itu nyata. PantauPesisir adalah konsol kami untuk menutup jarak itu —
> dengan jujur."

Tunjuk chip header (**Umpan langsung**, **Ringkasan**) dan kartu metrik.

## 0:25–0:55 — Arsitektur dalam satu tarikan napas

**Layar:** `/sources` (buka dari sidebar).

> "Tiga lapis. Telemetri buoy masuk ke backend FastAPI, divalidasi, dan disimpan di
> PostgreSQL/PostGIS. Pencarian STAC Copernicus Sentinel-2 yang nyata menambahkan metadata akuisisi
> dan quicklook ter-cache. Isolation Forest, yang dilatih pada 41,104 observasi NOAA NDBC nyata,
> menilai seberapa tidak biasa jendela terakhir, dan rubrik transparan terpisah menilai tingkat
> keparahan absolut. Dashboard tidak pernah mencampur sumber-sumber itu."

## 0:55–1:35 — Pemantauan laut

**Layar:** `/ocean`.

1. Tunjuk strip kesegaran: terakhir diamati, diterima, umur, dalam jendela kesegaran.
2. Arahkan kursor ke metrik gelombang: 1.0 m, periode, angin, tekanan, suhu laut — **satuan pada
   setiap nilai**.
3. Gulir ke grafik: tinggi gelombang + angin, lalu tekanan + periode. Sebutkan label UTC.
4. Buka panel provenans: waktu diamati, diterima, dan diproses terpisah; sumber telemetri dan ID
   batch tampil.
5. Picu pengiriman batch: profil **Extreme**, 12 observasi, 300 s. Klik **Kirim batch**.
6. Tunjukkan job selesai dan lonjakan pada grafik. Katakan dengan jelas:

> "Batch baru ini tercatat dengan ID-nya sendiri dan menggantikan pembacaan pada jendela replay-nya
> sehingga garis waktu tetap koheren."

## 1:35–2:05 — Peta satelit

**Layar:** `/satellite`.

1. Tunjukkan banner penyedia: "Copernicus Data Space Ecosystem — Sentinel-2 L2A", lisensi, status.
2. Peta: aktifkan/matikan poligon zona, penanda buoy, footprint. Klik popup buoy merah (nilai
   terbaru). Klik popup footprint (id produk, waktu akuisisi, tutupan awan).
3. Tunjuk baris atribusi dan catatan konteks: citra optik melengkapi data buoy.
4. Jelaskan formulir sinkronisasi: "Ini memanggil API STAC yang nyata; kami menyimpan metadata dan
   satu quicklook per akuisisi. Raster penuh membutuhkan akun Copernicus, sehingga katalog
   menyimpan metadata dan pratinjau."
5. Jika bandwidth memungkinkan, klik **Query Copernicus STAC** dan tunjukkan `found/stored`. Jika
   tidak, tampilkan kartu katalog yang sudah ada.

## 2:05–2:55 — Demo AI

**Layar:** `/ai`.

1. Kartu model: versi `cews-iforest-v1`, Isolation Forest, data pelatihan stasiun NDBC 51002/41010,
   kalibrasi 10% pada jendela normal.
2. Jalankan analisis: zona Jakarta Bay, jendela 60 menit, peringatan diaktifkan. Klik **Run AI
   analysis**.
3. Bacakan hasilnya:
   - tingkat risiko dan skor rubrik;
   - indeks anomali terhadap ambang 0.50 (jelaskan: anomali ≠ bahaya);
   - faktor kontribusi teratas beserta nilai/satuan dan σ;
   - kualitas data dan kecocokan satelit.
4. Bacakan satu kaveat dengan lantang: "Model dilatih pada stasiun lepas pantai AS dan menilai
   telemetri pesisir Indonesia; pergeseran domain diperhitungkan dalam evaluasi."
5. Buka rekomendasi: "Rekomendasi operasional per tingkat risiko, lengkap dengan faktor penyumbang."

## 2:55–3:30 — Alur kerja peringatan

**Layar:** `/alerts`.

1. Tunjukkan peringatan yang dibuat oleh analisis (severity, zona, timestamp, status).
2. Klik **Read full note**, lalu **Akui**; tunjukkan aktor dan timestamp UTC.
3. Klik **Selesaikan**; tunjukkan timestamp penyelesaian. Sebutkan bahwa API menolak pembukaan ulang
   (409) untuk menjaga jejak audit.
4. Sebutkan jendela dedupe: eksekusi berulang dalam 30 menit tidak membanjiri dengan peringatan
   duplikat.

## 3:30–4:00 — Dampak dan penutup

**Layar:** `/sources` atau kembali ke Ikhtisar.

> "Untuk ketahanan ekonomi pesisir, inilah nilainya: nelayan, usaha kecil, dan operator pelabuhan
> dapat melihat ringkasan kondisi terverifikasi, umurnya, dan apakah kondisi itu tidak biasa —
> sebelum memutuskan berlayar. Setiap angka membawa sumber, waktu, dan faktor penyumbangnya.
> Kode, provenans data, kartu model, dan pengujian bersifat publik. Terima kasih."

## Rencana cadangan

| Masalah saat perekaman | Solusi |
| --- | --- |
| Copernicus tidak dapat dijangkau | Tampilkan dataset ter-cache + status penyedia `unavailable`; sebutkan bahwa ini adalah fallback yang memang dirancang |
| Analisis mengembalikan 422 | Buat skenario terlebih dahulu, atau perlebar jendela |
| Model mengembalikan 503 | Mulai ulang backend; path artefak ada di `/system/health` |
| Grafik kosong | Periksa apakah zona memiliki baris pada jendela yang dipilih; beralih ke 24 h |
| Kunci demo ditolak | Tempel `pantaupesisir-demo-2026` di field kunci operator |

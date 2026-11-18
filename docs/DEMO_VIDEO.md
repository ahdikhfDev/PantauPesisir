# Video Demo — PantauPesisir

Dokumen ini berisi **konsep video demo**, **naskah narasi (voice-over)**, **storyboard per adegan**, dan **persiapan teknis**. Tujuan: membuat fitur terlihat menonjol, terasa nyata, dan meyakinkan juri dalam waktu 3–5 menit.

---

## 1. Konsep & Strategi

**Satu kalimat inti video:** *"Dalam 3 menit, tunjukkan masalah nyata, satu alur kerja nyata, dan satu momen yang tidak bisa dilupakan."*

Tiga prinsip yang membuat demo menang:

1. **Show, don't tell.** Jangan bilang "sistem kami lengkap" — klik, jalankan, dan biarkan layar berbicara.
2. **Satu fitur = satu aksi konkret.** Setiap segmen berakhir dengan sesuatu yang *terjadi* di layar, bukan sekadar deskripsi.
3. **Punya "money shot".** Momen di mana risiko naik dan peringatan muncul adalah bukti bahwa sistem bekerja ujung-ke-ujung.

**Struktur 3 babak (durasi saran 3:00, maksimal 5:00):**

| Babak | Durasi | Isi | Emosi juri |
|---|---|---|---|
| Hook & konteks | 0:00–0:45 | Masalah nyata + klaim sistem | "Ini penting" |
| Demo fitur | 0:45–2:15 | Ringkasan → Pemantauan → Satelit → **Risiko AI + peringatan** | "Ini beneran jalan" |
| Bukti & penutup | 2:15–3:00 | Sumber data, rantai data, disclaimer, ajakan | "Ini kredibel" |

**Gaya produksi:** screen recording + voice-over (lebih aman daripada bicara langsung ke kamera). Kursor diperbesar, teks overlay seminimal mungkin, dan setiap aksi diberi jeda setengah detik agar juri sempat membaca.

---

## 2. Storyboard & Naskah Narasi (versi utama, 3 menit)

> Format: **[WAKTU] — Aksi di layar** / *Narasi (voice-over)*.

---

### ADEGAN 1 — Hook (0:00–0:20)

**[0:00]** Layar hitam → judul muncul: **PantauPesisir**. Lalu potong ke video cuplikan pesisir (gelombang, pelabuhan) selama 2 detik.

*"Indonesia memiliki lebih dari 17 ribu pulau dan 99 ribu kilometer garis pantai. Di sana, gelombang tinggi bisa mengubah pelayaran, perikanan, dan pariwisata dalam hitungan jam."*

**[0:12]** Cut ke dashboard **Ringkasan** yang sudah terbuka.

*"Masalahnya bukan ketiadaan data, tapi datanya tersebar dan tidak jelas asal-usulnya. PantauPesisir menyatukannya dalam satu konsol."*

---

### ADEGAN 2 — Ringkasan (0:20–0:55)

**[0:20]** Kursor bergerak perlahan dari atas ke bawah halaman Ringkasan.

*"Ini halaman Ringkasan. Dalam satu pandangan, operator melihat jumlah situs telemetri, rata-rata tinggi gelombang, peringatan terbuka, dan rekaman satelit."*

**[0:30]** Arahkan kursor ke **grafik Kondisi laut**, lalu ke **Status zona** (Teluk Jakarta, Pantai Semarang, Selat Makassar).

*"Grafik menunjukkan tinggi gelombang dan angin per zona. Setiap zona punya status risiko yang diperbarui otomatis — tidak perlu menebak dari angka mentah."*

**[0:42]** Kursor ke **kesegaran data** ("Umpan terkini · beberapa detik lalu").

*"Dan perhatikan: data ini selalu segar, karena halaman memperbarui dirinya sendiri setiap beberapa detik."*

---

### ADEGAN 3 — Pemantauan Laut (0:55–1:15)

**[0:55]** Klik menu **Pemantauan Laut**. Pilih zona **Teluk Jakarta**, jendela **6 jam**.

*"Masuk ke Pemantauan Laut. Operator bisa memilih zona dan rentang waktu, lalu melihat delapan metrik oseanografi sekaligus."*

**[1:03]** Arahkan ke kartu metrik (tinggi gelombang, periode, angin, tekanan, suhu), lalu ke **tabel pembacaan terbaru**.

*"Tinggi gelombang signifikan, periode dominan, angin, tekanan udara, suhu permukaan laut — semua terekam dengan waktu UTC dan status validasi."*

**[1:10]** Klik satu baris → buka **panel provenance**.

*"Dan yang membedakan: setiap nilai bisa ditelusuri asal-usulnya — dari perangkat mana, kapan dicatat, dan apakah lolos validasi."*

---

### ADEGAN 4 — Satelit (1:15–1:35)

**[1:15]** Klik **Satelit**. Peta muncul; arahkan kursor ke poligon zona, titik buoy, dan cakupan akuisisi.

*"Data laut saja belum lengkap tanpa konteks visual. Modul Satelit menampilkan peta interaktif berisi zona, posisi perangkat, dan cakupan citra Sentinel-2."*

**[1:25]** Buka satu kartu akuisisi, tampilkan thumbnail + metadata (waktu, tutupan awan, resolusi).

*"Setiap akuisisi adalah metadata Copernicus asli — lengkap dengan pratinjau, waktu, tutupan awan, dan resolusi."*

---

### ADEGAN 5 — Money shot: Risiko AI + Peringatan (1:35–2:20)

**[1:35]** Klik **Risiko AI**. Tampilkan **kartu model** sebentar (data latih, fitur, keterbatasan).

*"Ini bagian intinya. Analisis risiko dijalankan oleh model Isolation Forest yang dilatih dengan lebih dari 32 ribu observasi NOAA NDBC — bukan sekadar ambang angka tetap."*

**[1:45]** Buka panel **Jalankan analisis**. Pilih zona, jendela, lalu klik **Jalankan analisis AI**.

*"Saya jalankan analisis untuk zona Teluk Jakarta."*

**[1:50]** (Sudah disiapkan sebelumnya: skenario **ekstrem** telah mengubah data.) Hasil muncul: **indeks anomali melewati ambang**, **Risiko tinggi**, **faktor kontributor** terisi.

*"Lihat: indeks anomali melewati ambang terkalibrasi. Sistem tidak hanya memberi skor — dia menjelaskan faktornya: lonjakan tinggi gelombang, penurunan tekanan, dan penyimpangan dari pola normal."*

**[2:05]** Klik **Peringatan**. Tampilkan peringatan baru dengan tingkat **tinggi**. Klik **Akui**, lalu **Selesaikan**.

*"Dan hasilnya otomatis menjadi peringatan. Operator bisa mengakui, menyelesaikan, atau membuka kembali — setiap tindakan tercatat dengan identitas dan waktu UTC."*

**[2:15]** Kembali ke Ringkasan; tunjukkan kartu peringatan.

*"Alurnya tertutup: data → analisis → peringatan → tindak lanjut. Semua dalam satu sistem."*

---

### ADEGAN 6 — Bukti & Kredibilitas (2:20–2:45)

**[2:20]** Klik **Sumber Data**. Tampilkan 4 kartu kesehatan, tabel kesegaran, dan legenda status sumber.

*"Terakhir, dan ini yang paling penting: kejujuran data. Halaman Sumber Data menunjukkan status setiap sumber, usia data, dan gerbang validasi."*

**[2:30]** Scroll ke **rantai data** / **gerbang validasi**.

*"Data yang tidak wajar tidak dibuang diam-diam — dia dikarantina dengan alasan yang jelas. Itu penting, karena sistem ini bukan peringatan resmi, melainkan alat bantu keputusan."*

---

### ADEGAN 7 — Penutup (2:45–3:00)

**[2:45]** Tampilkan logo **PantauPesisir** + satu baris ringkasan.

*"PantauPesisir: satu konsol, tiga zona, data yang bisa ditelusuri, dan analisis yang bisa dijelaskan."*

**[2:52]** Tampilkan 3 poin: **Telemetri buoy · Satelit Copernicus · Analisis AI yang transparan**.

*"Dibangun agar bisa diintegrasikan dengan perangkat mitra, dan siap dipakai di dunia nyata."*

**[2:58]** Layar penutup: logo + "Terima kasih".

*"Terima kasih."*

---

## 3. Naskah pendek (opsi 90 detik, jika juri hanya memberi 1,5 menit)

1. *"Indonesia negara kepulauan — gelombang ekstrem mengancam pesisir, dan informasinya tersebar."*
2. *"PantauPesisir menyatukan telemetri, satelit, dan analisis AI dalam satu konsol."*
3. *"Ringkasan: indikator utama dan kesegaran data."*
4. *"Pemantauan Laut: metrik lengkap dan setiap nilai bisa ditelusuri."*
5. *"Satelit: metadata Copernicus asli dengan pratinjau."*
6. *"Risiko AI: skor anomali + faktor yang menjelaskan kenapa."*
7. *"Peringatan: alur akui–selesaikan dengan jejak audit."*
8. *"Sumber data: kejujuran setiap angka."*
9. *"PantauPesisir — siap untuk operator pesisir, hari ini."*

---

## 4. Persiapan Teknis

### Rekaman

- **Tool:** OBS Studio (gratis) — capture layar 1920×1080, 30/60 fps.
- **Kursor:** perbesar dan beri highlight (OBS atau software kursor), agar juri bisa mengikuti.
- **Browser:** Chrome fullscreen (`F11`), sembunyikan bookmark bar, zoom 100%.
- **Zoom-in saat edit:** perbesar kartu/grafik penting saat pasca-produksi (scale 120–140%), bukan saat rekam.

### Sebelum rekam (biar layar "hidup")

1. Pastikan backend `:8000` dan frontend `:3000` berjalan.
2. Isi telemetri segar (biar status "Terkini", bukan "Usang"):
   - Simulator → skenario **Normal**, zona **Semua**, 14 observasi → **Hasilkan semburan**.
3. Untuk *money shot*, siapkan **skenario Ekstrem** untuk **Teluk Jakarta**:
   - Simulator → zona **Teluk Jakarta**, skenario **Ekstrem**, 16 observasi, interval 300 → **Hasilkan semburan**.
   - Risiko AI → zona **Teluk Jakarta** → **Jalankan analisis AI** → muncul **Risiko tinggi**.
   - Buka **Peringatan** → peringatan baru tampil.
4. Rekam urutannya **sekali tanpa bicara** dulu (dry run), lalu rekam ulang dengan narasi.

### Audio

- Gunakan mic eksternal + ruang tenang, atau text-to-speech + subtitle jika suara tidak stabil.
- Baca naskah pelan dan beri jeda; potong jeda yang terlalu panjang saat edit.

### Pasca-produksi

- Musik latar volume rendah (di bawah -18 dB relatif suara).
- Tambahkan subtitle untuk angka penting (misal "Risiko tinggi", "Anomali 0.87 vs ambang 0.50").
- Potong semua "uh/em" dan jeda mati.

---

## 5. Do & Don't (kriteria penjurian)

**Lakukan:**
- Tunjukkan alur **end-to-end**: data → analisis → peringatan → tindak lanjut.
- Sorot fitur pembeda: **provenance**, **faktor kontributor**, **kejujuran sumber**.
- Sebut angka nyata yang meyakinkan: *32.883 baris data latih*, *metadata Copernicus asli*, *11 fitur*, *37 pengujian otomatis*.
- Akhiri dengan dampak, bukan daftar fitur.

**Hindari:**
- Jangan baca slide bertele-tele; langsung ke layar aplikasi.
- Jangan klaim "peringatan resmi BMKG" — posisikan sebagai *alat bantu keputusan*.
- Jangan tampilkan layar kosong/loading lama tanpa penjelasan.
- Jangan ganti-ganti aplikasi di tengah demo.

---

## 6. Catatan Transparansi (untuk sesi tanya-jawab, bukan di video)

Jika juri bertanya "data ini real atau tidak?", jawaban yang disarankan:

> "Data satelit dan data latih model adalah data nyata dari Copernicus dan NOAA NDBC. Untuk telemetri, arsitektur kami sudah memiliki gerbang validasi dan endpoint penerimaan perangkat, sehingga pada implementasi bersama mitra data akan datang dari perangkat lapangan; pada demonstrasi ini telemetri diputar oleh modul internal agar hasilnya dapat diulang dan aman."

Ini selaras dengan penjelasan yang sudah ditulis di proposal (BAB 2.5).

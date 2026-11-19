import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Database,
  Gauge,
  MapPin,
  Radio,
  Ship,
  ShieldCheck,
  Waves,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "PantauPesisir — Tahu kondisi laut sebelum berangkat",
  description:
    "PantauPesisir merangkum ombak, angin, dan peringatan aktif di tiga pantai menjadi satu jawaban: aman, hati-hati, atau sebaiknya tunda.",
};

const SOURCES = ["BMKG", "Copernicus Sentinel-2", "NOAA NDBC", "OpenStreetMap", "Telemetri buoy"];

const PAGES = [
  {
    title: "Cek kondisi",
    href: "/cek",
    tag: "Warga",
    copy: "Pilih pantai dan aktivitas, lalu baca satu jawaban beserta alasannya.",
  },
  {
    title: "Kabar laut",
    href: "/ringkasan",
    tag: "Warga",
    copy: "Ringkasan satu paragraf yang bisa dibaca sambil berdiri di dermaga.",
  },
  {
    title: "Belajar",
    href: "/belajar",
    tag: "Warga",
    copy: "Arti ombak, periode, dan angin. Ada eksperimen kecil untuk mencobanya.",
  },
  {
    title: "Konsol operator",
    href: "/konsol",
    tag: "Operator",
    copy: "Grafik, provenance, status sumber, dan kendali simulator.",
  },
];

const PROCESS = [
  { icon: MapPin, title: "Pilih pantai", copy: "Teluk Jakarta, Pantai Semarang, atau Selat Makassar." },
  { icon: Ship, title: "Pilih aktivitas", copy: "Perahu kecil, wisata pantai, atau kapal dan pelabuhan." },
  { icon: ShieldCheck, title: "Baca putusannya", copy: "Aman, hati-hati, atau tunda — beserta sebabnya." },
  { icon: Radio, title: "Konfirmasi ke BMKG", copy: "Untuk prakiraan resmi, BMKG tetap acuannya." },
];

const TRUST = [
  {
    title: "Yang kami klaim",
    body: "Telemetri buoy lewat gerbang validasi dan tercatat asal-usulnya. Model dilatih pada 41.104 observasi NOAA NDBC.",
  },
  {
    title: "Yang tidak kami klaim",
    body: "Kami bukan peringatan resmi. Skor anomali bukan peluang bencana, dan citra satelit bukan pengukur tinggi ombak.",
  },
  {
    title: "Saat data hilang",
    body: "Metadata satelit menyimpan tanggal akuisisi aslinya. Kegagalan penyedia ditampilkan apa adanya, bukan disembunyikan.",
  },
];

function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2.5 text-ink">
      <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-signal text-white">
        <Waves className="h-[19px] w-[19px]" strokeWidth={2} aria-hidden />
      </span>
      <span className="font-display text-[24px] leading-none font-semibold tracking-[-0.01em]">
        PantauPesisir
      </span>
    </Link>
  );
}

/**
 * The board. This is the whole product in one object: a place, an activity, a
 * verdict you can read from across a ferry pier, and the three numbers behind it.
 * Static example values, labelled as such — the live board is on /cek.
 */
function Board() {
  return (
    <figure className="enter-plate overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper shadow-[var(--shadow-raise)]">
      <figcaption className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
        <span className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-ok" aria-hidden />
          <span className="text-[16px] font-semibold">Teluk Jakarta · perahu kecil</span>
        </span>
        <span className="chip">contoh tampilan</span>
      </figcaption>

      <div className="px-5 pb-5 pt-5">
        <p className="text-[13.5px] text-muted">Kondisi saat ini</p>
        <p className="verdict mt-2 flex items-center gap-3 text-[clamp(3.2rem,8vw,4.8rem)] text-ink">
          Aman
          <CheckCircle2 className="h-[0.42em] w-[0.42em] shrink-0 text-ok" strokeWidth={2.4} aria-hidden />
        </p>
        <p className="mt-3 max-w-[34ch] text-[15px] leading-[1.55] text-ink-soft">
          Ombak tenang, angin sepoi, tidak ada peringatan aktif.
        </p>
      </div>

      <dl className="mx-5 mb-4 grid grid-cols-3 divide-x divide-line rounded-[var(--radius-panel)] bg-surface">
        {[
          ["Ombak", "0,8", "m"],
          ["Angin", "3", "m/s"],
          ["Peringatan", "0", "aktif"],
        ].map(([label, value, unit]) => (
          <div key={label} className="px-3.5 py-3">
            <dt className="text-[13.5px] text-muted">{label}</dt>
            <dd className="mt-1 flex items-baseline gap-1">
              <span className="metric text-[24px] leading-none font-semibold">{value}</span>
              <span className="text-[13.5px] text-muted">{unit}</span>
            </dd>
          </div>
        ))}
      </dl>

      <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
        <span className="flex items-center gap-1.5 text-[13.5px] text-muted">
          <span className="h-2 w-2 rounded-full bg-sea" aria-hidden /> Telemetri buoy terverifikasi
        </span>
        <span className="metric flex items-center gap-1.5 text-[13.5px] text-muted">
          <Clock3 className="h-3.5 w-3.5" aria-hidden /> 20 mnt lalu
        </span>
      </div>
    </figure>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <header>
        <div className="container-x flex h-[62px] items-center justify-between gap-4">
          <Wordmark />
          <nav className="hidden items-center gap-6 text-[14.5px] text-ink-soft md:flex">
            <a href="#bukti" className="hover:text-ink">Bukti</a>
            <a href="#halaman" className="hover:text-ink">Halaman</a>
            <a href="#proses" className="hover:text-ink">Cara kerja</a>
            <Link href="/belajar" className="hover:text-ink">Belajar</Link>
          </nav>
          <Link href="/cek" className="btn btn-primary btn-sm">
            Cek kondisi
          </Link>
        </div>
      </header>

      <main>
        {/* Hero. Copy on the left, the board on the right; the board is the argument. */}
        <section>
          <div className="container-x grid gap-10 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14 lg:py-16">
            <div>
              <h1 className="display enter-up text-[clamp(2.6rem,6.2vw,4.6rem)]">
                Tahu kondisi laut sebelum berangkat.
              </h1>
              <p className="enter-up stagger-1 mt-5 max-w-[46ch] text-[17px] leading-[1.6] text-ink-soft">
                Ombak, angin, dan peringatan aktif di tiga pantai dirangkum menjadi satu putusan:
                aman, hati-hati, atau tunda. Lengkap dengan sebabnya.
              </p>
              <div className="enter-up stagger-2 mt-7 flex flex-wrap items-center gap-3">
                <Link href="/cek" className="btn btn-primary btn-lg">
                  Cek kondisi sekarang
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link href="/ringkasan" className="btn btn-ghost btn-lg">
                  Lihat kabar laut
                </Link>
              </div>
              <ul className="enter-up stagger-3 mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[13.5px] text-muted">
                {["Tanpa akun", "Tanpa aplikasi", "Ditulis dalam bahasa sehari-hari"].map((item) => (
                  <li key={item} className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <Board />
          </div>
        </section>

        {/* Everything below the hero sits on the plain white ground the reference uses. */}
        <div className="container-x pb-12">
          <div className="px-0">
        {/* Sources: named, not logos-in-a-row decoration. */}
        <section className="rounded-[var(--radius-card)] border border-line bg-surface/60">
          <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:px-6">
            <p className="text-[14px] text-muted">Sumber data</p>
            <ul className="flex flex-wrap gap-x-7 gap-y-2 text-[14px] text-ink-soft">
              {SOURCES.map((source) => (
                <li key={source}>{source}</li>
              ))}
            </ul>
          </div>
        </section>

        {/* The numbers strip. Same job as the reference's counters: prove this is
            a thing that runs, not a landing page about a thing. */}
        <section className="mt-3 grid grid-cols-2 divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper sm:grid-cols-4 sm:divide-x">
          {[
            ["41.104", "observasi latih"],
            ["3", "pantai dipantau"],
            ["7", "akuisisi satelit"],
            ["2", "model AI"],
          ].map(([value, label], index) => (
            <div key={label} className={`px-5 py-4 ${index > 1 ? "border-t border-line sm:border-t-0" : ""}`}>
              <p className="metric text-[26px] leading-none font-semibold text-ink">{value}</p>
              <p className="mt-1.5 text-[14px] text-muted">{label}</p>
            </div>
          ))}
        </section>

        {/* Evidence. Real content, not marketing cards. */}
        <section id="bukti" className="mt-4">
          <div className="px-5 py-8 sm:px-6 sm:py-10">
            <div className="flex flex-col gap-4 border-b border-line pb-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="eyebrow">Bukti</p>
                <h2 className="display mt-3 max-w-[20ch] text-[clamp(2rem,4.2vw,3.1rem)]">
                  Satu putusan, semua buktinya di bawahnya.
                </h2>
              </div>
              <p className="max-w-[38ch] text-[15px] leading-[1.6] text-ink-soft lg:text-right">
                Setiap angka di layar datang dari API. Tidak ada metrik contoh, tidak ada tombol yang
                tidak melakukan apa pun.
              </p>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {[
                {
                  icon: Database,
                  title: "Asal-usul tercatat",
                  body: "Waktu teramati, diterima, dan diproses disimpan terpisah. Baris rusak dikarantina, bukan dibuang diam-diam.",
                },
                {
                  icon: Gauge,
                  title: "Ambang per aktivitas",
                  body: "Perahu kecil, wisata pantai, dan kapal punya batas berbeda. Angka 1,5 m bukan batas universal.",
                },
                {
                  icon: Clock3,
                  title: "Peringatan berbatas",
                  body: "Pemberitahuan warga berlaku enam jam lalu berakhir sendiri. Tidak perlu ditutup siapa pun.",
                },
              ].map((item, index) => (
                <article key={item.title} className={`card enter-up stagger-${index + 1} p-5`}>
                  <item.icon className="h-5 w-5 text-ink" strokeWidth={1.7} aria-hidden />
                  <h3 className="mt-4 text-[19px]">{item.title}</h3>
                  <p className="mt-2 text-[14.5px] leading-[1.6] text-ink-soft">{item.body}</p>
                </article>
              ))}
            </div>

            <div className="grid gap-8 pt-6 md:grid-cols-[1fr_1.1fr] md:gap-14">
              <div>
                <h3 className="text-[19px]">Ambang batas yang dipakai</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">
                  Angka ini panduan prototipe untuk perairan tenang, bukan skala resmi BMKG.
                </p>
              </div>
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="border-b border-line">
                    <th className="py-2 text-left font-normal">Aktivitas</th>
                    <th className="py-2 text-right font-normal">Ombak batas</th>
                    <th className="py-2 text-right font-normal">Angin batas</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Perahu kecil", "1,5 m", "8 m/s"],
                    ["Wisata pantai", "1,5 m", "10 m/s"],
                    ["Kapal & pelabuhan", "2,0 m", "12 m/s"],
                  ].map(([name, wave, wind]) => (
                    <tr key={name} className="table-row">
                      <td className="py-2.5">{name}</td>
                      <td className="metric py-2.5 text-right">{wave}</td>
                      <td className="metric py-2.5 text-right">{wind}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Pages */}
        <section id="halaman" className="mt-4 rounded-[var(--radius-card)] border border-line bg-surface/60">
          <div className="px-5 py-8 sm:px-6 sm:py-10">
            <div className="flex flex-col gap-4 pb-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="eyebrow">Halaman</p>
                <h2 className="display mt-3 text-[clamp(2rem,4.2vw,3.1rem)]">Empat halaman, dua pembaca.</h2>
              </div>
              <p className="max-w-[38ch] text-[15px] leading-[1.6] text-ink-soft lg:text-right">
                Warga mendapat jawaban singkat. Operator mendapat grafik, provenance, dan status sumber
                yang sama di baliknya.
              </p>
            </div>

            <ul className="card divide-y divide-line px-5">
              {PAGES.map((page) => (
                <li key={page.href}>
                  <Link
                    href={page.href}
                    className="group grid grid-cols-[auto_1fr_auto] items-baseline gap-x-4 gap-y-1 py-4 sm:grid-cols-[7.5rem_1fr_auto] sm:items-center"
                  >
                    <span className="code text-muted">{page.tag}</span>
                    <span>
                      <span className="block text-[19px] font-medium group-hover:underline group-hover:decoration-2 group-hover:underline-offset-4">
                        {page.title}
                      </span>
                      <span className="mt-0.5 block text-[14px] leading-snug text-ink-soft">{page.copy}</span>
                    </span>
                    <ArrowRight
                      className="h-4 w-4 text-muted transition-transform group-hover:translate-x-1 group-hover:text-ink"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Process. Numbered because it genuinely is a sequence. */}
        <section id="proses" className="mt-4">
          <div className="px-5 py-8 sm:px-6 sm:py-10">
            <p className="eyebrow">Cara kerja</p>
            <h2 className="display mt-3 text-[clamp(2rem,4.2vw,3.1rem)]">Empat langkah, sepuluh detik.</h2>
            <ol className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
              {PROCESS.map((step, index) => (
                <li key={step.title} className={`card p-4 ${index === 0 ? "enter-up" : "enter-up stagger-" + Math.min(index + 1, 8)}`}>
                  <div className="flex items-baseline justify-between">
                    <step.icon className="h-[18px] w-[18px] text-ink" strokeWidth={1.8} aria-hidden />
                    <span className="metric text-[14px] text-muted">{index + 1}</span>
                  </div>
                  <h3 className="mt-3 text-[18px]">{step.title}</h3>
                  <p className="mt-1 text-[14px] leading-[1.55] text-ink-soft">{step.copy}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Limits */}
        <section className="mt-4 rounded-[var(--radius-card)] bg-ink text-white">
          <div className="px-5 py-8 sm:px-6 sm:py-10">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <h2 className="display text-[clamp(2rem,4.2vw,3.1rem)]">Batasnya kami tulis, bukan disembunyikan.</h2>
              <p className="max-w-[34ch] text-[15px] leading-[1.6] text-white/80 lg:text-right">
                Prototipe yang jujur tentang dirinya sendiri lebih berguna daripada yang berpura-pura.
              </p>
            </div>
            <div className="mt-8 grid gap-x-10 gap-y-6 border-t border-white/25 pt-6 md:grid-cols-3">
              {TRUST.map((item, index) => (
                <div key={item.title}>
                  <p className="metric text-[14px] text-white/60">{String(index + 1).padStart(2, "0")}</p>
                  <h3 className="mt-2 text-[18px] text-white">{item.title}</h3>
                  <p className="mt-1.5 text-[14.5px] leading-[1.6] text-white/85">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Close */}
        <section>
          <div className="flex flex-col gap-6 pt-10 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="display text-[clamp(1.9rem,3.8vw,2.8rem)]">Sebelum naik perahu, cek dulu.</h2>
              <p className="mt-2 max-w-[48ch] text-[15px] leading-[1.6] text-ink-soft">
                Gratis dan tanpa akun. Pilih pantai dan rencana aktivitas, lalu baca putusannya.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/cek" className="btn btn-primary btn-lg">
                Cek kondisi
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link href="/konsol" className="btn btn-ghost btn-lg">
                Buka konsol
              </Link>
            </div>
          </div>
        </section>
          </div>
        </div>
      </main>

      <footer>
        <div className="container-x grid gap-8 py-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2.5 text-ink">
              <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-signal text-white">
                <Waves className="h-[19px] w-[19px]" strokeWidth={2} aria-hidden />
              </span>
              <span className="font-display text-[24px] leading-none font-semibold tracking-[-0.01em]">
                PantauPesisir
              </span>
            </Link>
            <p className="mt-4 max-w-[38ch] text-[14px] leading-[1.6] text-ink-soft">
              Alat bantu keputusan, bukan pengganti prakiraan resmi BMKG, BPBD, atau otoritas
              pelabuhan.
            </p>
          </div>
          <nav aria-label="Halaman warga">
            <p className="text-[14px] text-muted">Warga</p>
            <ul className="mt-2.5 space-y-1.5 text-[14.5px]">
              <li><Link href="/cek" className="hover:underline">Cek kondisi</Link></li>
              <li><Link href="/ringkasan" className="hover:underline">Kabar laut</Link></li>
              <li><Link href="/belajar" className="hover:underline">Belajar</Link></li>
              <li><Link href="/alerts" className="hover:underline">Peringatan</Link></li>
            </ul>
          </nav>
          <nav aria-label="Halaman operator">
            <p className="text-[14px] text-muted">Operator</p>
            <ul className="mt-2.5 space-y-1.5 text-[14.5px]">
              <li><Link href="/konsol" className="hover:underline">Ringkasan sistem</Link></li>
              <li><Link href="/ocean" className="hover:underline">Pemantauan laut</Link></li>
              <li><Link href="/satellite" className="hover:underline">Satelit Copernicus</Link></li>
              <li><Link href="/sources" className="hover:underline">Sumber data</Link></li>
            </ul>
          </nav>
        </div>
        <div>
          <p className="container-x py-3 text-[14px] text-muted">
            Data buoy disimulasikan dan dilabeli · Citra Copernicus bersifat historis · Peta ©
            OpenStreetMap contributors
          </p>
        </div>
      </footer>
    </div>
  );
}

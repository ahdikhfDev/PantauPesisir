import {
  Anchor,
  ArrowRight,
  CheckCircle2,
  Compass,
  MapPin,
  Radio,
  ShieldCheck,
  Ship,
  Sun,
  Waves,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "PantauPesisir — Tahu kondisi laut sebelum berangkat",
  description:
    "PantauPesisir merangkum ombak, angin, dan peringatan aktif di tiga pantai menjadi satu jawaban: aman, hati-hati, atau sebaiknya tunda.",
};

const ZONES = [
  { name: "Teluk Jakarta", code: "JKT" },
  { name: "Pantai Semarang", code: "SMR" },
  { name: "Selat Makassar", code: "MKS" },
];

const STATS = [
  { value: "3", label: "pantai dipantau", icon: MapPin },
  { value: "7", label: "parameter per pembacaan", icon: Radio },
  { value: "24 jam", label: "riwayat di grafik", icon: Waves },
  { value: "0", label: "akun yang dibutuhkan", icon: Compass },
];

const AUDIENCES = [
  {
    icon: Anchor,
    title: "Nelayan & perahu kecil",
    limit: "Batas 1,5 m",
    copy: "Status berubah hati-hati sebelum ombak melewati batas aman perahu kecil, bukan setelah kejadian.",
  },
  {
    icon: Sun,
    title: "Wisata pantai",
    limit: "Batas 1,5 m",
    copy: "Tahu kapan ombak terlalu kuat untuk berenang, dijelaskan dengan bahasa sehari-hari.",
  },
  {
    icon: Ship,
    title: "Kapal & pelabuhan",
    limit: "Batas 2,0 m",
    copy: "Ambang lebih longgar untuk sandar dan manuver, tetap dengan peringatan saat gelombang naik.",
  },
];

const STEPS = [
  {
    title: "Pilih pantai",
    copy: "Tiga lokasi dipantau terus-menerus: Teluk Jakarta, Pantai Semarang, dan Selat Makassar.",
  },
  {
    title: "Pilih rencana",
    copy: "Perahu kecil, wisata pantai, atau kapal & pelabuhan. Setiap aktivitas punya batasnya sendiri.",
  },
  {
    title: "Baca jawabannya",
    copy: "Satu status dan satu kalimat alasan: aman, hati-hati, atau sebaiknya tunda.",
  },
];

const PROVENANCE = [
  "Setiap pembacaan buoy diperiksa rentang fisiknya, waktu UTC-nya, dan asal datanya.",
  "Peringatan hanya muncul saat rubrik risiko melewati batas, dan berlaku maksimal enam jam.",
  "Citra satelit Copernicus dipakai sebagai konteks pesisir, bukan pengukur tinggi ombak.",
  "Model anomali dilatih pada data historis NOAA NDBC; skornya bukan peluang bencana.",
];

function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-ink text-white">
        <Waves className="h-[18px] w-[18px]" strokeWidth={1.7} aria-hidden />
      </span>
      <span className="leading-none">
        <span className="font-display block text-[16px] font-semibold tracking-[-0.03em]">PantauPesisir</span>
        <span className="mt-1 block text-[9.5px] text-muted">Pesisir & pantai</span>
      </span>
    </Link>
  );
}

export default function LandingPage() {
  return (
    <div className="bg-paper">
      <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[1180px] items-center justify-between gap-4 px-5 sm:px-8">
          <Wordmark />
          <nav className="hidden items-center gap-7 text-[12.5px] font-medium text-ink-soft md:flex">
            <a href="#cara-kerja" className="transition-colors hover:text-ink">
              Cara kerja
            </a>
            <a href="#data" className="transition-colors hover:text-ink">
              Data
            </a>
            <Link href="/belajar" className="transition-colors hover:text-ink">
              Belajar
            </Link>
            <Link href="/ringkasan" className="transition-colors hover:text-ink">
              Kabar laut
            </Link>
          </nav>
          <Link href="/cek" className="btn btn-signal btn-sm shrink-0">
            Cek kondisi <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-line">
          <div
            className="pointer-events-none absolute -right-40 -top-56 h-[560px] w-[560px] rounded-full bg-signal/[0.07] blur-3xl"
            aria-hidden
          />
          <div className="relative mx-auto grid w-full max-w-[1180px] gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-20">
            <div>
              <span className="eyebrow">Pemantauan pesisir</span>
              <h1 className="font-display mt-4 text-[clamp(2.3rem,5vw,3.6rem)] font-semibold leading-[0.98] tracking-[-0.045em] text-ink">
                Tahu kondisi laut
                <br />
                sebelum berangkat<span className="text-signal">.</span>
              </h1>
              <p className="mt-5 max-w-[46ch] text-[14.5px] leading-relaxed text-ink-soft">
                Ombak, angin, dan peringatan aktif di tiga pantai dirangkum menjadi satu jawaban
                sederhana: <strong className="font-semibold text-ink">aman</strong>,{" "}
                <strong className="font-semibold text-ink">hati-hati</strong>, atau{" "}
                <strong className="font-semibold text-ink">sebaiknya tunda</strong>.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link href="/cek" className="btn btn-signal">
                  Cek kondisi sekarang <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link href="/ringkasan" className="btn btn-ghost">
                  Lihat kabar laut
                </Link>
              </div>
              <p className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10.5px] text-muted">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 text-sea" aria-hidden /> Tanpa akun
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 text-sea" aria-hidden /> Tanpa aplikasi
                </span>
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3 w-3 text-sea" aria-hidden /> Gratis
                </span>
              </p>
            </div>

            {/* Product illustration */}
            <div className="relative">
              <div className="rounded-[20px] border border-line bg-surface p-2 shadow-[0_40px_80px_-60px_rgba(20,24,26,0.55)]">
                <div className="overflow-hidden rounded-[14px] border border-line bg-white">
                  <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                    <span className="flex items-center gap-2 text-[9.5px] text-muted">
                      <span className="flex gap-1" aria-hidden>
                        <span className="h-1.5 w-1.5 rounded-full bg-line-strong" />
                        <span className="h-1.5 w-1.5 rounded-full bg-line-strong" />
                        <span className="h-1.5 w-1.5 rounded-full bg-line-strong" />
                      </span>
                      pantaupesisir
                    </span>
                    <span className="flex items-center gap-1.5 text-[9px] font-medium text-muted">
                      <span className="h-1.5 w-1.5 rounded-full bg-signal" aria-hidden /> Diperbarui
                    </span>
                  </div>

                  <div className="p-4">
                    <div className="flex flex-wrap gap-1.5">
                      {ZONES.map((zone, index) => (
                        <span
                          key={zone.code}
                          className={
                            index === 0
                              ? "rounded-full border border-sea bg-sea px-2.5 py-1 text-[9.5px] font-medium text-white"
                              : "rounded-full border border-line px-2.5 py-1 text-[9.5px] font-medium text-muted"
                          }
                        >
                          {zone.name}
                        </span>
                      ))}
                    </div>

                    <div className="mt-3.5 rounded-[12px] border border-ok/25 bg-ok-soft/60 px-3.5 py-3">
                      <p className="flex items-center gap-1.5 text-[9.5px] font-medium text-muted">
                        <span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden /> Perahu kecil ·
                        Teluk Jakarta
                      </p>
                      <p className="mt-1.5 flex items-center gap-1.5 text-[15px] font-semibold text-ink">
                        <CheckCircle2 className="h-4 w-4 text-ok" aria-hidden /> Aman untuk aktivitas ringan
                      </p>
                      <p className="mt-1 text-[10px] leading-relaxed text-ink-soft">
                        Ombak tenang, angin sepoi-sepoi, tidak ada peringatan aktif.
                      </p>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {[
                        ["Ombak", "0,8", "m", "tenang"],
                        ["Angin", "3", "m/s", "sepoi-sepoi"],
                      ].map(([label, value, unit, words]) => (
                        <div key={label} className="rounded-[10px] border border-line px-3 py-2">
                          <p className="text-[9px] text-muted">{label}</p>
                          <p className="mt-0.5 flex items-baseline gap-1">
                            <span className="metric text-[16px] font-medium text-ink">{value}</span>
                            <span className="text-[9px] text-muted">{unit}</span>
                          </p>
                          <p className="text-[9px] text-muted">{words}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3">
                      <svg viewBox="0 0 320 78" className="w-full" role="img" aria-label="Ilustrasi grafik ombak">
                        <line x1="0" y1="34" x2="320" y2="34" stroke="#d9c6c1" strokeDasharray="4 4" strokeWidth="1" />
                        <path
                          d="M0 62 L22 58 L44 64 L66 55 L88 59 L110 50 L132 54 L154 46 L176 50 L198 41 L220 46 L242 38 L264 44 L286 39 L308 43 L320 41"
                          fill="none"
                          stroke="#123f46"
                          strokeWidth="1.8"
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                        <circle cx="320" cy="41" r="2.6" fill="#123f46" />
                      </svg>
                      <p className="mt-1 flex items-center justify-between text-[8.5px] text-muted">
                        <span>24 jam terakhir</span>
                        <span className="flex items-center gap-1">
                          <span className="h-[1px] w-4 border-t border-dashed border-line-strong" aria-hidden />
                          batas aman 1,5 m
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <p className="mt-3 flex items-center gap-1.5 text-[10px] text-muted">
                <ShieldCheck className="h-3 w-3 text-sea" aria-hidden />
                Pembacaan diperiksa sebelum tampil — ilustrasi halaman Cek Kondisi
              </p>
            </div>
          </div>
        </section>

        {/* Stat strip */}
        <section className="border-b border-line bg-surface">
          <div className="mx-auto grid w-full max-w-[1180px] grid-cols-2 divide-line px-5 sm:px-8 lg:grid-cols-4 lg:divide-x">
            {STATS.map((stat) => (
              <div
                key={stat.label}
                className="flex items-start gap-3 py-6 lg:px-7 lg:first:pl-0 lg:last:pr-0"
              >
                <stat.icon className="mt-0.5 h-4 w-4 shrink-0 text-signal" strokeWidth={1.6} aria-hidden />
                <div>
                  <p className="metric text-[22px] font-medium leading-none text-ink">{stat.value}</p>
                  <p className="mt-1.5 text-[10.5px] leading-snug text-muted">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Audiences */}
        <section className="mx-auto w-full max-w-[1180px] px-5 py-14 sm:px-8 lg:py-20">
          <div className="max-w-2xl">
            <span className="eyebrow">Untuk siapa</span>
            <h2 className="font-display mt-3 text-[clamp(1.6rem,3vw,2.2rem)] font-semibold leading-[1.08] tracking-[-0.035em]">
              Satu kondisi, tiga keputusan berbeda.
            </h2>
            <p className="mt-3 text-[13px] leading-relaxed text-muted">
              Ombak 2 meter bukan hal yang sama bagi perahu kecil dan kapal barang. PantauPesisir memakai
              batas tiap aktivitas, bukan satu angka untuk semua orang.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {AUDIENCES.map((item) => (
              <article key={item.title} className="flex flex-col rounded-[14px] border border-line bg-surface p-6">
                <span className="grid h-10 w-10 place-items-center rounded-[10px] border border-line bg-paper text-ink">
                  <item.icon className="h-[18px] w-[18px]" strokeWidth={1.6} aria-hidden />
                </span>
                <h3 className="mt-4 text-[14px] font-semibold">{item.title}</h3>
                <p className="mt-2 flex-1 text-[11.5px] leading-relaxed text-muted">{item.copy}</p>
                <p className="mt-4 border-t border-line pt-3 text-[10px] font-medium text-signal-dark">
                  {item.limit}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="cara-kerja" className="border-y border-line bg-surface">
          <div className="mx-auto w-full max-w-[1180px] px-5 py-14 sm:px-8 lg:py-20">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-xl">
                <span className="eyebrow">Cara kerja</span>
                <h2 className="font-display mt-3 text-[clamp(1.6rem,3vw,2.2rem)] font-semibold leading-[1.08] tracking-[-0.035em]">
                  Tiga langkah, sekitar sepuluh detik.
                </h2>
              </div>
              <Link href="/cek" className="text-[11.5px] font-semibold text-ink underline underline-offset-4">
                Coba sekarang
              </Link>
            </div>

            <ol className="mt-9 grid gap-px overflow-hidden rounded-[14px] border border-line bg-line md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="bg-surface p-6">
                  <p className="metric text-[10px] text-signal-dark">{String(index + 1).padStart(2, "0")}</p>
                  <h3 className="mt-2 text-[14px] font-semibold">{step.title}</h3>
                  <p className="mt-2 text-[11.5px] leading-relaxed text-muted">{step.copy}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Data / provenance */}
        <section id="data" className="mx-auto w-full max-w-[1180px] px-5 py-14 sm:px-8 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <div>
              <span className="eyebrow">Data & keterbatasan</span>
              <h2 className="font-display mt-3 text-[clamp(1.6rem,3vw,2.2rem)] font-semibold leading-[1.08] tracking-[-0.035em]">
                Angka yang bisa ditelusuri.
              </h2>
              <p className="mt-3 max-w-[42ch] text-[13px] leading-relaxed text-muted">
                PantauPesisir adalah alat bantu keputusan, bukan peringatan resmi. Setiap nilai membawa
                sumber, waktu, dan catatan kualitasnya.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/belajar" className="btn btn-ghost btn-sm">
                  Kamus istilah laut
                </Link>
                <Link href="/alerts" className="btn btn-ghost btn-sm">
                  Peringatan warga
                </Link>
              </div>
            </div>

            <ul className="divide-y divide-line border-y border-line">
              {PROVENANCE.map((item) => (
                <li key={item} className="flex gap-3 py-3.5 text-[12px] leading-relaxed text-ink-soft">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sea" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-line bg-ink text-white">
          <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-5 py-12 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:py-14">
            <div>
              <h2 className="font-display text-[clamp(1.5rem,3vw,2.1rem)] font-semibold leading-[1.1] tracking-[-0.035em]">
                Sebelum naik perahu, cek dulu.
              </h2>
              <p className="mt-2 max-w-[46ch] text-[12px] leading-relaxed text-white/65">
                Gratis, tanpa akun. Pilih pantai dan rencana aktivitas, lalu baca jawabannya.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/cek" className="btn btn-signal">
                Cek kondisi <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/ringkasan"
                className="btn border border-white/20 bg-transparent text-white hover:border-white/40"
              >
                Kabar laut hari ini
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-paper">
        <div className="mx-auto grid w-full max-w-[1180px] gap-8 px-5 py-10 sm:px-8 md:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <Wordmark />
            <p className="mt-4 max-w-[38ch] text-[10.5px] leading-relaxed text-muted">
              Prototipe untuk IT RUSH 2026. Alat bantu keputusan — bukan pengganti prakiraan resmi BMKG,
              BPBD, atau otoritas pelabuhan.
            </p>
          </div>
          <nav className="text-[11.5px] text-ink-soft">
            <p className="text-[10px] font-semibold text-muted">Warga</p>
            <ul className="mt-3 space-y-2">
              <li>
                <Link href="/cek" className="hover:text-ink">
                  Cek kondisi
                </Link>
              </li>
              <li>
                <Link href="/ringkasan" className="hover:text-ink">
                  Kabar laut
                </Link>
              </li>
              <li>
                <Link href="/belajar" className="hover:text-ink">
                  Belajar
                </Link>
              </li>
              <li>
                <Link href="/alerts" className="hover:text-ink">
                  Peringatan warga
                </Link>
              </li>
            </ul>
          </nav>
          <nav className="text-[11.5px] text-ink-soft">
            <p className="text-[10px] font-semibold text-muted">Operator</p>
            <ul className="mt-3 space-y-2">
              <li>
                <Link href="/konsol" className="hover:text-ink">
                  Ringkasan teknis
                </Link>
              </li>
              <li>
                <Link href="/ocean" className="hover:text-ink">
                  Pemantauan laut
                </Link>
              </li>
              <li>
                <Link href="/satellite" className="hover:text-ink">
                  Satelit Copernicus
                </Link>
              </li>
              <li>
                <Link href="/sources" className="hover:text-ink">
                  Sumber data
                </Link>
              </li>
            </ul>
          </nav>
        </div>
        <div className="border-t border-line">
          <p className="mx-auto w-full max-w-[1180px] px-5 py-4 text-[10px] text-muted sm:px-8">
            Data buoy disimulasikan dan diberi label; rekaman Copernicus adalah akuisisi historis nyata.
            Peta dasar © OpenStreetMap contributors.
          </p>
        </div>
      </footer>
    </div>
  );
}

"use client";

import {
  ArrowRight,
  BellRing,
  BookOpen,
  CheckCircle2,
  Gauge,
  LifeBuoy,
  SlidersHorizontal,
  TriangleAlert,
  Waves,
  Wind,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ACTIVITIES, assessConditions, type ActivityKey } from "@/lib/coastal";
import { cn } from "@/lib/format";

const LEVEL_STYLE = {
  tenang: { icon: CheckCircle2, verdict: "Aman", text: "text-ok", panel: "bg-[var(--color-panel-clear)]" },
  hati: { icon: TriangleAlert, verdict: "Hati-hati", text: "text-amber", panel: "bg-[var(--color-panel-caution)]" },
  tunda: { icon: XCircle, verdict: "Tunda", text: "text-signal-ink", panel: "bg-[var(--color-panel-danger)]" },
} as const;

const GLOSSARY = [
  {
    icon: Waves,
    title: "Ombak",
    text: "Tinggi gelombang dari lembah ke puncak. 1 meter kira-kira setinggi pinggang orang dewasa.",
  },
  {
    icon: Gauge,
    title: "Periode gelombang",
    text: "Jeda waktu antar puncak ombak. Semakin panjang, semakin besar energi yang dibawa.",
  },
  {
    icon: Wind,
    title: "Angin",
    text: "Kecepatan angin di permukaan laut. Di atas 10 m/s, perahu kecil mulai sulit dikendalikan.",
  },
  {
    icon: BellRing,
    title: "Peringatan aktif",
    text: "Pemberitahuan yang masih berlaku. Setiap pemberitahuan berakhir otomatis setelah 6 jam.",
  },
  {
    icon: LifeBuoy,
    title: "Aman / hati-hati / tunda",
    text: "Ringkasan dari ombak, angin, dan peringatan untuk aktivitas yang kamu pilih.",
  },
  {
    icon: BookOpen,
    title: "Data buoy",
    text: "Pembacaan dari perangkat di laut yang sudah diperiksa sebelum ditampilkan.",
  },
];

export default function BelajarPage() {
  const [wave, setWave] = useState(1.0);
  const [wind, setWind] = useState(6);
  const [activity, setActivity] = useState<ActivityKey>("boat");

  const assessment = assessConditions({
    activity,
    wave,
    wind,
    ageSeconds: 0,
    alerts: [],
    riskLevel: null,
    riskAt: null,
  });
  const style = LEVEL_STYLE[assessment.level];
  const Icon = style.icon;

  return (
    <>
      <section className="mb-7 flex flex-col gap-4 pb-1">
        <div className="max-w-3xl">
          <p className="eyebrow">Belajar</p>
          <h1 className="display mt-2.5 text-[clamp(2.1rem,4.4vw,3.4rem)]">Kenali laut sebelum berangkat.</h1>
          <p className="mt-3 max-w-2xl text-[15.5px] leading-[1.6] text-ink-soft">
            Istilah yang sering muncul di konsol, dijelaskan singkat. Coba juga eksperimen kecil di
            bawah untuk melihat bagaimana status berubah.
          </p>
        </div>
      </section>

      <section className="card p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2 border-b border-line pb-3">
          <SlidersHorizontal className="h-4 w-4 text-ink" aria-hidden />
          <h2 className="text-[19px]">Eksperimen kecil</h2>
          <span className="ml-auto text-[13px] text-muted">angka contoh, bukan data langsung</span>
        </div>

        <div className="mt-4 grid items-start gap-5 lg:grid-cols-2">
          <div className="space-y-5">
            <label className="block">
              <span className="flex items-baseline justify-between">
                <span className="text-[13.5px] font-medium text-ink">Tinggi ombak</span>
                <span className="metric text-[13.5px] font-semibold text-ink">{wave.toFixed(1)} m</span>
              </span>
              <input
                type="range"
                min={0.2}
                max={4}
                step={0.1}
                value={wave}
                onChange={(event) => setWave(Number(event.target.value))}
                className="mt-2 w-full accent-sea"
                aria-label="Tinggi ombak"
              />
              <span className="mt-1 block text-[14px] text-muted">0,2 m tenang — 4 m sangat tinggi</span>
            </label>

            <label className="block">
              <span className="flex items-baseline justify-between">
                <span className="text-[13.5px] font-medium text-ink">Kecepatan angin</span>
                <span className="metric text-[13.5px] font-semibold text-ink">{wind} m/s</span>
              </span>
              <input
                type="range"
                min={2}
                max={20}
                step={1}
                value={wind}
                onChange={(event) => setWind(Number(event.target.value))}
                className="mt-2 w-full accent-sea"
                aria-label="Kecepatan angin"
              />
              <span className="mt-1 block text-[14px] text-muted">2 m/s sepoi — 20 m/s sangat kencang</span>
            </label>

            <div>
              <p className="text-[13.5px] font-medium text-ink">Aktivitas</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {ACTIVITIES.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActivity(item.key)}
                    className={cn(
                      "rounded-full px-3.5 py-1.5 text-[13.5px] transition-colors",
                      activity === item.key
                        ? "bg-ground text-white"
                        : "bg-paper text-ink-soft hover:text-ink",
                    )}
                    aria-pressed={activity === item.key}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={cn("flex flex-col justify-between rounded-[var(--radius-panel)] p-4", style.panel)}>
            <div>
              <p className="text-[13px] text-muted">Hasil untuk aktivitas ini</p>
              <p className={cn("verdict mt-1 flex items-center gap-2.5 text-[clamp(2.2rem,5vw,3rem)]", style.text)}>
                <Icon className="h-[0.5em] w-[0.5em] shrink-0" strokeWidth={2.4} aria-hidden />
                {style.verdict}
              </p>
              <p className="mt-2.5 text-[14.5px] leading-relaxed text-ink-soft">{assessment.advice}</p>
            </div>
            <p className="mt-4 text-[13px] leading-relaxed text-muted">
              Geser ombak ke 2,5 m atau angin ke 15 m/s untuk melihat putusannya berubah.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-[19px]">Kamus singkat</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {GLOSSARY.map((item) => {
            const ItemIcon = item.icon;
            return (
              <article key={item.title} className="card p-4">
                <ItemIcon className="h-[18px] w-[18px] text-ink" strokeWidth={1.8} aria-hidden />
                <h3 className="mt-2.5 text-[16px] font-medium text-ink">{item.title}</h3>
                <p className="mt-1 text-[13.5px] leading-relaxed text-ink-soft">{item.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-7 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <div className="card p-4">
          <h2 className="text-[17px]">Dari mana statusnya?</h2>
          <ol className="mt-3 divide-y divide-line border-y border-line">
            {[
              ["Data buoy", "Ombak, angin, periode, dan tekanan dibaca dari perangkat di laut."],
              ["Batas per aktivitas", "Setiap aktivitas punya batas aman berbeda. Perahu kecil lebih sensitif."],
              ["Status", "Sistem membandingkan data dengan batas tersebut, lalu memberi status dan saran."],
            ].map(([title, copy], index) => (
              <li key={title} className="flex gap-3 py-2.5">
                <span className="metric shrink-0 text-[13px] text-muted">{String(index + 1).padStart(2, "0")}</span>
                <span className="text-[14px] leading-relaxed text-ink-soft">
                  <span className="font-semibold text-ink">{title}. </span>
                  {copy}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="card flex flex-col justify-between gap-5 p-5">
          <div>
            <h2 className="text-[17px]">Sudah paham?</h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">
              Sekarang cek kondisi pantai pilihanmu, atau lihat angka lengkapnya di konsol.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/cek" className="btn btn-primary btn-sm">
              Cek kondisi <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
            <Link href="/konsol" className="btn btn-ghost btn-sm">
              Lihat angka asli
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

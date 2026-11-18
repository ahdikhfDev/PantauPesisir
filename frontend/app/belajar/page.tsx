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
  tenang: { icon: CheckCircle2, text: "text-ok", panel: "border-ok/30 bg-ok-soft/50" },
  hati: { icon: TriangleAlert, text: "text-amber", panel: "border-amber/35 bg-amber-soft/60" },
  tunda: { icon: XCircle, text: "text-signal-dark", panel: "border-signal/30 bg-signal-soft/60" },
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
      <section className="mb-6 flex flex-col gap-4 border-b border-line pb-5">
        <div className="max-w-3xl">
          <span className="eyebrow">Belajar</span>
          <h1 className="font-display mt-2 text-[26px] font-semibold leading-[1.06] tracking-[-0.04em] sm:text-[32px]">
            Kenali laut, <span className="text-sea">sebelum berangkat.</span>
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">
            Istilah yang sering muncul di konsol, dijelaskan singkat. Coba juga eksperimen kecil di
            bawah untuk melihat bagaimana status berubah.
          </p>
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-sea" aria-hidden />
          <h2 className="text-[14px] font-semibold">Eksperimen kecil</h2>
          <span className="ml-auto text-[10px] text-muted">angka contoh, bukan data live</span>
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-5">
            <label className="block">
              <span className="flex items-baseline justify-between">
                <span className="text-[11.5px] font-medium text-ink">Tinggi ombak</span>
                <span className="metric text-[12px] font-semibold text-ink">{wave.toFixed(1)} m</span>
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
              <span className="mt-1 block text-[10px] text-muted">0,2 m tenang — 4 m sangat tinggi</span>
            </label>

            <label className="block">
              <span className="flex items-baseline justify-between">
                <span className="text-[11.5px] font-medium text-ink">Kecepatan angin</span>
                <span className="metric text-[12px] font-semibold text-ink">{wind} m/s</span>
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
              <span className="mt-1 block text-[10px] text-muted">2 m/s sepoi — 20 m/s sangat kencang</span>
            </label>

            <div>
              <p className="text-[11.5px] font-medium text-ink">Aktivitas</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {ACTIVITIES.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setActivity(item.key)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-[10.5px] font-medium transition-colors",
                      activity === item.key
                        ? "bg-sea text-white"
                        : "bg-paper text-muted ring-1 ring-line hover:text-ink",
                    )}
                    aria-pressed={activity === item.key}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={cn("flex flex-col justify-between rounded-[12px] border p-4", style.panel)}>
            <div>
              <p className="text-[9.5px] font-semibold tracking-[0.12em] text-muted">HASIL CONTOH</p>
              <div className="mt-2 flex items-start gap-3">
                <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", style.text)} aria-hidden />
                <p className={cn("text-[16px] font-semibold leading-tight", style.text)}>
                  {assessment.level === "tenang"
                    ? "Aman"
                    : assessment.level === "hati"
                      ? "Hati-hati"
                      : "Sebaiknya tunda"}
                </p>
              </div>
              <p className="mt-3 text-[11.5px] leading-relaxed text-ink-soft">{assessment.advice}</p>
            </div>
            <p className="mt-4 text-[10px] leading-relaxed text-muted">
              Coba geser ombak ke 2,5 m atau angin ke 15 m/s dan lihat statusnya berubah.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-5">
        <h2 className="text-[14px] font-semibold">Kamus singkat</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {GLOSSARY.map((item) => {
            const ItemIcon = item.icon;
            return (
              <article key={item.title} className="card p-4">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-sea-soft text-sea">
                  <ItemIcon className="h-4 w-4" aria-hidden />
                </span>
                <h3 className="mt-2.5 text-[12.5px] font-semibold text-ink">{item.title}</h3>
                <p className="mt-1 text-[11px] leading-relaxed text-muted">{item.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div className="card p-5">
          <h2 className="text-[14px] font-semibold">Dari mana statusnya?</h2>
          <ol className="mt-3 space-y-3">
            {[
              ["Data buoy", "Ombak, angin, periode, dan tekanan dibaca dari perangkat di laut."],
              ["Batas per aktivitas", "Setiap aktivitas punya batas aman berbeda. Perahu kecil lebih sensitif."],
              ["Status", "Sistem membandingkan data dengan batas tersebut, lalu memberi status dan saran."],
            ].map(([title, copy], index) => (
              <li key={title} className="flex gap-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sea-soft text-[10px] font-semibold text-sea">
                  {index + 1}
                </span>
                <span className="text-[11.5px] leading-relaxed text-ink-soft">
                  <span className="font-semibold text-ink">{title}. </span>
                  {copy}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="card flex flex-col justify-between gap-3 p-5">
          <div>
            <h2 className="text-[14px] font-semibold">Sudah paham?</h2>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">
              Sekarang cek kondisi pantai pilihanmu, atau lihat angka lengkapnya di konsol.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/" className="btn btn-primary btn-sm">
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

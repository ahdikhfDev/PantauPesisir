"use client";

import {
  ArrowRight,
  BellRing,
  CheckCircle2,
  Clock,
  RefreshCw,
  Sparkles,
  TriangleAlert,
  Waves,
  Wind,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ACTIVITIES, type ActivityKey } from "@/lib/coastal";
import { cn, fixed, formatAge } from "@/lib/format";

interface Ringkasan {
  zone_code: string;
  zone_name: string;
  activity: ActivityKey;
  level: "tenang" | "hati" | "tunda";
  level_label: string;
  summary: string;
  advice: string;
  reasons: string[];
  metrics: {
    wave_m: number | null;
    wind_mps: number | null;
    age_seconds: number | null;
    alert_count: number;
  };
  source: "ai" | "template";
  generated_at: string;
}

const ZONES = [
  { code: "JKT-BAY", name: "Teluk Jakarta" },
  { code: "SMR-UTC", name: "Pantai Semarang" },
  { code: "MKS-STR", name: "Selat Makassar" },
];

const LEVEL_STYLE = {
  tenang: {
    icon: CheckCircle2,
    text: "text-ok",
    panel: "border-ok/30 bg-ok-soft/50",
    chip: "bg-ok/10 text-ok",
  },
  hati: {
    icon: TriangleAlert,
    text: "text-amber",
    panel: "border-amber/35 bg-amber-soft/60",
    chip: "bg-amber/10 text-amber",
  },
  tunda: {
    icon: XCircle,
    text: "text-signal-dark",
    panel: "border-signal/30 bg-signal-soft/60",
    chip: "bg-signal/10 text-signal-dark",
  },
} as const;

export default function RingkasanPage() {
  const [zone, setZone] = useState("JKT-BAY");
  const [activity, setActivity] = useState<ActivityKey>("boat");
  const [refreshKey, setRefreshKey] = useState(0);
  const [data, setData] = useState<Ringkasan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);
    const refresh = refreshKey > 0 ? "&refresh=1" : "";
    fetch(`/api/ringkasan?zone=${zone}&activity=${activity}${refresh}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Ringkasan belum tersedia");
        return (await response.json()) as Ringkasan;
      })
      .then((payload) => {
        if (active) setData(payload);
      })
      .catch((err: unknown) => {
        if (!active || (err as Error).name === "AbortError") return;
        setError("Ringkasan sedang tidak bisa dibuat. Coba lagi sebentar.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [zone, activity, refreshKey]);

  const level = data?.level ?? "tenang";
  const style = LEVEL_STYLE[level];
  const Icon = style.icon;
  const activeActivity = ACTIVITIES.find((item) => item.key === activity)!;

  return (
    <>
      <section className="mb-6 flex flex-col gap-4 border-b border-line pb-5">
        <div className="max-w-3xl">
          <span className="eyebrow">Ringkasan AI</span>
          <h1 className="font-display mt-2 text-[26px] font-semibold leading-[1.06] tracking-[-0.04em] sm:text-[32px]">
            Kondisi laut, <span className="text-sea">dalam bahasa manusia.</span>
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">
            Data buoy dan hasil analisis dirangkum menjadi dua kalimat yang mudah dibaca. Status dan angka
            tetap dihitung sistem; AI hanya membantu menjelaskannya.
          </p>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        {ZONES.map((item) => (
          <button
            key={item.code}
            type="button"
            onClick={() => setZone(item.code)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-[11.5px] font-medium transition-colors",
              zone === item.code
                ? "border-sea bg-sea text-white"
                : "border-line bg-surface text-ink-soft hover:border-line-strong",
            )}
            aria-pressed={zone === item.code}
          >
            {item.name}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {ACTIVITIES.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setActivity(item.key)}
            className={cn(
              "rounded-full px-3 py-1 text-[10.5px] font-medium transition-colors",
              activity === item.key
                ? "bg-ink text-white"
                : "bg-paper text-muted ring-1 ring-line hover:text-ink",
            )}
            aria-pressed={activity === item.key}
          >
            {item.label}
          </button>
        ))}
      </div>

      <section className={cn("card mt-4 overflow-hidden border", style.panel)} aria-live="polite">
        <div className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] bg-white/85">
                <Icon className={cn("h-6 w-6", style.text)} aria-hidden />
              </span>
              <div>
                <p className="text-[10px] font-semibold tracking-[0.14em] text-muted">
                  {data?.zone_name?.toUpperCase() ?? "MEMUAT…"} · {activeActivity.label.toUpperCase()}
                </p>
                <h2 className={cn("mt-1 text-[22px] font-semibold leading-tight tracking-[-0.03em]", style.text)}>
                  {loading && !data ? "Menyusun ringkasan…" : data?.level_label ?? "—"}
                </h2>
              </div>
            </div>
            <span className="flex shrink-0 items-center gap-2">
              {data ? (
                <span className="rounded-full bg-white/70 px-2.5 py-1 text-[9.5px] font-medium text-muted">
                  {data.source === "ai" ? "Dijelaskan AI" : "Ringkasan otomatis"}
                </span>
              ) : null}
              <span className="flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-[10.5px] text-muted">
                <Clock className="h-3 w-3" aria-hidden />
                {data?.metrics.age_seconds != null
                  ? `Data ${formatAge(data.metrics.age_seconds)}`
                  : "Menunggu data"}
              </span>
            </span>
          </div>

          <div className="mt-5 rounded-[12px] bg-white/70 p-4 sm:p-5">
            <p className="flex items-center gap-1.5 text-[9.5px] font-semibold tracking-[0.12em] text-muted">
              <Sparkles className="h-3 w-3 text-sea" aria-hidden /> RINGKASAN
            </p>
            {loading && !data ? (
              <div className="mt-2 space-y-2">
                <div className="h-3.5 w-full animate-pulse rounded bg-line" />
                <div className="h-3.5 w-4/5 animate-pulse rounded bg-line" />
                <div className="h-3.5 w-2/3 animate-pulse rounded bg-line" />
              </div>
            ) : (
              <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
                {data?.summary ?? error ?? "—"}
              </p>
            )}
            {data?.advice ? (
              <p className={cn("mt-3 inline-flex rounded-[10px] px-3 py-2 text-[12px] font-medium", style.chip)}>
                {data.advice}
              </p>
            ) : null}
          </div>

          <div className="mt-4 grid gap-0 overflow-hidden rounded-[12px] bg-white/55 sm:grid-cols-3">
            <div className="border-b border-white/70 px-4 py-3 sm:border-b-0 sm:border-r">
              <p className="flex items-center gap-1 text-[9.5px] font-semibold tracking-[0.1em] text-muted">
                <Waves className="h-3 w-3" aria-hidden /> OMBAK
              </p>
              <p className="metric mt-1 text-[17px] text-ink">{fixed(data?.metrics.wave_m, 1)} m</p>
            </div>
            <div className="border-b border-white/70 px-4 py-3 sm:border-b-0 sm:border-r">
              <p className="flex items-center gap-1 text-[9.5px] font-semibold tracking-[0.1em] text-muted">
                <Wind className="h-3 w-3" aria-hidden /> ANGIN
              </p>
              <p className="metric mt-1 text-[17px] text-ink">{fixed(data?.metrics.wind_mps, 0)} m/s</p>
            </div>
            <div className="px-4 py-3">
              <p className="flex items-center gap-1 text-[9.5px] font-semibold tracking-[0.1em] text-muted">
                <BellRing className="h-3 w-3" aria-hidden /> PERINGATAN
              </p>
              <p className="metric mt-1 text-[17px] text-ink">{data?.metrics.alert_count ?? 0}</p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold text-ink-soft">Kenapa?</span>
            {(data?.reasons ?? []).map((reason) => (
              <span key={reason} className="rounded-full bg-white/75 px-2.5 py-1 text-[10px] text-muted">
                {reason}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/70 bg-white/45 px-5 py-3">
          <p className="max-w-md text-[9.5px] leading-relaxed text-muted">
            Ringkasan mengikuti data terakhir dan aturan batas aman per aktivitas. Untuk prakiraan resmi,
            cek juga BMKG.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRefreshKey((value) => value + 1)}
              disabled={loading}
              className="btn btn-ghost btn-sm"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden />
              Perbarui
            </button>
            <Link href="/konsol" className="btn btn-primary btn-sm">
              Angka detail <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div className="card p-5">
          <h2 className="text-[14px] font-semibold">Bagaimana ringkasan ini dibuat?</h2>
          <ol className="mt-3 space-y-3">
            {[
              ["Data buoy", "Ombak, angin, periode, dan tekanan dibaca dari buoy lalu diperiksa kewajarannya."],
              ["Analisis sistem", "Aturan batas aman per aktivitas dan peringatan aktif menentukan status."],
              ["Dirangkum", "AI menulis ulang hasilnya menjadi dua kalimat; angkanya tidak diubah."],
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
            <h2 className="text-[14px] font-semibold">Mau lihat angka lengkap?</h2>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">
              Grafik, riwayat pembacaan, dan asal-usul setiap nilai tersedia di konsol teknis.
            </p>
          </div>
          <Link href="/konsol" className="btn btn-ghost btn-sm self-start">
            Buka konsol teknis <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </section>
    </>
  );
}

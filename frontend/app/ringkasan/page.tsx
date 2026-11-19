"use client";

import { ArrowRight, BellRing, CheckCircle2, Clock, RefreshCw, Sparkles, TriangleAlert, Waves, Wind, XCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

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
  tenang: { icon: CheckCircle2, verdict: "Aman", text: "text-ok", band: "bg-ok" },
  hati: { icon: TriangleAlert, verdict: "Hati-hati", text: "text-amber", band: "bg-amber" },
  tunda: { icon: XCircle, verdict: "Tunda", text: "text-signal-ink", band: "bg-signal" },
} as const;

export default function RingkasanPage() {
  const [zone, setZone] = useState("JKT-BAY");
  const [activity, setActivity] = useState<ActivityKey>("boat");
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState<Ringkasan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const forceNext = useRef(false);
  const loaded = useRef(false);

  const reload = (force = false) => {
    if (force) forceNext.current = true;
    setReloadKey((value) => value + 1);
  };

  // Data buoy bisa berubah tanpa interaksi; ringkasan ikut menyegarkan diri.
  useEffect(() => {
    const id = window.setInterval(() => setReloadKey((value) => value + 1), 60000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    const force = forceNext.current;
    forceNext.current = false;
    if (!loaded.current) setLoading(true);
    setError(null);
    const refresh = force ? "&refresh=1" : "";
    fetch(`/api/ringkasan?zone=${zone}&activity=${activity}${refresh}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Ringkasan belum tersedia");
        return (await response.json()) as Ringkasan;
      })
      .then((payload) => {
        if (active) {
          setData(payload);
          loaded.current = true;
        }
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
  }, [zone, activity, reloadKey]);

  const level = data?.level ?? "tenang";
  const style = LEVEL_STYLE[level];
  const Icon = style.icon;
  const activeActivity = ACTIVITIES.find((item) => item.key === activity)!;

  return (
    <>
      <section className="mb-7 flex flex-col gap-4 pb-1">
        <div className="max-w-3xl">
          <p className="eyebrow">Kabar laut</p>
          <h1 className="display mt-2.5 text-[clamp(2.1rem,4.4vw,3.4rem)]">Kabar laut hari ini.</h1>
          <p className="mt-3 max-w-2xl text-[15.5px] leading-[1.6] text-ink-soft">
            Satu paragraf untuk dibaca sebelum berangkat. Ombak, angin, dan peringatan, tanpa istilah
            rumit.
          </p>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-[13px] text-muted">Pantai</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {ZONES.map((item) => (
              <button
                key={item.code}
                type="button"
                onClick={() => setZone(item.code)}
                aria-pressed={zone === item.code}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-[13.5px] transition-colors",
                  zone === item.code
                    ? "bg-ground text-white"
                    : "bg-surface text-ink-soft hover:bg-line/40 hover:text-ink",
                )}
              >
                {item.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[13px] text-muted">Aktivitas</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {ACTIVITIES.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setActivity(item.key)}
                aria-pressed={activity === item.key}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-[13.5px] transition-colors",
                  activity === item.key
                    ? "bg-ground text-white"
                    : "bg-surface text-ink-soft hover:bg-line/40 hover:text-ink",
                )}
              >
                {item.label.split(" / ")[0].split(" & ")[0]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <section className={cn("mt-5 overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper shadow-[var(--shadow-card)]")} aria-live="polite">
        <div className={cn("flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-white", style.band)}>
          <p className="flex items-center gap-2 font-display text-[16px] font-medium">
            <Icon className="h-4 w-4 shrink-0" strokeWidth={2.4} aria-hidden />
            {data?.zone_name ?? "Teluk Jakarta"} · {activeActivity.label}
          </p>
          <p className="metric flex items-center gap-1.5 text-[12.5px] text-paper/70">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {data?.metrics.age_seconds != null ? `data ${formatAge(data.metrics.age_seconds)}` : "menunggu data"}
          </p>
        </div>

        <div className="px-5 pb-5 pt-6">
          <p className="text-[13.5px] text-muted">Putusan</p>
          <p className={cn("verdict mt-2 flex items-center gap-3 text-[clamp(2.6rem,6vw,3.8rem)]", style.text)}>
            <Icon className="h-[0.55em] w-[0.55em] shrink-0" strokeWidth={2.4} aria-hidden />
            {loading && !data ? "Menyusun" : style.verdict}
          </p>

          <p className="mt-3 max-w-[62ch] text-[16px] leading-[1.6] text-ink">
            {loading && !data ? "Menyusun ringkasan dari pembacaan terbaru." : data?.summary ?? error ?? "—"}
          </p>
          {data?.advice ? (
            <p className="mt-2.5 max-w-[62ch] text-[15px] leading-[1.6] text-ink-soft">{data.advice}</p>
          ) : null}
        </div>

        <dl className="mx-5 mb-5 grid overflow-hidden rounded-[var(--radius-panel)] bg-surface sm:grid-cols-3">
          {[
            { icon: Waves, label: "Ombak", value: fixed(data?.metrics.wave_m, 1), unit: "m" },
            { icon: Wind, label: "Angin", value: fixed(data?.metrics.wind_mps, 0), unit: "m/s" },
            { icon: BellRing, label: "Peringatan", value: String(data?.metrics.alert_count ?? 0), unit: "aktif" },
          ].map((metric, index) => (
            <div
              key={metric.label}
              className={cn("px-4 py-3", index ? "sm:border-l sm:border-line" : "")}
            >
              <dt className="flex items-center gap-1.5 text-[13px] text-muted">
                <metric.icon className="h-3.5 w-3.5" aria-hidden />
                {metric.label}
              </dt>
              <dd className="metric mt-1 flex items-baseline gap-1.5 text-[26px] leading-none font-semibold">
                {metric.value}
                <span className="text-[14px] font-normal text-muted">{metric.unit}</span>
              </dd>
            </div>
          ))}
        </dl>

        {data?.reasons?.length ? (
          <div className="px-5 py-3">
            <p className="text-[13.5px] text-muted">Yang menentukan</p>
            <ul className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-[14px] text-ink-soft">
              {data.reasons.map((reason) => (
                <li key={reason} className="flex items-baseline gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 translate-y-[-1px] bg-ink" aria-hidden />
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <p className="max-w-md text-[12.5px] leading-relaxed text-muted">
            Untuk prakiraan resmi, cek BMKG sebelum berangkat.
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => reload(true)} disabled={loading} className="btn btn-ghost btn-sm">
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} aria-hidden />
              Perbarui
            </button>
            <Link href="/konsol" className="btn btn-primary btn-sm">
              Angka detail <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-7 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <div className="card p-4">
          <h2 className="text-[17px]">Dari mana ringkasan ini?</h2>
          <ol className="mt-3 divide-y divide-line">
            {[
              ["Data buoy", "Ombak, angin, periode, dan tekanan dibaca dari perangkat di laut."],
              ["Batas per aktivitas", "Setiap aktivitas punya batas aman berbeda; perahu kecil paling sensitif."],
              ["Kalimat", "Angka rubrik yang sama, ditulis ulang menjadi bahasa sehari-hari."],
            ].map(([title, copy], index) => (
              <li key={title} className="flex gap-3 py-2.5">
                <span className="metric shrink-0 text-[13px] text-muted">{String(index + 1).padStart(2, "0")}</span>
                <span className="text-[14px] leading-relaxed text-ink-soft">
                  <span className="font-medium text-ink">{title}. </span>
                  {copy}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 flex items-center gap-1.5 text-[13px] text-muted">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {data?.source === "ai"
              ? "Kalimat ditulis model bahasa dari angka di atas."
              : "Kalimat disusun dari templat, bukan model."}
          </p>
        </div>

        <div className="card flex flex-col justify-between gap-5 p-5">
          <div>
            <h2 className="text-[17px]">Mau lihat angka aslinya?</h2>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink-soft">
              Grafik, riwayat pembacaan, dan asal-usul setiap nilai ada di konsol teknis.
            </p>
          </div>
          <Link href="/konsol" className="btn btn-ghost btn-sm self-start">
            Buka konsol <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </section>
    </>
  );
}

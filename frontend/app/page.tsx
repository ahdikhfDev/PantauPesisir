"use client";

import {
  Anchor,
  ArrowRight,
  CheckCircle2,
  Clock,
  LifeBuoy,
  MapPin,
  Ship,
  Sun,
  TriangleAlert,
  Waves,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import { cn, fixed, formatAge, formatShortWib } from "@/lib/format";
import {
  ACTIVITIES,
  assessConditions,
  LEVEL_LABEL,
  LIMITS,
  waveWords,
  windWords,
  type ActivityKey,
  type Level,
} from "@/lib/coastal";
import { WaveHistoryChart } from "@/components/warga/wave-chart";
import { useApi } from "@/lib/hooks";
import type { AlertList, HistoryResponse, LatestResponse, Prediction, Zone } from "@/lib/types";

const ZoneMap = dynamic(() => import("@/components/zone-map").then((mod) => mod.ZoneMap), {
  ssr: false,
  loading: () => <div className="skeleton h-[280px] w-full" />,
});

const ACTIVITY_ICONS: Record<ActivityKey, typeof Anchor> = {
  boat: Anchor,
  beach: Sun,
  port: Ship,
};

const LEVEL_META: Record<
  Level,
  {
    label: string;
    badge: string;
    panel: string;
    icon: typeof CheckCircle2;
    scale: string;
  }
> = {
  tenang: {
    label: LEVEL_LABEL.tenang,
    badge: "text-ok",
    panel: "border-ok/30 bg-ok-soft/60",
    icon: CheckCircle2,
    scale: "bg-ok",
  },
  hati: {
    label: LEVEL_LABEL.hati,
    badge: "text-amber",
    panel: "border-amber/35 bg-amber-soft/70",
    icon: TriangleAlert,
    scale: "bg-amber",
  },
  tunda: {
    label: LEVEL_LABEL.tunda,
    badge: "text-signal-dark",
    panel: "border-signal/30 bg-signal-soft/70",
    icon: XCircle,
    scale: "bg-signal",
  },
};

const FALLBACK_ZONES = [
  { zone_code: "JKT-BAY", zone_name: "Teluk Jakarta" },
  { zone_code: "SMR-UTC", zone_name: "Pantai Semarang" },
  { zone_code: "MKS-STR", zone_name: "Selat Makassar" },
];

export default function CekPage() {
  const zones = useApi<Zone[]>("/coastal/zones", 120000);
  const latest = useApi<LatestResponse>("/buoy/latest", 30000);
  const predictions = useApi<Prediction[]>("/analytics/history?limit=20", 30000);
  const alerts = useApi<AlertList>("/alerts?status=open&limit=30", 30000);

  const zoneOptions = zones.data?.length ? zones.data : FALLBACK_ZONES;
  const [zoneCode, setZoneCode] = useState<string>("JKT-BAY");
  const [activity, setActivity] = useState<ActivityKey>("boat");

  const zone = zoneOptions.find((item) => item.zone_code === zoneCode) ?? zoneOptions[0];

  // Only public read endpoints: the citizen page never asks for an API key.
  const since = useMemo(() => new Date(Date.now() - 24 * 3600_000).toISOString(), []);
  const history = useApi<HistoryResponse>(
    `/buoy/history?zone_code=${encodeURIComponent(zone.zone_code)}&page_size=300&observed_from=${encodeURIComponent(since)}`,
    60000,
  );

  const reading = useMemo(
    () => (latest.data?.items ?? []).find((item) => item.zone_code === zone.zone_code) ?? null,
    [latest.data, zone.zone_code],
  );
  const prediction = useMemo(
    () => (predictions.data ?? []).find((item) => item.zone_code === zone.zone_code && item.risk_level) ?? null,
    [predictions.data, zone.zone_code],
  );
  const zoneAlerts = useMemo(
    () => (alerts.data?.items ?? []).filter((item) => item.zone_code === zone.zone_code),
    [alerts.data, zone.zone_code],
  );

  const wave = reading?.parameters.wave_height_m ?? null;
  const wind = reading?.parameters.wind_speed_mps ?? null;
  const age = reading?.data_age_seconds ?? null;

  // One assessment implementation for every citizen surface. The home page used to
  // recompute the levels inline, which let its thresholds drift away from
  // lib/coastal.ts and from the /api/ringkasan text.
  const assessment = assessConditions({
    activity,
    wave,
    wind,
    ageSeconds: age,
    alerts: zoneAlerts,
    riskLevel: prediction?.risk_level ?? null,
    riskAt: prediction?.analysis_ended_at ?? null,
    observedAt: reading?.observed_at ?? null,
  });
  const level = assessment.level;
  const advice = assessment.advice;
  const reasons = assessment.reasons;

  const meta = LEVEL_META[level];
  const LevelIcon = meta.icon;
  const loading = latest.loading || zones.loading;
  const activeActivity = ACTIVITIES.find((item) => item.key === activity)!;

  const wavePoints = useMemo(
    () =>
      (history.data?.items ?? [])
        .filter((item) => item.validation_status === "valid")
        .map((item) => ({
          time: new Date(item.observed_at).getTime(),
          height: item.parameters.wave_height_m,
        }))
        .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.height))
        .sort((a, b) => a.time - b.time),
    [history.data],
  );

  return (
    <>
      <section className="mb-6 flex flex-col gap-4 border-b border-line pb-5">
        <div className="max-w-3xl">
          <span className="eyebrow">Untuk semua orang</span>
          <h1 className="font-display mt-2 text-[26px] font-semibold leading-[1.06] tracking-[-0.04em] sm:text-[32px]">
            Mau ke laut? <span className="text-sea">Cek dulu.</span>
          </h1>
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted">
            Pilih lokasi dan rencana aktivitas. Dalam hitungan detik, konsol ini merangkum kondisi laut
            terkini menjadi jawaban sederhana: aman, hati-hati, atau sebaiknya tunda.
          </p>
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-sea-deep text-[11px] font-semibold text-white">
            1
          </span>
          <h2 className="text-[14px] font-semibold">Pilih lokasi</h2>
          <span className="ml-auto flex items-center gap-1 text-[10px] text-muted">
            <MapPin className="h-3 w-3" aria-hidden /> {zoneOptions.length} zona terpantau
          </span>
        </div>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
          {zoneOptions.map((item) => {
            const active = item.zone_code === zone.zone_code;
            const itemReading = (latest.data?.items ?? []).find((row) => row.zone_code === item.zone_code);
            return (
              <button
                key={item.zone_code}
                type="button"
                onClick={() => setZoneCode(item.zone_code)}
                className={cn(
                  "rounded-[12px] border px-4 py-3 text-left transition-colors",
                  active
                    ? "border-sea bg-sea-soft/70"
                    : "border-line bg-surface hover:border-line-strong hover:bg-paper",
                )}
                aria-pressed={active}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-ink">{item.zone_name}</span>
                  <span className={cn("h-2 w-2 rounded-full", active ? "bg-sea" : "bg-line-strong")} aria-hidden />
                </span>
                <span className="mt-1 flex items-center gap-3 text-[10.5px] text-muted">
                  <span className="inline-flex items-center gap-1">
                    <Waves className="h-3 w-3" aria-hidden />
                    {itemReading ? `${fixed(itemReading.parameters.wave_height_m, 1)} m` : "—"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" aria-hidden />
                    {itemReading ? formatAge(itemReading.data_age_seconds) : "—"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-sea-deep text-[11px] font-semibold text-white">
            2
          </span>
          <h2 className="text-[14px] font-semibold">Rencana aktivitas</h2>
        </div>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
          {ACTIVITIES.map((item) => {
            const Icon = ACTIVITY_ICONS[item.key];
            const active = activity === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActivity(item.key)}
                className={cn(
                  "flex items-start gap-3 rounded-[12px] border px-4 py-3 text-left transition-colors",
                  active
                    ? "border-sea bg-sea-soft/70"
                    : "border-line bg-surface hover:border-line-strong hover:bg-paper",
                )}
                aria-pressed={active}
              >
                <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", active ? "text-sea" : "text-muted")} aria-hidden />
                <span>
                  <span className="block text-[12.5px] font-semibold text-ink">{item.label}</span>
                  <span className="mt-0.5 block text-[10.5px] leading-relaxed text-muted">{item.note}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className={cn("card mt-5 overflow-hidden border", meta.panel)} aria-live="polite">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[14px] bg-white/80">
              <LevelIcon className={cn("h-6 w-6", meta.badge)} aria-hidden />
            </span>
            <div>
              <p className="text-[10px] font-semibold text-muted">Hasil untuk {zone.zone_name}</p>
              <h2 className={cn("mt-1 text-[22px] font-semibold leading-tight tracking-[-0.03em]", meta.badge)}>
                {loading ? "Membaca kondisi…" : meta.label}
              </h2>
              <p className="mt-1.5 max-w-xl text-[12.5px] leading-relaxed text-ink-soft">
                {loading ? "Sebentar, mengambil pembacaan terbaru dari buoy." : advice}
              </p>
            </div>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-[10.5px] font-medium text-muted">
            <Clock className="h-3 w-3" aria-hidden />
            {age !== null ? `Diperbarui ${formatAge(age)}` : "Menunggu data"}
          </span>
        </div>

        <div className="grid gap-0 border-t border-white/60 bg-white/45 sm:grid-cols-3">
          <div className="border-b border-white/70 px-5 py-3.5 sm:border-b-0 sm:border-r">
            <p className="text-[9.5px] font-semibold text-muted">Ombak</p>
            <p className="metric mt-1 text-[17px] font-medium text-ink">{fixed(wave, 1)} m</p>
            <p className="text-[10.5px] text-muted">{waveWords(wave)}</p>
          </div>
          <div className="border-b border-white/70 px-5 py-3.5 sm:border-b-0 sm:border-r">
            <p className="text-[9.5px] font-semibold text-muted">Angin</p>
            <p className="metric mt-1 text-[17px] font-medium text-ink">{fixed(wind, 0)} m/s</p>
            <p className="text-[10.5px] text-muted">{windWords(wind)}</p>
          </div>
          <div className="px-5 py-3.5">
            <p className="text-[9.5px] font-semibold text-muted">Peringatan aktif</p>
            <p className="metric mt-1 text-[17px] font-medium text-ink">{zoneAlerts.length}</p>
            <p className="text-[10.5px] text-muted">{zoneAlerts.length ? zoneAlerts[0].title : "tidak ada"}</p>
          </div>
        </div>

        <div className="border-t border-white/60 bg-white/60 px-5 py-3">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted">
            <span className="font-semibold text-ink-soft">Kenapa?</span>
            {reasons.map((reason) => (
              <span key={reason} className="rounded-full bg-white/80 px-2 py-0.5">
                {reason}
              </span>
            ))}
          </p>
          <div className="mt-3 flex items-center gap-1.5 text-[10px] font-medium text-muted">
            <span>Tenang</span>
            <span className="mx-1 flex-1 overflow-hidden rounded-full bg-line">
              <span
                className={cn("block h-1.5 rounded-full transition-all", meta.scale)}
                style={{ width: level === "tenang" ? "33%" : level === "hati" ? "66%" : "100%" }}
              />
            </span>
            <span>Tunda</span>
          </div>
          <p className="mt-2 text-[9.5px] leading-relaxed text-muted">
            Penilaian memakai ombak, angin, riwayat analisis, dan peringatan aktif untuk{" "}
            {activeActivity.label.toLowerCase()}. Untuk prakiraan resmi, cek juga BMKG sebelum berangkat.
          </p>
        </div>
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-end justify-between gap-2 border-b border-line px-5 py-4">
            <div>
              <h2 className="text-[14px] font-semibold">Ombak 24 jam terakhir</h2>
              <p className="mt-0.5 text-[10.5px] text-muted">
                {zone.zone_name}
                {wavePoints.length
                  ? ` · ${formatShortWib(new Date(wavePoints[0].time).toISOString())} – ${formatShortWib(
                      new Date(wavePoints[wavePoints.length - 1].time).toISOString(),
                    )} WIB`
                  : ""}
              </p>
            </div>
            <span className="text-[10.5px] text-muted">
              {wavePoints.length ? `${wavePoints.length} pembacaan` : "memuat…"}
            </span>
          </div>
          <div className="px-3 pb-2 pt-3 sm:px-4">
            <WaveHistoryChart
              points={wavePoints}
              limit={LIMITS[activity].waveWarn}
              limitLabel={`batas aman ${fixed(LIMITS[activity].waveWarn, 1)} m`}
            />
          </div>
          <p className="border-t border-line px-5 py-2.5 text-[9.5px] leading-relaxed text-muted">
            Garis putus-putus adalah batas aman untuk {activeActivity.label.toLowerCase()}. Sumber:
            pembacaan buoy yang sudah diperiksa.
          </p>
        </section>

        <section className="card overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-[14px] font-semibold">Pantai yang dipantau</h2>
            <p className="mt-0.5 text-[10.5px] text-muted">Pilih pantai di peta untuk melihat kondisinya</p>
          </div>
          <div className="h-[280px] w-full">
            {zones.data ? (
              <ZoneMap
                zones={zones.data}
                latest={latest.data}
                variant="warga"
                activeZoneCode={zone.zone_code}
                onSelectZone={setZoneCode}
              />
            ) : (
              <div className="grid h-full place-items-center text-[11px] text-muted">Memuat peta…</div>
            )}
          </div>
          <p className="border-t border-line px-5 py-2.5 text-[9.5px] text-muted">
            Peta dasar © OpenStreetMap contributors
          </p>
        </section>
      </div>

      <section className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="card p-5">
          <h2 className="text-[14px] font-semibold">Cara membaca hasilnya</h2>
          <ul className="mt-3 space-y-2.5">
            {[
              ["Aman", "Ombak dan angin masih nyaman untuk aktivitas yang dipilih.", "bg-ok"],
              ["Hati-hati", "Ada satu kondisi yang mendekati batas. Tetap pantau dan siapkan pelampung.", "bg-amber"],
              ["Tunda", "Ombak, angin, atau peringatan sudah melewati batas aman aktivitas tersebut.", "bg-signal"],
            ].map(([title, copy, dot]) => (
              <li key={title} className="flex gap-2.5">
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", dot)} aria-hidden />
                <span className="text-[11.5px] leading-relaxed text-ink-soft">
                  <span className="font-semibold text-ink">{title}. </span>
                  {copy}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card flex flex-col justify-between gap-4 p-5">
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-semibold text-muted">
              <LifeBuoy className="h-3.5 w-3.5" aria-hidden /> Butuh angka lengkap?
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-muted">
              Riwayat per jam, metadata satelit, dan panel analisis tersedia di konsol pemantauan untuk
              operator.
            </p>
          </div>
          <Link href="/konsol" className="btn btn-ghost btn-sm self-start">
            Lihat detail teknis <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </section>
    </>
  );
}

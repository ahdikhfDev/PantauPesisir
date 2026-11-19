"use client";

import {
  Anchor,
  ArrowRight,
  CheckCircle2,
  Clock,
  LifeBuoy,
  MapPin,
  Ship,
  Share2,
  Sun,
  TriangleAlert,
  Waves,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

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
    verdict: string;
    text: string;
    band: string;
    icon: typeof CheckCircle2;
  }
> = {
  tenang: {
    label: LEVEL_LABEL.tenang,
    verdict: "Aman",
    text: "text-ok",
    band: "bg-ok",
    icon: CheckCircle2,
  },
  hati: {
    label: LEVEL_LABEL.hati,
    verdict: "Hati-hati",
    text: "text-amber",
    band: "bg-amber",
    icon: TriangleAlert,
  },
  tunda: {
    label: LEVEL_LABEL.tunda,
    verdict: "Tunda",
    text: "text-signal-ink",
    band: "bg-signal",
    icon: XCircle,
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
  const [range, setRange] = useState<"24h" | "7d">("24h");
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

  const zone = zoneOptions.find((item) => item.zone_code === zoneCode) ?? zoneOptions[0];

  // Only public read endpoints: the citizen page never asks for an API key.
  const since = useMemo(
    () => new Date(Date.now() - (range === "7d" ? 7 * 24 : 24) * 3600_000).toISOString(),
    [range],
  );
  const history = useApi<HistoryResponse>(
    `/buoy/history?zone_code=${encodeURIComponent(zone.zone_code)}&observed_from=${encodeURIComponent(
      since,
    )}&max_points=240`,
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

  // Plain WhatsApp deep link: no API call and no key, works on mobile and on web.
  const shareText = [
    `Kondisi laut ${zone.zone_name} untuk ${activeActivity.label.toLowerCase()}: ${meta.label}.`,
    wave !== null ? `Ombak ${fixed(wave, 1)} m, angin ${fixed(wind, 0)} m/s.` : "",
    origin ? `Cek di ${origin}/` : "",
    "Sumber: PantauPesisir, bukan peringatan resmi BMKG.",
  ]
    .filter(Boolean)
    .join(" ");
  const shareHref = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  return (
    <>
      <section className="mb-7 flex flex-col gap-4 pb-1">
        <div className="max-w-3xl">
          <p className="eyebrow">Cek kondisi</p>
          <h1 className="display mt-2.5 text-[clamp(2.1rem,4.4vw,3.4rem)]">
            Mau ke laut? Cek dulu.
          </h1>
          <p className="mt-3 max-w-2xl text-[15.5px] leading-[1.6] text-ink-soft">
            Pilih pantai dan rencana aktivitas. Halaman ini merangkum kondisi terkini menjadi satu
            putusan, aman, hati-hati, atau tunda, beserta sebabnya.
          </p>
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-[19px]">Pilih pantai</h2>
          <span className="flex items-center gap-1.5 text-[14px] text-muted">
            <MapPin className="h-3.5 w-3.5" aria-hidden /> {zoneOptions.length} pantai dipantau
          </span>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {zoneOptions.map((item, index) => {
            const active = item.zone_code === zone.zone_code;
            const itemReading = (latest.data?.items ?? []).find((row) => row.zone_code === item.zone_code);
            return (
              <button
                key={item.zone_code}
                type="button"
                onClick={() => setZoneCode(item.zone_code)}
                aria-pressed={active}
                className={cn(
                  "px-4 py-3.5 text-left transition-colors",
                  active
                    ? "rounded-[var(--radius-panel)] bg-ground text-white shadow-[var(--shadow-card)]"
                    : "rounded-[var(--radius-panel)] bg-surface text-ink hover:bg-line/40",
                )}
              >
                <span className="block text-[16.5px] font-medium">{item.zone_name}</span>
                <span
                  className={cn(
                    "mt-1.5 flex items-center gap-3.5 text-[14px]",
                    active ? "text-paper/70" : "text-muted",
                  )}
                >
                  <span className="metric inline-flex items-center gap-1.5">
                    <Waves className="h-3.5 w-3.5" aria-hidden />
                    {itemReading ? `${fixed(itemReading.parameters.wave_height_m, 1)} m` : "—"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" aria-hidden />
                    {itemReading ? formatAge(itemReading.data_age_seconds) : "—"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <h2 className="text-[19px]">Rencana aktivitas</h2>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {ACTIVITIES.map((item, index) => {
            const Icon = ACTIVITY_ICONS[item.key];
            const active = activity === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActivity(item.key)}
                aria-pressed={active}
                className={cn(
                  "flex items-start gap-3 px-4 py-3.5 text-left transition-colors",
                  active
                    ? "rounded-[var(--radius-panel)] bg-ground text-white shadow-[var(--shadow-card)]"
                    : "rounded-[var(--radius-panel)] bg-surface text-ink hover:bg-line/40",
                )}
              >
                <Icon
                  className={cn("mt-0.5 h-[18px] w-[18px] shrink-0", active ? "text-paper" : "text-muted")}
                  aria-hidden
                />
                <span>
                  <span className="block text-[15.5px] font-medium">{item.label}</span>
                  <span
                    className={cn(
                      "mt-1 block text-[14px] leading-snug",
                      active ? "text-paper/70" : "text-muted",
                    )}
                  >
                    {item.note}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-7" aria-live="polite">
        <div
          className={cn(
            "overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper shadow-[var(--shadow-card)] transition-colors duration-500",
          )}
        >
          <div className={cn("flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-white", meta.band)}>
            <p className="flex items-center gap-2 font-display text-[16px] font-medium">
              <meta.icon className="h-4 w-4 shrink-0" strokeWidth={2.4} aria-hidden />
              {zone.zone_name} · {activeActivity.label}
            </p>
            <p className="metric flex items-center gap-1.5 text-[13.5px] text-paper/70">
              <span className="live-dot h-1.5 w-1.5 rounded-full bg-paper" aria-hidden />
              <Clock className="h-3.5 w-3.5" aria-hidden />
              {age !== null ? `data ${formatAge(age)}` : "menunggu data"}
            </p>
          </div>

          <div className="flex flex-col gap-4 px-5 pb-5 pt-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[13.5px] text-muted">Putusan untuk aktivitas ini</p>
              {/* Re-keyed so the plate re-hangs when the verdict actually changes. */}
              <p
                key={`${zone.zone_code}-${activity}-${level}`}
                className={cn(
                  "verdict enter-plate mt-2 flex items-center gap-3 text-[clamp(2.6rem,6vw,3.8rem)]",
                  loading ? "text-muted" : meta.text,
                )}
              >
                {loading ? "Membaca" : meta.verdict}
                <meta.icon
                  className="h-[0.4em] w-[0.4em] shrink-0"
                  strokeWidth={2.4}
                  aria-hidden
                />
              </p>
              <p className="mt-3 max-w-[46ch] text-[15.5px] leading-[1.55] text-ink-soft">
                {loading ? "Mengambil pembacaan terbaru dari buoy." : advice}
              </p>
            </div>
            <a
              href={shareHref}
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost btn-sm shrink-0 self-start"
            >
              <Share2 className="h-3.5 w-3.5" aria-hidden /> Bagikan ke WhatsApp
            </a>
          </div>

          <dl className="mx-5 mb-5 grid overflow-hidden rounded-[var(--radius-panel)] bg-surface sm:grid-cols-3">
            <div className="border-b border-line px-4 py-3 sm:border-b-0">
              <dt className="text-[13.5px] text-muted">Ombak</dt>
              <dd className="metric mt-1 flex items-baseline gap-1.5 text-[26px] leading-none font-semibold">
                {fixed(wave, 1)}
                <span className="text-[13.5px] font-normal text-muted">m</span>
              </dd>
              <dd className="mt-1 text-[13.5px] text-muted">{waveWords(wave)}</dd>
            </div>
            <div className="border-b border-line px-4 py-3 sm:border-b-0 sm:border-l">
              <dt className="text-[13.5px] text-muted">Angin</dt>
              <dd className="metric mt-1 flex items-baseline gap-1.5 text-[26px] leading-none font-semibold">
                {fixed(wind, 0)}
                <span className="text-[13.5px] font-normal text-muted">m/s</span>
              </dd>
              <dd className="mt-1 text-[13.5px] text-muted">{windWords(wind)}</dd>
            </div>
            <div className="px-4 py-3 sm:border-l">
              <dt className="text-[13.5px] text-muted">Peringatan aktif</dt>
              <dd className="metric mt-1 text-[26px] leading-none font-semibold">{zoneAlerts.length}</dd>
              <dd className="mt-1 text-[13.5px] text-muted">
                {zoneAlerts.length ? zoneAlerts[0].title : "tidak ada"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="mt-5">
          <h2 className="text-[15px] font-medium">Yang menentukan putusan ini</h2>
          <ul key={`reasons-${zone.zone_code}-${activity}-${level}`} className="mt-2 divide-y divide-line">
            {reasons.map((reason, index) => (
              <li
                key={reason}
                className={cn(
                  "enter-up flex items-baseline gap-2.5 py-2 text-[14px] text-ink-soft",
                  `stagger-${Math.min(index + 1, 8)}`,
                )}
              >
                <span className="h-1.5 w-1.5 shrink-0 translate-y-[-1px] bg-ink" aria-hidden />
                {reason}
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center gap-3 text-[14px] text-muted">
            <span>Tenang</span>
            <span className="flex-1 border-t border-line-strong">
              <span
                key={`meter-${level}`}
                className={cn(
                  "grow-x block h-[3px] -translate-y-[2px]",
                  level === "tenang" ? "bg-ok" : level === "hati" ? "bg-amber" : "bg-signal",
                )}
                style={{ width: level === "tenang" ? "33%" : level === "hati" ? "66%" : "100%" }}
              />
            </span>
            <span>Tunda</span>
          </div>
          <p className="mt-3 max-w-3xl text-[14px] leading-relaxed text-muted">
            Penilaian memakai ombak, angin, riwayat analisis, dan peringatan aktif untuk{" "}
            {activeActivity.label.toLowerCase()}. Untuk prakiraan resmi, cek BMKG sebelum berangkat.
          </p>
        </div>
      </section>

      <div className="mt-7 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <section className="card">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-4 py-3">
            <div>
              <h2 className="text-[17px]">Ombak {range === "7d" ? "7 hari" : "24 jam"} terakhir</h2>
              <p className="mt-0.5 text-[14px] text-muted">
                {zone.zone_name}
                {wavePoints.length
                  ? `, ${formatShortWib(new Date(wavePoints[0].time).toISOString())} sampai ${formatShortWib(
                      new Date(wavePoints[wavePoints.length - 1].time).toISOString(),
                    )} WIB`
                  : ""}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {([
                ["24h", "24 jam"],
                ["7d", "7 hari"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRange(value)}
                  aria-pressed={range === value}
                  className={cn(
                    "border-b-2 px-0.5 pb-0.5 text-[14px] transition-colors",
                    range === value
                      ? "border-ink font-medium text-ink"
                      : "border-transparent text-muted hover:text-ink",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="px-3 pb-2 pt-3 sm:px-4">
            <WaveHistoryChart
              points={wavePoints}
              limit={LIMITS[activity].waveWarn}
              limitLabel={`batas aman ${fixed(LIMITS[activity].waveWarn, 1)} m`}
            />
          </div>
          <p className="border-t border-line px-4 py-2.5 text-[14px] leading-relaxed text-muted">
            Garis putus-putus adalah batas aman untuk {activeActivity.label.toLowerCase()}. Sumber:
            pembacaan buoy yang sudah diperiksa.
          </p>
        </section>

        <section className="card">
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-[17px]">Pantai yang dipantau</h2>
            <p className="mt-0.5 text-[14px] text-muted">Klik pantai di peta untuk memilihnya</p>
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
              <div className="grid h-full place-items-center text-[14px] text-muted">Memuat peta…</div>
            )}
          </div>
          <p className="border-t border-line px-4 py-2.5 text-[13.5px] text-muted">
            Peta dasar © OpenStreetMap contributors
          </p>
        </section>
      </div>

      <section className="mt-7 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="card p-4">
          <h2 className="text-[17px]">Cara membaca putusannya</h2>
          <dl className="mt-3 divide-y divide-line border-y border-line">
            {[
              ["Aman", "Ombak dan angin masih nyaman untuk aktivitas yang dipilih.", "bg-ok"],
              ["Hati-hati", "Satu kondisi mendekati batas. Tetap pantau dan siapkan pelampung.", "bg-amber"],
              ["Tunda", "Ombak, angin, atau peringatan sudah melewati batas aman aktivitas itu.", "bg-signal"],
            ].map(([title, copy, dot]) => (
              <div key={title} className="flex gap-2.5 py-2.5">
                <span className={cn("mt-2 h-2 w-2 shrink-0", dot)} aria-hidden />
                <div>
                  <dt className="text-[14px] font-medium">{title}</dt>
                  <dd className="mt-0.5 text-[13.5px] leading-relaxed text-ink-soft">{copy}</dd>
                </div>
              </div>
            ))}
          </dl>
        </div>

        <div className="card flex flex-col justify-between gap-5 p-5">
          <div>
            <p className="flex items-center gap-1.5 text-[14px] text-muted">
              <LifeBuoy className="h-4 w-4" aria-hidden /> Butuh angka lengkap?
            </p>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">
              Riwayat per jam, metadata satelit, dan panel analisis tersedia di konsol untuk operator.
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

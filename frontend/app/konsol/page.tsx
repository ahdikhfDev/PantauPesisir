"use client";

import {
  ArrowRight,
  ArrowUpRight,
  BellRing,
  BrainCircuit,
  Clock3,
  Database,
  LifeBuoy,
  Radar,
  RefreshCw,
  Satellite,
  ShieldCheck,
  Waves,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { SeaStateChart, type SeaPoint } from "@/components/dashboard/sea-state-chart";
import { Sparkline } from "@/components/sparkline";
import {
  EmptyState,
  ErrorState,
  PageHero,
  RiskBadge,
  SeverityBadge,
  SkeletonBlock,
  SourceBadge,
  StatusPill,
} from "@/components/ui";
import { cn, enumLabel, fixed, formatAge, formatShortWib, formatWib, statusTone } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type {
  AlertList,
  HistoryResponse,
  LatestResponse,
  Observation,
  Overview,
  Prediction,
  SystemHealth,
} from "@/lib/types";

const WINDOWS = [
  { hours: 1, label: "1h" },
  { hours: 3, label: "3h" },
  { hours: 6, label: "6h" },
];

export default function OverviewPage() {
  const [hours, setHours] = useState(3);
  const [chartZone, setChartZone] = useState("JKT-BAY");
  const [anchor, setAnchor] = useState(() => Date.now());

  const overview = useApi<Overview>("/system/overview", 20000);
  const latest = useApi<LatestResponse>("/buoy/latest", 20000);
  const alerts = useApi<AlertList>("/alerts?limit=6", 20000);
  const health = useApi<SystemHealth>("/system/health", 30000);
  const predictions = useApi<Prediction[]>("/analytics/history?limit=20", 30000);

  const since = useMemo(
    () => new Date(anchor - hours * 3600_000).toISOString(),
    [anchor, hours],
  );
  const history = useApi<HistoryResponse>(
    `/buoy/history?page_size=500&observed_from=${encodeURIComponent(since)}`,
    30000,
  );

  const refreshAll = () => {
    setAnchor(Date.now());
    overview.refresh();
    latest.refresh();
    alerts.refresh();
    health.refresh();
    history.refresh();
    predictions.refresh();
  };

  const observations = latest.data?.items ?? [];
  const waves = observations.map((item) => item.parameters.wave_height_m);
  const averageWave = waves.length ? waves.reduce((a, b) => a + b, 0) / waves.length : null;
  const minWave = waves.length ? Math.min(...waves) : null;
  const maxWave = waves.length ? Math.max(...waves) : null;
  const freshest = observations.length
    ? Math.min(...observations.map((item) => item.data_age_seconds))
    : null;

  const prediction = overview.data?.latest_prediction ?? null;
  const alertCounts = overview.data?.alert_counts ?? {};
  const satellite = (overview.data?.satellite ?? {}) as {
    dataset_count?: number;
    latest_acquired_at?: string;
    source_status?: string;
  };
  const sources = overview.data?.data_freshness.sources ?? [];
  const zones = overview.data?.zones ?? [];

  const riskByZone = useMemo(() => {
    const map = new Map<string, Prediction>();
    for (const row of predictions.data ?? []) {
      if (row.zone_code && !map.has(row.zone_code)) map.set(row.zone_code, row);
    }
    return map;
  }, [predictions.data]);

  const seriesByZone = useMemo(() => {
    const map = new Map<string, number[]>();
    const rows = [...(history.data?.items ?? [])].reverse();
    for (const row of rows) {
      if (!row.zone_code || row.validation_status !== "valid") continue;
      const bucket = map.get(row.zone_code) ?? [];
      bucket.push(row.parameters.wave_height_m);
      map.set(row.zone_code, bucket);
    }
    return map;
  }, [history.data]);

  const chartPoints = useMemo<SeaPoint[]>(() => {
    const rows = (history.data?.items ?? []).filter((row) => row.validation_status === "valid");
    if (chartZone !== "ALL") {
      return rows
        .filter((row) => row.zone_code === chartZone)
        .map((row) => ({
          time: new Date(row.observed_at).getTime(),
          height: row.parameters.wave_height_m,
          wind: row.parameters.wind_speed_mps,
        }));
    }
    const buckets = new Map<number, { heights: number[]; winds: number[] }>();
    for (const row of rows) {
      const bucketTime = Math.floor(new Date(row.observed_at).getTime() / 60_000) * 60_000;
      const bucket = buckets.get(bucketTime) ?? { heights: [], winds: [] };
      bucket.heights.push(row.parameters.wave_height_m);
      bucket.winds.push(row.parameters.wind_speed_mps);
      buckets.set(bucketTime, bucket);
    }
    return [...buckets.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([time, bucket]) => ({
        time,
        height: bucket.heights.reduce((sum, value) => sum + value, 0) / bucket.heights.length,
        wind: bucket.winds.reduce((sum, value) => sum + value, 0) / bucket.winds.length,
      }));
  }, [history.data, chartZone]);

  const observationByZone = useMemo(() => {
    const map = new Map<string, Observation>();
    for (const item of observations) {
      if (item.zone_code) map.set(item.zone_code, item);
    }
    return map;
  }, [observations]);

  const calibration = health.data?.model.calibration as
    | { target_false_alarm_rate?: number }
    | undefined;

  return (
    <>
      <PageHero
        eyebrow="Operasi"
        title="Ringkasan pesisir"
        description="Tiga zona terpantau. Telemetri buoy tervalidasi, metadata Copernicus terverifikasi, dan penyaringan anomali terkalibrasi — tetap dapat ditelusuri dari awal hingga akhir."
        right={
          <>
            <StatusPill tone={latest.data?.stale ? "warn" : "ok"}>
              {latest.data?.stale ? "Umpan usang" : "Umpan terkini"}
            </StatusPill>
            <span className="flex items-center gap-1.5 text-[10.5px] text-muted">
              <Clock3 className="h-3 w-3" aria-hidden />
              Terbaru {formatAge(freshest)}
            </span>
            <button type="button" onClick={refreshAll} className="btn btn-ghost btn-sm">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Segarkan
            </button>
          </>
        }
      />

      <Link
        href="/cek"
        className="mb-4 flex flex-col gap-3 rounded-[14px] border border-sea/25 bg-sea-soft/60 p-4 transition-colors hover:bg-sea-soft sm:flex-row sm:items-center sm:justify-between"
      >
        <span className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sea-deep text-white">
            <LifeBuoy className="h-4 w-4" aria-hidden />
          </span>
          <span>
            <span className="block text-[12.5px] font-semibold text-ink">Mau ke laut hari ini?</span>
            <span className="mt-0.5 block text-[11px] leading-relaxed text-muted">
              Cek kondisi Teluk Jakarta, Semarang, atau Makassar dalam 10 detik — tanpa istilah teknis.
            </span>
          </span>
        </span>
        <span className="btn btn-primary btn-sm shrink-0 self-start sm:self-auto">
          Cek sekarang <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </span>
      </Link>

      <div className="mb-5 flex flex-col gap-2 border-y border-line py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-muted">
          <span className="mt-[3px] shrink-0 text-[9.5px] font-semibold text-signal-dark">Ringkasan</span>
          <span>
            Nilai buoy berasal dari telemetri lapangan dengan status sumber; rekaman satelit adalah akuisisi historis
            Copernicus; keluaran AI diturunkan dari model analitik.
          </span>
        </p>
        <Link href="/sources" className="shrink-0 text-[11px] font-medium text-ink underline underline-offset-4">
          Rantai data
        </Link>
      </div>

      {overview.error ? (
        <ErrorState message={overview.error} onRetry={refreshAll} />
      ) : (
        <div className="card grid grid-cols-2 divide-line lg:grid-cols-5 lg:divide-x">
          <Stat
            label="Situs buoy"
            value={health.data ? String(health.data.counts.buoy_devices) : "3"}
            unit="perangkat"
            note={`${health.data?.counts.coastal_zones ?? 3} zona · terpantau`}
          />
          <Stat
            label="Rata-rata tinggi gelombang"
            value={fixed(averageWave, 2)}
            unit="m"
            note={
              minWave !== null && maxWave !== null
                ? `Rentang ${fixed(minWave, 2)}–${fixed(maxWave, 2)} m`
                : "Menunggu pembacaan"
            }
          />
          <Stat
            label="Peringatan terbuka"
            value={String(alertCounts.open ?? 0)}
            unit="terbuka"
            note={`${alertCounts.high ?? 0} total tingkat tinggi`}
          />
          <Stat
            label="Rekaman Sentinel-2"
            value={String(satellite.dataset_count ?? 0)}
            unit="tersimpan"
            note={
              satellite.latest_acquired_at
                ? `Terbaru ${formatShortWib(satellite.latest_acquired_at)} WIB`
                : "Belum ada akuisisi tersimpan"
            }
          />
          <Stat
            label="Rasio penandaan jendela normal"
            value={
              calibration?.target_false_alarm_rate !== undefined
                ? String(Math.round(calibration.target_false_alarm_rate * 100))
                : "10"
            }
            unit="%"
            note={health.data?.model.version ?? "model tidak tersedia"}
          />
        </div>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <section className="card overflow-hidden xl:col-span-2">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <h2 className="text-[14px] font-semibold tracking-[-0.02em]">Kondisi laut</h2>
              <p className="mt-0.5 text-[10.5px] text-muted">
                {chartZone === "ALL"
                  ? "Rata-rata semua zona"
                  : zones.find((zone) => zone.zone_code === chartZone)?.zone_name ?? chartZone}{" "}
                · tinggi gelombang (m) dan angin (m/s) · WIB
              </p>
            </div>
            <div className="flex items-center gap-4">
              <select
                className="h-8 rounded-[7px] border border-line bg-transparent px-2 text-[11px] text-ink-soft outline-none focus:border-sea"
                value={chartZone}
                onChange={(event) => setChartZone(event.target.value)}
                aria-label="Cakupan grafik"
              >
                <option value="ALL">Semua zona, rata-rata</option>
                {zones.map((zone) => (
                  <option key={zone.zone_code} value={zone.zone_code}>
                    {zone.zone_name}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-1">
                {WINDOWS.map((window) => (
                  <button
                    key={window.hours}
                    type="button"
                    onClick={() => setHours(window.hours)}
                    className={cn(
                      "border-b px-1.5 pb-1 text-[11px] font-medium transition-colors",
                      hours === window.hours
                        ? "border-signal text-ink"
                        : "border-transparent text-muted hover:text-ink",
                    )}
                    aria-pressed={hours === window.hours}
                  >
                    {window.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="px-3 pb-1 pt-4 sm:px-4">
            {history.loading && !history.data ? (
              <SkeletonBlock className="h-[300px] w-full" />
            ) : (
              <SeaStateChart points={chartPoints} height={300} />
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3">
            <span className="flex items-center gap-4 text-[10px] text-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-[2px] w-4 bg-signal" aria-hidden /> Tinggi gelombang, m
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-[2px] w-4 border-t border-dashed border-sea" aria-hidden /> Angin, m/s
              </span>
            </span>
            <span className="flex items-center gap-3">
              <SourceBadge kind="simulated" />
              <Link href="/ocean" className="inline-flex items-center gap-1 text-[10.5px] font-medium text-ink">
                Konsol laut <ArrowUpRight className="h-3 w-3" aria-hidden />
              </Link>
            </span>
          </div>
        </section>

        <section className="card flex flex-col overflow-hidden">
          <div className="flex items-baseline justify-between border-b border-line px-5 py-4">
            <div>
              <h2 className="text-[14px] font-semibold tracking-[-0.02em]">Status zona</h2>
              <p className="mt-0.5 text-[10.5px] text-muted">Pembacaan valid terbaru per situs</p>
            </div>
            <span className="font-mono text-[10px] text-muted">{zones.length} zona</span>
          </div>

          <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 border-b border-line px-5 py-2 text-[9.5px] text-muted">
            <span>Zona</span>
            <span className="text-right">Gelombang</span>
            <span className="w-[58px] text-right">Risiko</span>
          </div>

          <div className="flex-1 divide-y divide-line">
            {zones.map((zone) => {
              const observation = observationByZone.get(zone.zone_code);
              const series = (seriesByZone.get(zone.zone_code) ?? []).slice(-40);
              const risk = riskByZone.get(zone.zone_code)?.risk_level ?? null;
              return (
                <Link
                  key={zone.id}
                  href={`/ocean?zone=${zone.zone_code}`}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 px-5 py-3 transition-colors hover:bg-paper"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[11.5px] font-medium">{zone.zone_name}</p>
                    <p className="mt-0.5 flex items-center gap-2 text-[9.5px] text-muted">
                      <span className="font-mono">{zone.zone_code}</span>
                      <span className="h-2 w-px bg-line-strong" aria-hidden />
                      {formatAge(observation?.data_age_seconds)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {series.length > 1 ? (
                      <Sparkline values={series} width={56} height={18} tone="sea" showArea={false} strokeWidth={1.4} />
                    ) : null}
                    <p className="metric min-w-[54px] text-right text-[12px] font-medium">
                      {fixed(observation?.parameters.wave_height_m, 2)}
                      <span className="ml-0.5 text-[9px] font-normal text-muted">m</span>
                    </p>
                  </div>
                  <div className="w-[58px] text-right">
                    {risk ? (
                      <RiskBadge level={risk} />
                    ) : (
                      <span className="text-[9.5px] text-muted">belum dijalankan</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="border-t border-line px-5 py-3">
            <Link href="/satellite" className="inline-flex items-center gap-1 text-[10.5px] font-medium text-ink">
              Konteks satelit <ArrowUpRight className="h-3 w-3" aria-hidden />
            </Link>
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <section className="card overflow-hidden xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
            <div>
              <h2 className="text-[14px] font-semibold tracking-[-0.02em]">Penyaringan risiko AI</h2>
              <p className="mt-0.5 text-[10.5px] text-muted">
                Isolation Forest pada data NOAA NDBC · rubrik risiko v1
              </p>
            </div>
            <div className="flex items-center gap-3">
              <SourceBadge kind="model" />
              <Link href="/ai" className="text-[10.5px] font-medium text-ink underline underline-offset-4">
                Ruang kerja
              </Link>
            </div>
          </div>

          {prediction ? (
            <div className="grid gap-6 p-5 sm:grid-cols-[1fr_1.15fr]">
              <div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <RiskBadge level={prediction.risk_level} />
                  <span className="text-[9.5px] font-medium text-muted">
                    eksekusi terbaru · {prediction.zone_code} · {formatShortWib(prediction.created_at)} WIB
                  </span>
                </div>

                <div className="mt-4 flex items-end justify-between gap-2">
                  <p className="metric text-[40px] font-medium leading-none">
                    {fixed(prediction.anomaly_score, 2)}
                  </p>
                  <p className="text-right text-[10px] leading-snug text-muted">
                    indeks anomali
                    <br />
                    ambang {fixed(prediction.anomaly_threshold, 2)}
                  </p>
                </div>
                <div className="relative mt-3 h-[5px] rounded-full bg-line">
                  <div
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-full",
                      prediction.anomaly_detected ? "bg-signal" : "bg-sea",
                    )}
                    style={{ width: `${Math.min(100, prediction.anomaly_score * 100)}%` }}
                  />
                  <span
                    className="absolute -top-[3px] h-[11px] w-px bg-ink"
                    style={{ left: `${Math.min(100, prediction.anomaly_threshold * 100)}%` }}
                    aria-hidden
                  />
                </div>
                <div className="mt-1 flex justify-between font-mono text-[9px] text-muted">
                  <span>0.00</span>
                  <span>ambang terkalibrasi</span>
                  <span>1.00</span>
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-x-4 border-t border-line pt-3">
                  <div>
                    <dt className="text-[9.5px] text-muted">Skor rubrik</dt>
                    <dd className="metric mt-0.5 text-[13px] font-medium">
                      {fixed(prediction.risk_score, 1)}
                      <span className="text-[9px] font-normal text-muted"> /100</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[9.5px] text-muted">Observasi</dt>
                    <dd className="metric mt-0.5 text-[13px] font-medium">
                      {prediction.input_observation_count}
                    </dd>
                  </div>
                </dl>

                <p className="mt-4 border-l-2 border-l-signal pl-3 text-[10.5px] leading-relaxed text-muted">
                  Saran operasional berdasarkan rubrik risiko zona.
                </p>
              </div>

              <div>
                <p className="text-[9.5px] font-semibold text-muted">
                  Faktor kontributor
                </p>
                <ul className="mt-2 divide-y divide-line">
                  {prediction.contributing_factors.slice(0, 3).map((factor) => (
                    <li key={factor.feature} className="py-2">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[11px] text-ink-soft">{factor.label}</span>
                        <span className="metric text-[10.5px] text-ink">
                          {fixed(factor.value, 2)} {factor.unit}
                          <span className="ml-2 text-[9.5px] text-muted">
                            {factor.deviation_sigma > 0 ? "+" : ""}
                            {fixed(factor.deviation_sigma, 1)}σ
                          </span>
                        </span>
                      </div>
                      <div className="mt-1.5 h-[2px] bg-line">
                        <div
                          className={cn(
                            "h-full",
                            factor.deviation_sigma >= 0 ? "bg-signal" : "bg-sea",
                          )}
                          style={{ width: `${Math.min(Math.abs(factor.deviation_sigma) * 18, 100)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                  {prediction.contributing_factors.length === 0 ? (
                    <li className="py-2 text-[11px] text-muted">Tidak ada faktor yang melewati ambang pelaporan.</li>
                  ) : null}
                </ul>
                <p className="mt-3 line-clamp-3 text-[10.5px] leading-relaxed text-muted">
                  {prediction.explanation}
                </p>
                <Link href="/ai" className="mt-3 inline-flex items-center gap-1 text-[10.5px] font-medium text-ink">
                  Analisis lengkap <ArrowUpRight className="h-3 w-3" aria-hidden />
                </Link>
              </div>
            </div>
          ) : (
            <div className="p-5">
              <EmptyState
                title="Belum ada analisis"
                description="Saring jendela terbaru untuk melihat skor anomali, rubrik, dan faktor kontributor."
                action={
                  <Link href="/ai" className="btn btn-primary btn-sm">
                    Jalankan analisis
                  </Link>
                }
              />
            </div>
          )}
        </section>

        <section className="card flex flex-col overflow-hidden">
          <div className="flex items-baseline justify-between border-b border-line px-5 py-4">
            <div>
              <h2 className="text-[14px] font-semibold tracking-[-0.02em]">Antrean peringatan</h2>
              <p className="mt-0.5 text-[10.5px] text-muted">
                {alertCounts.open ?? 0} terbuka · {alertCounts.acknowledged ?? 0} diakui
              </p>
            </div>
            <Link href="/alerts" className="text-[10.5px] font-medium text-ink underline underline-offset-4">
              Semua
            </Link>
          </div>

          <div>
            {alerts.loading && !alerts.data ? (
              <div className="space-y-2 p-4">
                <SkeletonBlock className="h-10 w-full" />
                <SkeletonBlock className="h-10 w-full" />
              </div>
            ) : alerts.data && alerts.data.items.length > 0 ? (
              <ul className="divide-y divide-line">
                {alerts.data.items.slice(0, 4).map((alert) => (
                  <li key={alert.id}>
                    <Link href="/alerts" className="block px-5 py-3 transition-colors hover:bg-paper">
                      <div className="flex items-center justify-between gap-3">
                        <SeverityBadge severity={alert.severity} />
                        <span className="font-mono text-[9px] text-muted">
                          {formatShortWib(alert.created_at)} WIB
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-1 text-[11px] font-medium">{alert.title}</p>
                      <p className="mt-0.5 text-[9.5px] text-muted">
                        {alert.zone_code} · {enumLabel(alert.status)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-5">
                <p className="flex items-center gap-1.5 text-[11px] font-medium text-ink">
                  <ShieldCheck className="h-3.5 w-3.5 text-sea" aria-hidden /> Tidak ada peringatan aktif
                </p>
                <p className="mt-1 text-[10.5px] leading-relaxed text-muted">
                  Peringatan terbuka hanya saat rubrik mencapai sedang atau tinggi.
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-line px-5 py-2.5 text-[9.5px] text-muted">
            Saran operasional berdasarkan rubrik risiko zona.
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        <section className="card overflow-hidden">
          <div className="flex items-baseline justify-between border-b border-line px-5 py-4">
            <div>
              <h2 className="text-[14px] font-semibold tracking-[-0.02em]">Kesegaran sumber</h2>
              <p className="mt-0.5 text-[10.5px] text-muted">Terakhir teramati dan diterima, dari database</p>
            </div>
            <Link href="/sources" className="text-[10.5px] font-medium text-ink underline underline-offset-4">
              Detail
            </Link>
          </div>
          <div className="divide-y divide-line">
            {sources.slice(0, 4).map((source) => (
              <div key={source.source_name} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      statusTone(source.status) === "ok"
                        ? "bg-ok"
                        : statusTone(source.status) === "warn"
                          ? "bg-amber"
                          : statusTone(source.status) === "bad"
                            ? "bg-signal"
                            : "bg-muted/50",
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-medium">
                      {String(source.metadata?.label ?? source.source_name)}
                    </p>
                    <p className="text-[9px] text-muted">{enumLabel(source.source_type)}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <span className="font-mono text-[9.5px] text-muted">{formatAge(source.age_seconds)}</span>
                  <span
                    className={cn(
                      "w-[74px] text-right text-[9.5px] font-medium ",
                      statusTone(source.status) === "warn"
                        ? "text-amber"
                        : statusTone(source.status) === "bad"
                          ? "text-signal-dark"
                          : "text-ink-soft",
                    )}
                  >
                    {source.status.replaceAll("_", " ")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[14px] font-semibold tracking-[-0.02em]">Gateway telemetri</h2>
              <p className="mt-0.5 text-[10.5px] text-muted">Sumber telemetri buoy</p>
            </div>
            <StatusPill tone={overview.data?.simulator.running ? "ok" : "neutral"}>
              {overview.data?.simulator.running ? "Berjalan" : "Menganggur"}
            </StatusPill>
          </div>

          <dl className="mt-4 grid grid-cols-3 divide-x divide-line">
            {[
              ["Interval", `${overview.data?.simulator.interval_seconds ?? 60}s`],
              ["Dihasilkan", String(overview.data?.simulator.observations_generated ?? 0)],
              [
                "Pembaruan terakhir",
                overview.data?.simulator.last_tick_at
                  ? formatShortWib(overview.data.simulator.last_tick_at)
                  : "—",
              ],
            ].map(([label, value]) => (
              <div key={label} className="px-3 first:pl-0 last:pr-0">
                <dt className="text-[9px] text-muted">{label}</dt>
                <dd className="metric mt-1 text-[12px] font-medium">{value}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-4 text-[10.5px] leading-relaxed text-muted">
            Picu pemutaran ulang badai untuk menguji penerimaan data, validasi, analitik, dan alur
            peringatan. Nilai yang dihasilkan dilengkapi status sumber dan tercatat pada jejak data.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/ocean#simulator" className="btn btn-dark btn-sm">
              <Radar className="h-3.5 w-3.5" aria-hidden /> Buka simulator
            </Link>
            <Link href="/alerts" className="btn btn-ghost btn-sm">
              <BellRing className="h-3.5 w-3.5" aria-hidden /> Peringatan
            </Link>
          </div>
        </section>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3 text-[9.5px] text-muted">
        <span className="flex items-center gap-1.5">
          <Database className="h-3 w-3" aria-hidden /> Semua nilai dari API
        </span>
        <SourceBadge kind="simulated" />
        <SourceBadge kind="satellite" />
        <SourceBadge kind="model" />
        <span className="ml-auto font-mono">diperbarui {formatWib(overview.data?.generated_at)}</span>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  unit,
  note,
}: {
  label: string;
  value: string;
  unit: string;
  note: string;
}) {
  return (
    <div className="px-5 py-4">
      <p className="text-[10px] text-muted">{label}</p>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="metric text-[27px] font-medium leading-none">{value}</span>
        {unit ? <span className="text-[10.5px] text-muted">{unit}</span> : null}
      </p>
      <p className="mt-1.5 truncate text-[9.5px] text-muted" title={note}>
        {note}
      </p>
    </div>
  );
}

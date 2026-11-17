"use client";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BellRing,
  BrainCircuit,
  Clock3,
  Database,
  Info,
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
import { cn, fixed, formatAge, formatShortUtc, formatUtc, statusTone } from "@/lib/format";
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
    // Averaging by minute avoids interleaving three independent buoy series into
    // one jagged line. Per-zone detail is available in the zone console.
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

  const riskByZone = useMemo(() => {
    const map = new Map<string, Prediction>();
    for (const row of predictions.data ?? []) {
      if (row.zone_code && !map.has(row.zone_code)) map.set(row.zone_code, row);
    }
    return map;
  }, [predictions.data]);

  const observationByZone = useMemo(() => {
    const map = new Map<string, Observation>();
    for (const item of observations) {
      if (item.zone_code) map.set(item.zone_code, item);
    }
    return map;
  }, [observations]);

  return (
    <>
      <PageHero
        eyebrow="Operations dashboard"
        title="Coastal overview"
        description="Three monitored zones, one traceable data chain: validated synthetic buoy telemetry, verified Copernicus Sentinel-2 metadata, calibrated anomaly screening and a transparent risk rubric."
        right={
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={latest.data?.stale ? "warn" : "ok"}>
              {latest.data?.stale ? "Feed stale" : "Feed current"}
            </StatusPill>
            <span className="chip">
              <Clock3 className="h-3 w-3" aria-hidden /> Newest {formatAge(freshest)}
            </span>
            <button type="button" onClick={refreshAll} className="btn btn-primary btn-sm">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Refresh
            </button>
          </div>
        }
      />

      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-line bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-[11.5px] leading-relaxed text-muted">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sea" aria-hidden />
          <span>
            <strong className="text-ink">Prototype decision support.</strong> Buoy values are simulated and
            labelled; satellite records are real historical acquisitions; AI output is model-derived. This
            is not an official BMKG/BPBD warning.
          </span>
        </p>
        <Link href="/sources" className="shrink-0 text-[11px] font-extrabold text-signal">
          How the chain works →
        </Link>
      </div>

      {overview.error ? (
        <ErrorState message={overview.error} onRetry={refreshAll} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard
            icon={Waves}
            label="Buoy sites"
            value={health.data ? String(health.data.counts.buoy_devices) : "—"}
            unit={health.data ? `${health.data.counts.coastal_zones} zones` : "zones"}
            note="Virtual devices · simulated"
            live
          />
          <KpiCard
            icon={Activity}
            label="Mean wave height"
            value={fixed(averageWave, 2)}
            unit="m"
            note={
              minWave !== null && maxWave !== null
                ? `Range ${fixed(minWave, 2)}–${fixed(maxWave, 2)} m`
                : "Awaiting readings"
            }
          />
          <KpiCard
            icon={BellRing}
            label="Open alerts"
            value={String(alertCounts.open ?? 0)}
            unit="open"
            note={`${alertCounts.high ?? 0} high severity overall · prototype`}
            tone={(alertCounts.open ?? 0) > 0 ? "warn" : "ok"}
          />
          <KpiCard
            icon={Satellite}
            label="Sentinel-2 records"
            value={String(satellite.dataset_count ?? 0)}
            unit="cached"
            note={
              satellite.latest_acquired_at
                ? `Latest ${formatShortUtc(satellite.latest_acquired_at)} UTC`
                : "No acquisition stored"
            }
          />
          <KpiCard
            icon={BrainCircuit}
            label="Anomaly model"
            value={health.data?.model.available ? "IForest" : "Offline"}
            unit=""
            note={
              health.data?.model.available
                ? `${health.data.model.version ?? ""} · 10% calibrated flag rate`
                : health.data?.model.reason ?? "Model unavailable"
            }
            tone={health.data?.model.available ? "ok" : "warn"}
          />
        </div>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <section className="card overflow-hidden xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <h2 className="text-[14px] font-extrabold tracking-[-0.02em]">Sea state</h2>
              <p className="mt-0.5 text-[10.5px] text-muted">
                {chartZone === "ALL"
                  ? "Mean of all zones"
                  : zones.find((zone) => zone.zone_code === chartZone)?.zone_name ?? chartZone}{" "}
                · wave height (m) and wind (m/s) · UTC · simulated
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="rounded-full border border-line bg-white px-2.5 py-1.5 text-[10px] font-bold text-muted"
                value={chartZone}
                onChange={(event) => setChartZone(event.target.value)}
                aria-label="Chart scope"
              >
                <option value="ALL">All zones · mean</option>
                {zones.map((zone) => (
                  <option key={zone.zone_code} value={zone.zone_code}>
                    {zone.zone_name}
                  </option>
                ))}
              </select>
              <div className="flex rounded-full border border-line bg-white p-0.5">
                {WINDOWS.map((window) => (
                  <button
                    key={window.hours}
                    type="button"
                    onClick={() => setHours(window.hours)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[10px] font-bold transition",
                      hours === window.hours ? "bg-ink text-white" : "text-muted hover:text-ink",
                    )}
                    aria-pressed={hours === window.hours}
                  >
                    {window.label}
                  </button>
                ))}
              </div>
              <SourceBadge kind="simulated" />
            </div>
          </div>
          <div className="px-3 pb-2 pt-4 sm:px-4">
            {history.loading && !history.data ? (
              <SkeletonBlock className="h-[280px] w-full" />
            ) : (
              <SeaStateChart points={chartPoints} height={282} />
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3 text-[10px] text-muted">
            <span className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-signal" aria-hidden /> Wave height (m)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-sea" aria-hidden /> Wind (m/s)
              </span>
            </span>
            <Link href="/ocean" className="inline-flex items-center gap-1 font-bold text-signal">
              Ocean console <ArrowUpRight className="h-3 w-3" aria-hidden />
            </Link>
          </div>
        </section>

        <section className="card flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <h2 className="text-[14px] font-extrabold tracking-[-0.02em]">Zone status</h2>
              <p className="mt-0.5 text-[10.5px] text-muted">Latest valid reading per site</p>
            </div>
            <span className="chip">{zones.length} zones</span>
          </div>
          <div className="flex-1 divide-y divide-line px-2">
            {zones.map((zone) => {
              const observation = observationByZone.get(zone.zone_code);
              const series = (seriesByZone.get(zone.zone_code) ?? []).slice(-40);
              const zoneRisk = riskByZone.get(zone.zone_code)?.risk_level ?? null;
              return (
                <Link
                  key={zone.id}
                  href={`/ocean?zone=${zone.zone_code}`}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-paper"
                >
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      zoneRisk === "high"
                        ? "bg-signal"
                        : zoneRisk === "moderate"
                          ? "bg-amber"
                          : "bg-ok",
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-bold">{zone.zone_name}</p>
                    <p className="text-[9.5px] text-muted">
                      {zone.zone_code} · {formatAge(observation?.data_age_seconds)}
                    </p>
                  </div>
                  {series.length > 1 ? (
                    <Sparkline values={series} width={64} height={22} tone="sea" showArea={false} />
                  ) : null}
                  <div className="shrink-0 text-right">
                    <p className="metric text-[14px] font-semibold leading-none">
                      {fixed(observation?.parameters.wave_height_m, 2)}
                      <span className="ml-0.5 text-[9px] font-normal text-muted">m</span>
                    </p>
                    <p className="mt-1 text-[8.5px] uppercase tracking-[0.06em] text-muted">
                      {zoneRisk ? `risk ${zoneRisk}` : "not screened"}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="border-t border-line px-5 py-3">
            <Link href="/satellite" className="inline-flex items-center gap-1 text-[10.5px] font-bold text-signal">
              Open satellite context <ArrowUpRight className="h-3 w-3" aria-hidden />
            </Link>
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-3">
        <section className="card overflow-hidden xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-signal-soft text-signal">
                <BrainCircuit className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <h2 className="text-[14px] font-extrabold tracking-[-0.02em]">AI risk screening</h2>
                <p className="text-[10.5px] text-muted">
                  Isolation Forest on real NDBC data · transparent rubric
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <SourceBadge kind="model" />
              <Link href="/ai" className="text-[10.5px] font-bold text-signal">
                Workspace →
              </Link>
            </div>
          </div>

          {prediction ? (
            <div className="grid gap-5 p-5 sm:grid-cols-[1fr_1.2fr]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <RiskBadge level={prediction.risk_level} />
                  <span className="chip">latest run · {prediction.zone_code}</span>
                </div>
                <div className="mt-4 flex items-end justify-between gap-2">
                  <div>
                    <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-muted">
                      Anomaly index
                    </p>
                    <p className="metric mt-1 text-[38px] font-semibold leading-none">
                      {fixed(prediction.anomaly_score, 2)}
                    </p>
                  </div>
                  <p className="metric text-[10px] text-muted">
                    threshold {fixed(prediction.anomaly_threshold, 2)}
                  </p>
                </div>
                <div className="mt-3 h-2 rounded-full bg-line">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      prediction.anomaly_detected ? "bg-signal" : "bg-sea",
                    )}
                    style={{ width: `${Math.min(100, prediction.anomaly_score * 100)}%` }}
                  />
                </div>
                <div className="mt-4 flex items-center justify-between text-[10px] text-muted">
                  <span>Risk score {fixed(prediction.risk_score, 1)}/100</span>
                  <span>{prediction.input_observation_count} observations</span>
                </div>
                <div className="mt-4 rounded-xl border border-amber/20 bg-amber-soft/60 px-3 py-2.5 text-[10.5px] leading-relaxed text-amber">
                  Prototype advisory only. Verify conditions with BMKG/BPBD before any operational action.
                </div>
              </div>

              <div>
                <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-muted">
                  Top contributing factors
                </p>
                <ul className="mt-2 space-y-2">
                  {prediction.contributing_factors.slice(0, 3).map((factor) => (
                    <li key={factor.feature} className="rounded-xl border border-line bg-paper/50 px-3 py-2">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[11px] font-semibold text-ink-soft">{factor.label}</span>
                        <span className="metric text-[10.5px] text-ink">
                          {fixed(factor.value, 2)} {factor.unit}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1 rounded-full bg-line">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            factor.deviation_sigma >= 0 ? "bg-signal" : "bg-sea",
                          )}
                          style={{
                            width: `${Math.min(Math.abs(factor.deviation_sigma) * 22, 100)}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                  {prediction.contributing_factors.length === 0 ? (
                    <li className="text-[11px] text-muted">No factor exceeded the reporting band.</li>
                  ) : null}
                </ul>
                <p className="mt-3 line-clamp-3 text-[11px] leading-relaxed text-muted">
                  {prediction.explanation}
                </p>
                <Link href="/ai" className="mt-3 inline-flex items-center gap-1 text-[10.5px] font-bold text-signal">
                  Read full analysis <ArrowRight className="h-3 w-3" aria-hidden />
                </Link>
              </div>
            </div>
          ) : (
            <div className="p-5">
              <EmptyState
                title="No analysis has been run yet"
                description="Screen the latest window to see the anomaly score, risk rubric and contributing factors."
                action={
                  <Link href="/ai" className="btn btn-primary btn-sm">
                    Run AI analysis
                  </Link>
                }
              />
            </div>
          )}
        </section>

        <section className="card flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <h2 className="text-[14px] font-extrabold tracking-[-0.02em]">Alert queue</h2>
              <p className="mt-0.5 text-[10.5px] text-muted">
                {alertCounts.open ?? 0} open · {alertCounts.acknowledged ?? 0} acknowledged
              </p>
            </div>
            <Link href="/alerts" className="text-[10.5px] font-bold text-signal">
              All →
            </Link>
          </div>

          <div className="flex-1 divide-y divide-line">
            {alerts.loading && !alerts.data ? (
              <div className="space-y-2 p-4">
                <SkeletonBlock className="h-12 w-full" />
                <SkeletonBlock className="h-12 w-full" />
              </div>
            ) : alerts.data && alerts.data.items.length > 0 ? (
              alerts.data.items.slice(0, 4).map((alert) => (
                <Link
                  key={alert.id}
                  href="/alerts"
                  className="flex items-start gap-2.5 px-4 py-3 transition hover:bg-paper"
                >
                  <span className="mt-0.5">
                    <SeverityBadge severity={alert.severity} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[11.5px] font-bold">{alert.title}</p>
                    <p className="mt-0.5 text-[9.5px] text-muted">
                      {alert.zone_code} · {formatShortUtc(alert.created_at)} UTC · {alert.status}
                    </p>
                  </div>
                </Link>
              ))
            ) : (
              <div className="p-5">
                <p className="flex items-center gap-1.5 text-[11px] font-bold text-ink">
                  <ShieldCheck className="h-3.5 w-3.5 text-ok" aria-hidden /> No prototype alerts
                </p>
                <p className="mt-1 text-[10.5px] leading-relaxed text-muted">
                  Alerts open only when the rubric reaches moderate or high. All clear in the current
                  database.
                </p>
              </div>
            )}
          </div>

          <div className="border-t border-line px-5 py-3 text-[10px] text-muted">
            Alerts are prototype advisories, not official warnings.
          </div>
        </section>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <h2 className="text-[14px] font-extrabold tracking-[-0.02em]">Data sources</h2>
              <p className="mt-0.5 text-[10.5px] text-muted">Freshness and status from the database</p>
            </div>
            <Link href="/sources" className="text-[10.5px] font-bold text-signal">
              Details →
            </Link>
          </div>
          <div className="divide-y divide-line">
            {sources.slice(0, 4).map((source) => (
              <div key={source.source_name} className="flex items-center justify-between gap-3 px-5 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-semibold">
                    {String(source.metadata?.label ?? source.source_name)}
                  </p>
                  <p className="text-[9px] text-muted">{source.source_type}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-[9.5px] text-muted">{formatAge(source.age_seconds)}</span>
                  <StatusPill tone={statusTone(source.status)}>{source.status}</StatusPill>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="card p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-sea-soft text-sea">
                <Radar className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <h2 className="text-[14px] font-extrabold tracking-[-0.02em]">Buoy simulator</h2>
                <p className="text-[10.5px] text-muted">Synthetic telemetry generator</p>
              </div>
            </div>
            <StatusPill tone={overview.data?.simulator.running ? "ok" : "neutral"}>
              {overview.data?.simulator.running ? "Auto running" : "Idle"}
            </StatusPill>
          </div>

          <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
            {[
              ["Interval", `${overview.data?.simulator.interval_seconds ?? 60}s`],
              ["Generated", String(overview.data?.simulator.observations_generated ?? 0)],
              [
                "Last tick",
                overview.data?.simulator.last_tick_at
                  ? formatShortUtc(overview.data.simulator.last_tick_at)
                  : "—",
              ],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-paper px-2 py-2.5">
                <dt className="text-[8.5px] font-extrabold uppercase tracking-[0.1em] text-muted">{label}</dt>
                <dd className="metric mt-1 text-[12px] font-semibold">{value}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-3 text-[10.5px] leading-relaxed text-muted">
            Trigger a manual storm scenario to exercise validation, storage, analytics and the alert
            workflow end to end. Every generated value is labelled simulated.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/ocean#simulator" className="btn btn-dark btn-sm">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Open simulator
            </Link>
            <Link href="/alerts" className="btn btn-ghost btn-sm">
              <BellRing className="h-3.5 w-3.5" aria-hidden /> Alert workflow
            </Link>
          </div>
        </section>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-white px-4 py-3 text-[10px] text-muted">
        <Database className="h-3.5 w-3.5 text-line-strong" aria-hidden />
        <span>All values on this page come from the API.</span>
        <SourceBadge kind="simulated" />
        <SourceBadge kind="satellite" />
        <SourceBadge kind="model" />
        <span className="ml-auto">Last refreshed {formatUtc(overview.data?.generated_at)}</span>
      </div>
    </>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  unit,
  note,
  tone = "neutral",
  live = false,
}: {
  icon: typeof Waves;
  label: string;
  value: string;
  unit: string;
  note: string;
  tone?: "ok" | "warn" | "neutral";
  live?: boolean;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[9px] font-extrabold uppercase leading-snug tracking-[0.11em] text-muted">
          {label}
        </p>
        <span
          className={cn(
            "grid h-7 w-7 shrink-0 place-items-center rounded-full",
            tone === "warn"
              ? "bg-amber-soft text-amber"
              : tone === "ok"
                ? "bg-ok-soft text-ok"
                : "bg-paper text-sea",
          )}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
      </div>
      <p className="mt-3 flex flex-wrap items-baseline gap-x-1.5">
        <span className="metric text-[22px] font-semibold leading-none">{value}</span>
        {unit ? <span className="text-[10px] font-semibold text-muted">{unit}</span> : null}
        {live ? (
          <span className="ml-1 inline-flex items-center gap-1 text-[8.5px] font-bold uppercase tracking-[0.06em] text-signal">
            <span className="h-1 w-1 animate-pulse rounded-full bg-signal" aria-hidden /> live
          </span>
        ) : null}
      </p>
      <p className="mt-2 text-[9.5px] leading-snug text-muted">{note}</p>
    </div>
  );
}

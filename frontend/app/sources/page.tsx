"use client";

import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BrainCircuit,
  Database,
  ExternalLink,
  KeyRound,
  Radio,
  Satellite,
} from "lucide-react";
import Link from "next/link";

import { CaveatNote, ErrorState, PageHero, SourceBadge, StatusPill } from "@/components/ui";
import { API_BASE_URL } from "@/lib/api";
import { cn, fixed, formatAge, formatShortUtc, formatUtc, statusTone } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { DataSourcesResponse, SatelliteProviderInfo, SystemHealth } from "@/lib/types";

const ENDPOINTS = [
  { method: "GET", path: "/buoy/latest", auth: false, purpose: "Latest valid observation per buoy" },
  { method: "GET", path: "/buoy/history", auth: false, purpose: "Filtered, paginated observations" },
  { method: "POST", path: "/ingestion/buoy", auth: true, purpose: "Validated ingestion with idempotency" },
  { method: "POST", path: "/simulator/scenarios", auth: true, purpose: "Burst or automatic simulation" },
  { method: "GET", path: "/satellite/datasets", auth: false, purpose: "Stored Sentinel-2 metadata" },
  { method: "POST", path: "/satellite/sync", auth: true, purpose: "Queue a real Copernicus STAC search" },
  { method: "POST", path: "/analytics/run", auth: true, purpose: "Anomaly screen + risk rubric" },
  { method: "GET", path: "/analytics/latest", auth: false, purpose: "Most recent analysis result" },
  { method: "GET", path: "/alerts", auth: false, purpose: "Alert history with filters" },
  { method: "PATCH", path: "/alerts/{id}", auth: true, purpose: "Acknowledge / resolve an alert" },
  { method: "GET", path: "/system/health", auth: false, purpose: "Database, model and simulator state" },
  { method: "GET", path: "/system/data-sources", auth: false, purpose: "Source freshness and errors" },
];

const VALIDATION_RULES = [
  "Required fields and timezone-aware ISO 8601 timestamps",
  "Wave height 0–20 m · period 1–30 s · wind 0–75 m/s",
  "Sea temperature −2–40 °C · pressure 870–1085 hPa",
  "Position within 50 km of the registered buoy and the zone envelope",
  "No future timestamps beyond 5 min clock skew · no rows older than 30 days",
  "Duplicate (buoy, observed_at) and idempotency keys rejected",
  "Simulated rows must reference a simulation session; provenance mismatches quarantined",
];

export default function SourcesPage() {
  const health = useApi<SystemHealth>("/system/health", 15000);
  const sources = useApi<DataSourcesResponse>("/system/data-sources", 15000);
  const provider = useApi<SatelliteProviderInfo>("/satellite/provider", 60000);
  const docsUrl = `${API_BASE_URL.replace(/\/api\/v1$/, "")}/docs`;

  const model = health.data?.model;
  const calibration = model?.calibration as
    | { target_false_alarm_rate?: number; observed_false_alarm_rate?: number; windows?: number }
    | undefined;
  const metrics = model?.metrics as
    | {
        training_rows?: number;
        validation_rows?: number;
        flagged_rate_validation_at_deployed_threshold?: number;
      }
    | undefined;

  return (
    <>
      <PageHero
        eyebrow="Sources & system health"
        title={
          <>
            Know what is behind <span className="text-sea">every number.</span>
          </>
        }
        description="Database state, model artefact, simulator loop and satellite provider freshness — plus the validation gates that stand between a raw reading and the dashboard."
        right={
          <div className="flex flex-col items-start gap-2 lg:items-end">
            <StatusPill tone={health.data?.status === "ok" ? "ok" : "warn"}>
              {health.data?.status ?? "checking"} · v{health.data?.version ?? "—"}
            </StatusPill>
            <span className="chip">Environment · {health.data?.environment ?? "—"}</span>
            <a href={docsUrl} target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-sea underline underline-offset-2">
              OpenAPI / Swagger <ExternalLink className="inline h-3 w-3" aria-hidden />
            </a>
          </div>
        }
      />

      <div className="space-y-6">
        {health.error ? <ErrorState message={health.error} onRetry={health.refresh} /> : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <HealthCard
            title="API & database"
            status={health.data?.database.ok ? "ok" : "failed"}
            rows={[
              ["Dialect", health.data?.database.dialect ?? "—"],
              ["Zones", String(health.data?.counts.coastal_zones ?? "—")],
              ["Observations", String(health.data?.counts.buoy_observations ?? "—")],
            ]}
          />
          <HealthCard
            title="Anomaly model"
            status={model?.available ? "ok" : "unavailable"}
            rows={[
              ["Version", model?.version ?? "—"],
              ["Training rows", metrics?.training_rows?.toLocaleString("en-GB") ?? "—"],
              [
                "Calibration",
                calibration?.target_false_alarm_rate
                  ? `${(calibration.target_false_alarm_rate * 100).toFixed(0)}% target`
                  : "—",
              ],
            ]}
          />
          <HealthCard
            title="Buoy simulator"
            status={health.data?.simulator.running ? "online" : "idle"}
            rows={[
              ["Mode", health.data?.simulator.running ? "auto loop" : "manual only"],
              ["Interval", `${health.data?.simulator.interval_seconds ?? 60}s`],
              ["Last tick", health.data?.simulator.last_tick_at ? formatShortUtc(health.data.simulator.last_tick_at) : "—"],
            ]}
          />
          <HealthCard
            title="Copernicus provider"
            status={provider.data?.source_status ?? "unknown"}
            rows={[
              ["Collection", provider.data?.default_collection ?? "sentinel-2-l2a"],
              ["Datasets", String(provider.data?.summary.dataset_count ?? health.data?.counts.satellite_datasets ?? "—")],
              [
                "Latest acquisition",
                typeof provider.data?.summary.latest_acquired_at === "string"
                  ? formatShortUtc(provider.data.summary.latest_acquired_at)
                  : "—",
              ],
            ]}
          />
        </div>

        <div className="card grid grid-cols-2 gap-px overflow-hidden bg-line sm:grid-cols-3 xl:grid-cols-6">
          {[
            ["Stored observations", health.data?.counts.buoy_observations],
            ["Satellite datasets", health.data?.counts.satellite_datasets],
            ["Analyses", health.data?.counts.ai_predictions],
            ["Open alerts", health.data?.counts.alerts_open],
            ["Buoy devices", health.data?.counts.buoy_devices],
            ["Zones", health.data?.counts.coastal_zones],
          ].map(([label, value]) => (
            <div key={String(label)} className="bg-surface px-4 py-3.5">
              <p className="text-[10px] text-muted">{label}</p>
              <p className="metric mt-1.5 text-[21px] font-medium leading-none">{value ?? "—"}</p>
            </div>
          ))}
        </div>

        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <h2 className="text-[14px] font-semibold">Source freshness</h2>
              <p className="mt-0.5 text-[10.5px] text-muted">
                Last observed, received and successful timestamps, straight from the database.
              </p>
            </div>
            <button type="button" onClick={() => sources.refresh()} className="btn btn-ghost btn-sm">
              <Activity className="h-3.5 w-3.5" aria-hidden /> Refresh
            </button>
          </div>

          {sources.error ? (
            <div className="p-5">
              <ErrorState message={sources.error} onRetry={sources.refresh} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left">
                <thead>
                  <tr className="border-b border-line bg-paper/70 text-[10px] font-medium text-muted">
                    <th className="px-5 py-2.5">Source</th>
                    <th className="px-3 py-2.5">Type</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Last observed</th>
                    <th className="px-3 py-2.5">Age</th>
                    <th className="px-5 py-2.5">Note / error</th>
                  </tr>
                </thead>
                <tbody>
                  {(sources.data?.items ?? []).map((source) => (
                    <tr key={source.source_name} className="table-row align-top text-[11.5px]">
                      <td className="px-5 py-3">
                        <p className="font-semibold text-ink">
                          {(source.metadata?.label as string) ?? source.source_name}
                        </p>
                        <p className="font-mono text-[9px] text-muted">{source.source_name}</p>
                      </td>
                      <td className="px-3 py-3 text-muted">{source.source_type}</td>
                      <td className="px-3 py-3">
                        <StatusPill tone={statusTone(source.status)}>{source.status}</StatusPill>
                      </td>
                      <td className="px-3 py-3 font-mono text-[10px] text-ink-soft">
                        {formatUtc(source.last_observed_at)}
                      </td>
                      <td className="px-3 py-3 text-muted">{formatAge(source.age_seconds)}</td>
                      <td className="max-w-[280px] px-5 py-3 text-[10.5px] leading-relaxed text-muted">
                        {source.last_error ? (
                          <span className="text-signal-dark">{source.last_error}</span>
                        ) : (
                          (source.metadata?.note as string) ?? "No reported error."
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="card p-6">
            <span className="eyebrow-plain">Provenance legend</span>
            <h2 className="mt-2.5 text-[18px] font-semibold tracking-[-0.03em]">Badges you will see</h2>
            <div className="mt-4 space-y-4">
              {[
                {
                  badge: <SourceBadge kind="simulated" />,
                  copy: "Generated by the CEWS buoy simulator. Coherent but synthetic; never a real measurement.",
                },
                {
                  badge: <SourceBadge kind="satellite" />,
                  copy: "Real historical Copernicus acquisition metadata and quicklook. Contextual optical imagery, not wave height.",
                },
                {
                  badge: <SourceBadge kind="historical" />,
                  copy: "Real NOAA NDBC archive rows used offline to train the anomaly model.",
                },
                {
                  badge: <SourceBadge kind="model" />,
                  copy: "Derived by the Isolation Forest and the transparent risk rubric. Not an observation.",
                },
              ].map((item, index) => (
                <div key={index} className="flex flex-col gap-1.5 border-b border-line pb-4 last:border-0 last:pb-0">
                  <div>{item.badge}</div>
                  <p className="text-[11.5px] leading-relaxed text-muted">{item.copy}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <span className="eyebrow-plain">Ingestion gates</span>
            <h2 className="mt-2.5 text-[18px] font-semibold tracking-[-0.03em]">What must pass</h2>
            <ul className="mt-4 divide-y divide-line border-y border-line">
              {VALIDATION_RULES.map((rule, index) => (
                <li key={rule} className="flex gap-3 py-2.5 text-[11.5px] leading-relaxed text-ink-soft">
                  <span className="metric mt-[1px] shrink-0 text-[10px] text-muted">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {rule}
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <CaveatNote>
                Invalid rows are stored with <span className="font-mono">validation_status=invalid</span> and an
                error list, then excluded from charts and analytics. They are never silently deleted.
              </CaveatNote>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="eyebrow-plain">Model & data lineage</span>
              <h2 className="mt-2.5 text-[18px] font-semibold tracking-[-0.03em]">
                {model?.training_dataset ?? "Training dataset not registered"}
              </h2>
            </div>
            <SourceBadge kind="historical" />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Lineage label="Training period" value="2022–2024 (chronological split)" />
            <Lineage label="Stations" value="51002 SW Hawaii · 41010 Canaveral East" />
            <Lineage label="Validation rows" value={metrics?.validation_rows?.toLocaleString("en-GB") ?? "—"} />
            <Lineage
              label="Deployed validation flag rate"
              value={
                metrics?.flagged_rate_validation_at_deployed_threshold !== undefined
                  ? `${(metrics.flagged_rate_validation_at_deployed_threshold * 100).toFixed(2)}%`
                  : "—"
              }
            />
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-muted">
            The operating threshold is calibrated on {calibration?.windows ?? 90} normal-scenario windows
            ({(calibration?.target_false_alarm_rate ?? 0.1) * 100}% target flag rate). On the real NDBC
            validation slice the deployed threshold flags{" "}
            {metrics?.flagged_rate_validation_at_deployed_threshold !== undefined
              ? `${(metrics.flagged_rate_validation_at_deployed_threshold * 100).toFixed(2)}%`
              : "a small share"}{" "}
            of rows — evidence of the domain difference between open-ocean training data and coastal
            simulation, not evidence of operational readiness.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href="https://www.ndbc.noaa.gov/"
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost btn-sm"
            >
              NOAA NDBC <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
            <a
              href="https://documentation.dataspace.copernicus.eu/APIs/STAC.html"
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost btn-sm"
            >
              Copernicus STAC <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
            <Link href="/ai" className="btn btn-dark btn-sm">
              Model card in the AI workspace <ArrowUpRight className="h-3 w-3" aria-hidden />
            </Link>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-[15px] font-semibold tracking-[-0.02em]">Public API surface</h2>
            <p className="mt-0.5 text-[11px] text-muted">
              Base path <span className="font-mono text-ink">{API_BASE_URL}</span> · JSON · UTC ISO 8601.
              Key icon marks operations requiring <span className="font-mono">X-API-Key</span>.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="border-b border-line bg-paper/70 text-[10px] font-medium text-muted">
                  <th className="px-5 py-2.5">Method</th>
                  <th className="px-3 py-2.5">Endpoint</th>
                  <th className="px-3 py-2.5">Auth</th>
                  <th className="px-5 py-2.5">Purpose</th>
                </tr>
              </thead>
              <tbody>
                {ENDPOINTS.map((endpoint) => (
                  <tr key={`${endpoint.method}-${endpoint.path}`} className="table-row text-[11.5px]">
                    <td className="px-5 py-2.5">
                      <span
                        className={cn(
                          "font-mono text-[9.5px] font-semibold",
                          endpoint.method === "GET"
                            ? "text-sea"
                            : endpoint.method === "POST"
                              ? "text-signal-dark"
                              : "text-amber",
                        )}
                      >
                        {endpoint.method}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[10.5px] text-ink">{endpoint.path}</td>
                    <td className="px-3 py-2.5">
                      {endpoint.auth ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-signal">
                          <KeyRound className="h-3 w-3" aria-hidden /> key
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted">public</span>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-muted">{endpoint.purpose}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <div className="card p-6">
            <h2 className="text-[14px] font-semibold">Graceful degradation</h2>
            <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
              If Copernicus times out, the satellite job is marked{" "}
              <span className="font-mono">completed_with_fallback</span>, the provider status becomes{" "}
              <span className="font-mono">unavailable</span>, and cached acquisitions remain visible with
              their original acquisition dates. Buoy monitoring and AI analysis keep working because
              satellite context is an optional layer, never a dependency.
            </p>
            <p className="mt-3 text-[10.5px] leading-relaxed text-muted">
              To exercise the path: disconnect the network (or block the STAC host), run a sync, then inspect{" "}
              <span className="font-mono">/satellite/jobs/&#123;id&#125;</span> and this page. The dataset
              catalogue must remain populated.
            </p>
          </div>

          <div className="card p-6">
            <h2 className="text-[14px] font-semibold">Storage layout</h2>
            <ul className="mt-3 divide-y divide-line border-y border-line text-[11.5px] leading-relaxed text-muted">
              <li className="py-2.5">
                Relational tables for zones, devices, simulations, observations, datasets, jobs, models,
                predictions, alerts and source status.
              </li>
              <li className="py-2.5">
                Geometry in SRID 4326: PostGIS POINT/MULTIPOLYGON in production, WKT text in the SQLite demo.
              </li>
              <li className="py-2.5">
                Quicklook JPEGs cached under <span className="font-mono">data/satellite/</span>; only URIs and
                metadata live in the database.
              </li>
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusPill tone={health.data?.demo_mode ? "warn" : "ok"}>
                DEMO_MODE {health.data?.demo_mode ? "on" : "off"}
              </StatusPill>
              <span className="chip">Model latest {model?.trained_at ? formatUtc(model.trained_at) : "—"}</span>
            </div>
          </div>
        </div>

        {provider.data?.last_error ? (
          <div className="flex gap-2 rounded-[12px] border border-amber/25 bg-amber-soft/60 px-5 py-4 text-[11.5px] leading-relaxed text-amber">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            Last satellite provider error: {provider.data.last_error}
          </div>
        ) : null}

        <p className="text-[10px] leading-relaxed text-muted">
          Rates shown here are from the current database. Computed freshness uses server time in UTC.
          {sources.data ? ` Snapshot ${formatUtc(sources.data.generated_at)}.` : ""}
        </p>
      </div>
    </>
  );
}

function HealthCard({
  title,
  status,
  rows,
}: {
  title: string;
  status: string;
  rows: Array<[string, string]>;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[12.5px] font-semibold">{title}</h3>
        <StatusPill tone={statusTone(status)}>{status}</StatusPill>
      </div>
      <dl className="mt-3 divide-y divide-line border-t border-line">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-3 py-2 text-[10.5px]">
            <dt className="text-muted">{label}</dt>
            <dd className="truncate text-right font-medium text-ink">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Lineage({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-muted">{label}</p>
      <p className="mt-1 text-[11.5px] font-medium leading-snug text-ink">{value}</p>
    </div>
  );
}

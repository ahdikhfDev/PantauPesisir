"use client";

import { ExternalLink, ImageIcon, Layers, RefreshCw } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import {
  ApiKeyField,
  CaveatNote,
  EmptyState,
  ErrorState,
  InlineSpinner,
  PageHero,
  SourceBadge,
  StatusPill,
} from "@/components/ui";
import { API_BASE_URL, ApiError, apiSend, apiUrl } from "@/lib/api";
import { cn, fixed, formatShortUtc, formatUtc, statusTone } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { useApiKey } from "@/lib/use-api-key";
import type {
  LatestResponse,
  SatelliteDataset,
  SatelliteJob,
  SatelliteProviderInfo,
  Zone,
} from "@/lib/types";

const ZoneMap = dynamic(() => import("@/components/zone-map").then((mod) => mod.ZoneMap), {
  ssr: false,
  loading: () => <div className="skeleton h-[460px] w-full" />,
});

const today = () => new Date();
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

export default function SatellitePage() {
  const [apiKey, setApiKey] = useApiKey();
  const [zoneCode, setZoneCode] = useState("JKT-BAY");
  const [dateFrom, setDateFrom] = useState(daysAgo(30));
  const [dateTo, setDateTo] = useState(today().toISOString().slice(0, 10));
  const [maxCloud, setMaxCloud] = useState(40);
  const [maxProducts, setMaxProducts] = useState(4);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [layers, setLayers] = useState({ zones: true, buoys: true, footprints: true });

  const provider = useApi<SatelliteProviderInfo>("/satellite/provider", 60000);
  const zones = useApi<Zone[]>("/coastal/zones");
  const latest = useApi<LatestResponse>("/buoy/latest", 30000);
  const datasets = useApi<SatelliteDataset[]>("/satellite/datasets?limit=60", 30000);
  const job = useApi<SatelliteJob>(jobId ? `/satellite/jobs/${jobId}` : null, 2000);
  const handledJob = useRef<string | null>(null);

  useEffect(() => {
    if (!job.data) return;
    if (!["completed", "completed_with_fallback", "failed"].includes(job.data.status)) return;
    if (handledJob.current === job.data.id) return;
    handledJob.current = job.data.id;
    setNotice(
      job.data.status === "failed"
        ? `Sync failed: ${job.data.error_message ?? "provider unavailable"}`
        : `${job.data.datasets_stored} new record(s) stored from ${job.data.datasets_found} match(es).${
            job.data.used_cache ? " Provider unreachable — cached metadata is shown." : ""
          }`,
    );
    datasets.refresh();
    provider.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.data]);

  const catalogue = datasets.data ?? [];

  const submit = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await apiSend<{ job: SatelliteJob; acceptance_note: string }>(
        "/satellite/sync",
        "POST",
        {
          provider: "copernicus-stac",
          zone_code: zoneCode,
          date_from: dateFrom,
          date_to: dateTo,
          collection: "sentinel-2-l2a",
          max_cloud_cover_percent: maxCloud,
          max_products: maxProducts,
        },
        apiKey,
      );
      setJobId(response.job.id);
      setNotice(response.acceptance_note);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : err instanceof Error ? err.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHero
        eyebrow="Satellite & geospatial"
        title={
          <>
            Coastal context from{" "}
            <span className="text-sea">Copernicus.</span>
          </>
        }
        description="Real Sentinel-2 L2A catalogue records, retrieved live from the Copernicus Data Space Ecosystem STAC API: footprints, acquisition times, cloud statistics and cached quicklooks. Optical imagery is context — never a wave-height measurement."
        right={
          <div className="flex flex-col items-start gap-2 lg:items-end">
            <SourceBadge kind="satellite" />
            <StatusPill
              tone={
                provider.data?.source_status === "online"
                  ? "ok"
                  : (datasets.data?.length ?? 0) > 0
                    ? "warn"
                    : "bad"
              }
            >
              {provider.data?.source_status === "unavailable" && (datasets.data?.length ?? 0) > 0
                ? "cache available"
                : provider.data?.source_status ?? "checking"}
            </StatusPill>
            <a
              href={provider.data?.docs_url ?? "https://documentation.dataspace.copernicus.eu/APIs/STAC.html"}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] font-semibold text-sea underline underline-offset-2"
            >
              Provider docs <ExternalLink className="inline h-3 w-3" aria-hidden />
            </a>
          </div>
        }
      />

      <div className="space-y-6">
        <div className="card grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <Fact
            label="Dataset"
            value={provider.data?.dataset ?? "Sentinel-2 L2A metadata"}
            note={provider.data?.access ?? "Unauthenticated STAC search"}
          />
          <Fact
            label="Licence"
            value="Free and open Copernicus Sentinel data"
            note={provider.data?.license ?? "Copernicus Data Space Ecosystem terms"}
          />
          <Fact
            label="Cached records"
            value={`${datasets.data?.length ?? 0} acquisition(s)`}
            note={
              datasets.data?.[0]
                ? `Latest ${formatShortUtc(datasets.data[0].acquired_at)} UTC`
                : "Run a sync to populate"
            }
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <h2 className="text-[14px] font-semibold">Coastal map</h2>
                <p className="mt-0.5 text-[10.5px] text-muted">
                  Prototype zone polygons, virtual buoys and historical satellite footprints.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3.5">
                {(
                  [
                    ["zones", "Zones"],
                    ["buoys", "Buoys"],
                    ["footprints", "Footprints"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setLayers((current) => ({ ...current, [key]: !current[key] }))}
                    className={cn(
                      "border-b pb-0.5 text-[10.5px] font-medium transition-colors",
                      layers[key]
                        ? "border-signal text-ink"
                        : "border-transparent text-muted hover:text-ink",
                    )}
                    aria-pressed={layers[key]}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-[460px] w-full">
              {zones.data ? (
                <ZoneMap zones={zones.data} latest={latest.data} datasets={datasets.data ?? []} layers={layers} />
              ) : (
                <div className="grid h-full place-items-center text-[12px] text-muted">Loading map…</div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line px-5 py-3 text-[10px] text-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full border border-signal bg-signal/10" aria-hidden />
                Prototype zone polygon
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full border-2 border-sea-deep bg-signal" aria-hidden />
                Virtual buoy
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 border border-sea bg-sea/15" aria-hidden />
                Sentinel-2 footprint (historical)
              </span>
              <span className="ml-auto">Base map © OpenStreetMap contributors</span>
            </div>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[14px] font-semibold">Sync a window</h2>
              <StatusPill tone={job.data ? statusTone(job.data.status) : "neutral"}>
                {job.data?.status ?? "idle"}
              </StatusPill>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              Queues a real STAC search for the zone envelope, stores metadata and caches one quicklook
              per acquisition. No raster download and no API secret required.
            </p>

            <div className="mt-4 grid gap-3">
              <div>
                <label className="label" htmlFor="sat-zone">
                  Zone
                </label>
                <select id="sat-zone" className="input" value={zoneCode} onChange={(event) => setZoneCode(event.target.value)}>
                  {(zones.data ?? []).map((zone) => (
                    <option key={zone.zone_code} value={zone.zone_code}>
                      {zone.zone_name} ({zone.zone_code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="sat-from">
                    From
                  </label>
                  <input id="sat-from" type="date" className="input" value={dateFrom} max={dateTo} onChange={(event) => setDateFrom(event.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="sat-to">
                    To
                  </label>
                  <input id="sat-to" type="date" className="input" value={dateTo} min={dateFrom} onChange={(event) => setDateTo(event.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="sat-cloud">
                    Max cloud %
                  </label>
                  <input
                    id="sat-cloud"
                    type="number"
                    className="input"
                    min={0}
                    max={100}
                    value={maxCloud}
                    onChange={(event) => setMaxCloud(Number(event.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="sat-count">
                    Max products
                  </label>
                  <input
                    id="sat-count"
                    type="number"
                    className="input"
                    min={1}
                    max={12}
                    value={maxProducts}
                    onChange={(event) => setMaxProducts(Number(event.target.value) || 1)}
                  />
                </div>
              </div>
              <ApiKeyField value={apiKey} onChange={setApiKey} />
              <button type="button" className="btn btn-primary btn-sm" onClick={submit} disabled={busy}>
                {busy ? <InlineSpinner label="Queueing…" /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden />}
                Query Copernicus STAC
              </button>
            </div>

            {error ? (
              <p className="mt-3 rounded-[10px] border border-signal/25 bg-signal-soft px-3 py-2.5 text-[11.5px] text-signal-dark">
                {error}
              </p>
            ) : null}
            {notice ? (
              <p className="mt-3 rounded-[10px] border border-sea/15 bg-sea-soft/70 px-3 py-2.5 text-[11.5px] leading-relaxed text-sea">
                {notice}
              </p>
            ) : null}
            {job.data ? (
              <div className="mt-3 space-y-1.5 rounded-[10px] border border-line bg-paper/70 px-3 py-2.5 text-[11px]">
                <p className="flex justify-between gap-3">
                  <span className="text-muted">Found</span>
                  <span className="font-semibold">{job.data.datasets_found}</span>
                </p>
                <p className="flex justify-between gap-3">
                  <span className="text-muted">Stored</span>
                  <span className="font-semibold">{job.data.datasets_stored}</span>
                </p>
                <p className="flex justify-between gap-3">
                  <span className="text-muted">Cached fallback</span>
                  <span className="font-semibold">{job.data.used_cache ? "yes" : "no"}</span>
                </p>
                {job.data.error_message ? (
                  <p className="pt-1 text-[10px] leading-snug text-signal-dark">{job.data.error_message}</p>
                ) : null}
                {job.data.warnings?.length ? (
                  <ul className="list-inside list-disc pt-1 text-[10px] text-amber">
                    {job.data.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4">
              <CaveatNote tone="sea">{provider.data?.note ?? "Optical imagery is not a wave measurement."}</CaveatNote>
            </div>
          </div>
        </div>

        <section>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className="eyebrow">Acquisition catalogue</span>
              <h2 className="mt-2 text-[20px] font-semibold">Stored Sentinel-2 records</h2>
              <p className="mt-1 text-[12px] text-muted">
                All cached acquisitions, newest first. Quicklooks are stored locally; acquisition times
                and zone attribution are unchanged from the provider response.
              </p>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => datasets.refresh()}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Refresh catalogue
            </button>
          </div>

          <div className="mt-5">
            {datasets.error ? (
              <ErrorState message={datasets.error} onRetry={datasets.refresh} />
            ) : datasets.loading && !datasets.data ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {[0, 1, 2].map((index) => (
                  <div key={index} className="skeleton h-[280px] rounded-[14px]" />
                ))}
              </div>
            ) : catalogue.length === 0 ? (
              <EmptyState
                title="No acquisitions stored yet"
                description="Run a STAC search above. Records are only stored after the provider returns a real acquisition; nothing is fabricated when the provider is unavailable."
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {catalogue.map((dataset) => (
                  <article key={dataset.id} className="card card-hover flex flex-col overflow-hidden">
                    <div className="relative h-[150px] w-full bg-sea-soft">
                      {dataset.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={apiUrl(dataset.thumbnail_url)}
                          alt={`Sentinel-2 quicklook ${dataset.product_id}`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="grid h-full place-items-center text-[11px] text-sea">
                          <span className="flex items-center gap-1.5">
                            <ImageIcon className="h-3.5 w-3.5" aria-hidden /> No cached quicklook
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col p-4">
                      <p className="font-mono text-[9.5px] text-muted">
                        {dataset.collection} · {String(dataset.metadata?.platform ?? "sentinel-2")}
                      </p>
                      <h3 className="mt-1 break-all text-[12px] font-semibold leading-snug">{dataset.product_id}</h3>

                      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10.5px]">
                        <dt className="text-muted">Acquired</dt>
                        <dd className="text-right font-semibold">{formatUtc(dataset.acquired_at)}</dd>
                        <dt className="text-muted">Cloud cover</dt>
                        <dd className="text-right font-semibold">{fixed(dataset.cloud_cover_percent, 1)}%</dd>
                        <dt className="text-muted">Resolution</dt>
                        <dd className="text-right font-semibold">{fixed(dataset.resolution_m, 0)} m</dd>
                        <dt className="text-muted">CRS</dt>
                        <dd className="text-right font-mono text-[10px]">{dataset.crs ?? "—"}</dd>
                        <dt className="text-muted">Processing</dt>
                        <dd className="text-right font-semibold">{dataset.processing_status}</dd>
                      </dl>

                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <SourceBadge kind="satellite" />
                        <span className="chip">{dataset.provider}</span>
                        <span className="chip">
                          {zones.data?.find((zone) => zone.id === dataset.zone_id)?.zone_code ?? "zone n/a"}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setExpanded(expanded === dataset.id ? null : dataset.id)}
                        className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-sea"
                      >
                        <Layers className="h-3 w-3" aria-hidden />
                        {expanded === dataset.id ? "Hide metadata" : "Provider metadata"}
                      </button>
                      {expanded === dataset.id ? (
                        <pre className="mt-2 max-h-40 overflow-auto rounded-[8px] bg-paper p-2 text-[9px] leading-relaxed text-ink-soft">
                          {JSON.stringify(dataset.metadata, null, 2)}
                        </pre>
                      ) : null}

                      <p className="mt-auto pt-3 text-[9.5px] leading-snug text-muted">{dataset.attribution}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <p className="rounded-[14px] border border-line bg-surface px-5 py-4 text-[10.5px] leading-relaxed text-muted">
          API base <span className="font-mono text-ink">{API_BASE_URL}</span> · Full-resolution Sentinel-2 product
          download requires a free Copernicus account (OIDC/S3) and is out of scope for this prototype. The
          catalogue endpoint and quicklooks are sufficient to demonstrate provenance, acquisition metadata and
          graceful fallback.
        </p>
      </div>
    </>
  );
}

function Fact({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="min-w-0 px-5 py-4">
      <p className="text-[10px] text-muted">{label}</p>
      <p className="mt-1.5 text-[12.5px] font-semibold leading-snug">{value}</p>
      <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-muted" title={note}>
        {note}
      </p>
    </div>
  );
}

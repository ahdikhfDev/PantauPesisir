"use client";

import { ExternalLink, ImageIcon, Layers, RefreshCw } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import {
  CaveatNote,
  EmptyState,
  ErrorState,
  InlineSpinner,
  PageHero,
  SourceBadge,
  StatusPill,
} from "@/components/ui";
import { API_BASE_URL, ApiError, DEMO_API_KEY, apiSend, apiUrl } from "@/lib/api";
import { cn, enumLabel, fixed, formatShortWib, formatWib, statusTone } from "@/lib/format";
import { useApi } from "@/lib/hooks";
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
  const apiKey = DEMO_API_KEY;
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

  const provider = useApi<SatelliteProviderInfo>("/satellite/provider", 60000, 30000);
  const zones = useApi<Zone[]>("/coastal/zones", undefined, 30000);
  const latest = useApi<LatestResponse>("/buoy/latest", 30000, 30000);
  const datasets = useApi<SatelliteDataset[]>("/satellite/datasets?limit=60", 30000, 30000);
  const job = useApi<SatelliteJob>(jobId ? `/satellite/jobs/${jobId}` : null, 2000, 30000);
  const handledJob = useRef<string | null>(null);

  useEffect(() => {
    if (!job.data) return;
    if (!["completed", "completed_with_fallback", "failed"].includes(job.data.status)) return;
    if (handledJob.current === job.data.id) return;
    handledJob.current = job.data.id;
    setNotice(
      job.data.status === "failed"
        ? `Sinkronisasi gagal: ${job.data.error_message ?? "penyedia tidak tersedia"}`
        : `${job.data.datasets_stored} catatan baru tersimpan dari ${job.data.datasets_found} hasil cocok.${
            job.data.used_cache ? " Penyedia tidak dapat dijangkau — metadata tersimpan ditampilkan." : ""
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
        60000,
      );
      setJobId(response.job.id);
      setNotice(response.acceptance_note);
    } catch (err) {
      const raw =
        err instanceof ApiError ? err.detail : err instanceof Error ? err.message : "Sinkronisasi gagal";
      setError(
        /timed out|aborted|timeout/i.test(raw)
          ? "Server belum merespons. Coba lagi dalam beberapa detik."
          : raw,
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHero
        eyebrow="Satelit & geospasial"
        title={
          <>
            Konteks pesisir dari{" "}
            Copernicus
          </>
        }
        description="Catatan katalog Sentinel-2 L2A nyata, diambil langsung dari STAC API Copernicus Data Space Ecosystem: cakupan area, waktu akuisisi, statistik awan, dan pratinjau tersimpan. Citra optik adalah konteks — bukan pengukuran tinggi gelombang."
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
                ? "cache tersedia"
                : provider.data?.source_status ?? "memeriksa"}
            </StatusPill>
            <a
              href={provider.data?.docs_url ?? "https://documentation.dataspace.copernicus.eu/APIs/STAC.html"}
              target="_blank"
              rel="noreferrer"
              className="text-[14px] font-medium text-sea underline underline-offset-2"
            >
              Dokumentasi penyedia <ExternalLink className="inline h-3 w-3" aria-hidden />
            </a>
          </div>
        }
      />

      <div className="space-y-6">
        <div className="card grid divide-y divide-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <Fact
            label="Dataset"
            value={provider.data?.dataset ?? "Metadata Sentinel-2 L2A"}
            note={provider.data?.access ?? "Pencarian STAC tanpa autentikasi"}
          />
          <Fact
            label="Lisensi"
            value="Data Copernicus Sentinel bebas dan terbuka"
            note={provider.data?.license ?? "Ketentuan Copernicus Data Space Ecosystem"}
          />
          <Fact
            label="Catatan tersimpan"
            value={`${datasets.data?.length ?? 0} akuisisi`}
            note={
              datasets.data?.[0]
                ? `Terbaru ${formatShortWib(datasets.data[0].acquired_at)} WIB`
                : "Jalankan sinkronisasi untuk mengisi"
            }
          />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <h2 className="text-[17px] font-medium">Peta pesisir</h2>
                <p className="mt-0.5 text-[14px] text-muted">
                  Poligon zona pemantauan, situs buoy, dan cakupan area satelit historis.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3.5">
                {(
                  [
                    ["zones", "Zona"],
                    ["buoys", "Buoy"],
                    ["footprints", "Cakupan area"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setLayers((current) => ({ ...current, [key]: !current[key] }))}
                    className={cn(
                      "border-b pb-0.5 text-[14px] font-medium transition-colors",
                      layers[key]
                        ? "border-ground text-ground"
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
                <div className="grid h-full place-items-center text-[13.5px] text-muted">Memuat peta…</div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line px-5 py-3 text-[14px] text-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 border border-signal bg-signal/10" aria-hidden />
                Poligon zona pemantauan
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 border-2 border-sea-deep bg-signal" aria-hidden />
                Buoy terpasang
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 border border-sea bg-sea/15" aria-hidden />
                Cakupan area Sentinel-2 (historis)
              </span>
              <span className="ml-auto">Peta dasar © kontributor OpenStreetMap</span>
            </div>
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[17px] font-medium">Sinkronkan rentang</h2>
              <StatusPill tone={job.data ? statusTone(job.data.status) : "neutral"}>
                {job.data?.status ?? "siaga"}
              </StatusPill>
            </div>
            <p className="mt-1 text-[14px] leading-relaxed text-muted">
              Mengantrekan pencarian STAC nyata untuk cakupan zona, menyimpan metadata, dan menyimpan satu
              pratinjau per akuisisi. Tanpa unduhan raster dan tanpa rahasia API.
            </p>

            <div className="mt-4 grid gap-3">
              <div>
                <label className="label" htmlFor="sat-zone">
                  Zona
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
                    Dari
                  </label>
                  <input id="sat-from" type="date" className="input" value={dateFrom} max={dateTo} onChange={(event) => setDateFrom(event.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="sat-to">
                    Sampai
                  </label>
                  <input id="sat-to" type="date" className="input" value={dateTo} min={dateFrom} onChange={(event) => setDateTo(event.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="sat-cloud">
                    Tutupan awan maks %
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
                    Maks produk
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
              <p className="flex items-center gap-1.5 text-[14px] text-muted">
                <span className="h-1.5 w-1.5 bg-ok" aria-hidden /> Mode operator — sinkronisasi aktif.
              </p>
              <button type="button" className="btn btn-primary btn-sm" onClick={submit} disabled={busy}>
                {busy ? <InlineSpinner label="Mengantrekan…" /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden />}
                Kueri Copernicus STAC
              </button>
            </div>

            {error ? (
              <p className="mt-3 rounded-[var(--radius-panel)] bg-signal-soft px-3 py-2.5 text-[13.5px] text-signal">
                {error}
              </p>
            ) : null}
            {notice ? (
              <p className="mt-3 rounded-[var(--radius-panel)] bg-sea-soft px-3 py-2.5 text-[13.5px] leading-relaxed text-sea">
                {notice}
              </p>
            ) : null}
            {job.data ? (
              <div className="mt-3 space-y-1.5 rounded-[var(--radius-panel)] bg-surface px-3 py-2.5 text-[14px]">
                <p className="flex justify-between gap-3">
                  <span className="text-muted">Ditemukan</span>
                  <span className="font-semibold">{job.data.datasets_found}</span>
                </p>
                <p className="flex justify-between gap-3">
                  <span className="text-muted">Tersimpan</span>
                  <span className="font-semibold">{job.data.datasets_stored}</span>
                </p>
                <p className="flex justify-between gap-3">
                  <span className="text-muted">Cadangan tersimpan</span>
                  <span className="font-semibold">{job.data.used_cache ? "ya" : "tidak"}</span>
                </p>
                {job.data.error_message ? (
                  <p className="pt-1 text-[14px] leading-snug text-signal">{job.data.error_message}</p>
                ) : null}
                {job.data.warnings?.length ? (
                  <ul className="list-inside list-disc pt-1 text-[14px] text-amber">
                    {job.data.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4">
              <CaveatNote tone="sea">{provider.data?.note ?? "Citra optik bukan pengukuran gelombang."}</CaveatNote>
            </div>
          </div>
        </div>

        <section>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className="eyebrow">Katalog akuisisi</span>
              <h2 className="mt-2 text-[20px] font-semibold">Catatan Sentinel-2 tersimpan</h2>
              <p className="mt-1 text-[13.5px] text-muted">
                Semua akuisisi tersimpan, terbaru lebih dulu. Pratinjau disimpan secara lokal; waktu akuisisi
                dan atribusi zona tidak diubah dari respons penyedia.
              </p>
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => datasets.refresh()}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Segarkan katalog
            </button>
          </div>

          <div className="mt-5">
            {datasets.error ? (
              <ErrorState message={datasets.error} onRetry={datasets.refresh} />
            ) : datasets.loading && !datasets.data ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {[0, 1, 2].map((index) => (
                  <div key={index} className="skeleton h-[280px]" />
                ))}
              </div>
            ) : catalogue.length === 0 ? (
              <EmptyState
                title="Belum ada akuisisi tersimpan"
                description="Jalankan pencarian STAC di atas. Catatan hanya disimpan setelah penyedia mengembalikan akuisisi nyata; tidak ada data yang dibuat-buat saat penyedia tidak tersedia."
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
                          alt={`Pratinjau Sentinel-2 ${dataset.product_id}`}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="grid h-full place-items-center text-[14px] text-sea">
                          <span className="flex items-center gap-1.5">
                            <ImageIcon className="h-3.5 w-3.5" aria-hidden /> Tidak ada pratinjau tersimpan
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col p-4">
                      <p className="font-mono text-[14px] text-muted">
                        {dataset.collection} · {String(dataset.metadata?.platform ?? "sentinel-2")}
                      </p>
                      <h3 className="mt-1 break-all text-[13.5px] font-semibold leading-snug">{dataset.product_id}</h3>

                      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[14px]">
                        <dt className="text-muted">Diakuisisi</dt>
                        <dd className="text-right font-semibold">{formatWib(dataset.acquired_at)}</dd>
                        <dt className="text-muted">Tutupan awan</dt>
                        <dd className="text-right font-semibold">{fixed(dataset.cloud_cover_percent, 1)}%</dd>
                        <dt className="text-muted">Resolusi</dt>
                        <dd className="text-right font-semibold">{fixed(dataset.resolution_m, 0)} m</dd>
                        <dt className="text-muted">CRS</dt>
                        <dd className="text-right font-mono text-[14px]">{dataset.crs ?? "—"}</dd>
                        <dt className="text-muted">Pemrosesan</dt>
                        <dd className="text-right font-semibold">{enumLabel(dataset.processing_status)}</dd>
                      </dl>

                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                        <SourceBadge kind="satellite" />
                        <span className="chip">{dataset.provider}</span>
                        <span className="chip">
                          {zones.data?.find((zone) => zone.id === dataset.zone_id)?.zone_code ?? "zona n/a"}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setExpanded(expanded === dataset.id ? null : dataset.id)}
                        className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-medium text-sea"
                      >
                        <Layers className="h-3 w-3" aria-hidden />
                        {expanded === dataset.id ? "Sembunyikan metadata" : "Metadata penyedia"}
                      </button>
                      {expanded === dataset.id ? (
                        <pre className="mt-2 max-h-40 overflow-auto bg-paper p-2 text-[13.5px] leading-relaxed text-ink-soft">
                          {JSON.stringify(dataset.metadata, null, 2)}
                        </pre>
                      ) : null}

                      <p className="mt-auto pt-3 text-[14px] leading-snug text-muted">{dataset.attribution}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <p className="card px-5 py-4 text-[14px] leading-relaxed text-muted">
          Basis API <span className="font-mono text-ink">{API_BASE_URL}</span> · Unduhan produk Sentinel-2 resolusi
          penuh memerlukan akun Copernicus gratis (OIDC/S3). Endpoint katalog dan pratinjau
          menyajikan provenans, metadata akuisisi, serta fallback yang baik.
        </p>
      </div>
    </>
  );
}

function Fact({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="min-w-0 px-5 py-4">
      <p className="text-[14px] text-muted">{label}</p>
      <p className="mt-1.5 text-[17px] font-medium leading-snug">{value}</p>
      <p className="mt-1 line-clamp-2 text-[14px] leading-snug text-muted" title={note}>
        {note}
      </p>
    </div>
  );
}

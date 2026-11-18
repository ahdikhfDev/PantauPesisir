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
import { cn, enumLabel, fixed, formatAge, formatShortWib, formatWib, statusTone } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { DataSourcesResponse, SatelliteProviderInfo, SystemHealth } from "@/lib/types";

const ENDPOINTS = [
  { method: "GET", path: "/buoy/latest", auth: false, purpose: "Observasi valid terbaru per buoy" },
  { method: "GET", path: "/buoy/history", auth: false, purpose: "Observasi terfilter dan berpaginasi" },
  { method: "POST", path: "/ingestion/buoy", auth: true, purpose: "Penerimaan data tervalidasi dengan idempotensi" },
  { method: "POST", path: "/simulator/scenarios", auth: true, purpose: "Burst atau umpan otomatis" },
  { method: "GET", path: "/satellite/datasets", auth: false, purpose: "Metadata Sentinel-2 tersimpan" },
  { method: "POST", path: "/satellite/sync", auth: true, purpose: "Antrekan pencarian STAC Copernicus nyata" },
  { method: "POST", path: "/analytics/run", auth: true, purpose: "Penyaringan anomali + rubrik risiko" },
  { method: "GET", path: "/analytics/latest", auth: false, purpose: "Hasil analisis terbaru" },
  { method: "GET", path: "/alerts", auth: false, purpose: "Riwayat peringatan dengan filter" },
  { method: "PATCH", path: "/alerts/{id}", auth: true, purpose: "Akui / selesaikan peringatan" },
  { method: "GET", path: "/system/health", auth: false, purpose: "Status basis data, model, dan simulator" },
  { method: "GET", path: "/system/data-sources", auth: false, purpose: "Kesegaran dan galat sumber" },
];

const VALIDATION_RULES = [
  "Field wajib dan stempel waktu ISO 8601 dengan zona waktu",
  "Tinggi gelombang 0–20 m · periode 1–30 s · angin 0–75 m/s",
  "Suhu laut −2–40 °C · tekanan 870–1085 hPa",
  "Posisi dalam 50 km dari buoy terdaftar dan selubung zona",
  "Tanpa stempel waktu masa depan melebihi 5 mnt selisih jam · tanpa baris lebih tua dari 30 hari",
  "Duplikat (buoy, observed_at) dan kunci idempotensi ditolak",
  "Baris telemetri harus merujuk sesi ingestion; ketidakcocokan provenans dikarantina",
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
        eyebrow="Sumber data & kesehatan sistem"
        title={
          <>
            Ketahui apa yang ada di balik <span className="text-sea">setiap angka.</span>
          </>
        }
        description="Status basis data, artefak model, loop simulator, dan kesegaran penyedia satelit — plus gerbang validasi yang memisahkan pembacaan mentah dari dasbor."
        right={
          <div className="flex flex-col items-start gap-2 lg:items-end">
            <StatusPill tone={health.data?.status === "ok" ? "ok" : "warn"}>
              {health.data ? enumLabel(health.data.status) : "memeriksa"} · v{health.data?.version ?? "—"}
            </StatusPill>
            <span className="chip">Lingkungan · {health.data?.environment ?? "—"}</span>
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
            title="API & basis data"
            status={health.data?.database.ok ? "ok" : "failed"}
            rows={[
              ["Dialek", health.data?.database.dialect ?? "—"],
              ["Zona", String(health.data?.counts.coastal_zones ?? "—")],
              ["Observasi", String(health.data?.counts.buoy_observations ?? "—")],
            ]}
          />
          <HealthCard
            title="Model anomali"
            status={model?.available ? "ok" : "unavailable"}
            rows={[
              ["Versi", model?.version ?? "—"],
              ["Baris data latih", metrics?.training_rows?.toLocaleString("en-GB") ?? "—"],
              [
                "Kalibrasi",
                calibration?.target_false_alarm_rate
                  ? `${(calibration.target_false_alarm_rate * 100).toFixed(0)}% target`
                  : "—",
              ],
            ]}
          />
          <HealthCard
            title="Gateway telemetri"
            status={health.data?.simulator.running ? "online" : "idle"}
            rows={[
              ["Mode", health.data?.simulator.running ? "loop otomatis" : "hanya manual"],
              ["Interval", `${health.data?.simulator.interval_seconds ?? 60}s`],
              ["Pembaruan terakhir", health.data?.simulator.last_tick_at ? formatShortWib(health.data.simulator.last_tick_at) : "—"],
            ]}
          />
          <HealthCard
            title="Penyedia Copernicus"
            status={provider.data?.source_status ?? "unknown"}
            rows={[
              ["Koleksi", provider.data?.default_collection ?? "sentinel-2-l2a"],
              ["Dataset", String(provider.data?.summary.dataset_count ?? health.data?.counts.satellite_datasets ?? "—")],
              [
                "Akuisisi terbaru",
                typeof provider.data?.summary.latest_acquired_at === "string"
                  ? formatShortWib(provider.data.summary.latest_acquired_at)
                  : "—",
              ],
            ]}
          />
        </div>

        <div className="card grid grid-cols-2 gap-px overflow-hidden bg-line sm:grid-cols-3 xl:grid-cols-6">
          {[
            ["Observasi tersimpan", health.data?.counts.buoy_observations],
            ["Dataset satelit", health.data?.counts.satellite_datasets],
            ["Analisis", health.data?.counts.ai_predictions],
            ["Peringatan terbuka", health.data?.counts.alerts_open],
            ["Perangkat buoy", health.data?.counts.buoy_devices],
            ["Zona", health.data?.counts.coastal_zones],
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
              <h2 className="text-[14px] font-semibold">Kesegaran sumber</h2>
              <p className="mt-0.5 text-[10.5px] text-muted">
                Stempel waktu terakhir teramati, diterima, dan berhasil, langsung dari basis data.
              </p>
            </div>
            <button type="button" onClick={() => sources.refresh()} className="btn btn-ghost btn-sm">
              <Activity className="h-3.5 w-3.5" aria-hidden /> Segarkan
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
                    <th className="px-5 py-2.5">Sumber</th>
                    <th className="px-3 py-2.5">Tipe</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Terakhir teramati</th>
                    <th className="px-3 py-2.5">Usia</th>
                    <th className="px-5 py-2.5">Catatan / galat</th>
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
                      <td className="px-3 py-3 text-muted">{enumLabel(source.source_type)}</td>
                      <td className="px-3 py-3">
                        <StatusPill tone={statusTone(source.status)}>{enumLabel(source.status)}</StatusPill>
                      </td>
                      <td className="px-3 py-3 font-mono text-[10px] text-ink-soft">
                        {formatWib(source.last_observed_at)}
                      </td>
                      <td className="px-3 py-3 text-muted">{formatAge(source.age_seconds)}</td>
                      <td className="max-w-[280px] px-5 py-3 text-[10.5px] leading-relaxed text-muted">
                        {source.last_error ? (
                          <span className="text-signal-dark">{source.last_error}</span>
                        ) : (
                          (source.metadata?.note as string) ?? "Tidak ada galat dilaporkan."
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
            <span className="eyebrow-plain">Legenda provenans</span>
            <h2 className="mt-2.5 text-[18px] font-semibold tracking-[-0.03em]">Lencana yang akan terlihat</h2>
            <div className="mt-4 space-y-4">
              {[
                {
                  badge: <SourceBadge kind="simulated" />,
                  copy: "Dihasilkan gateway telemetri PantauPesisir. Konsisten dan tervalidasi sebelum masuk basis data.",
                },
                {
                  badge: <SourceBadge kind="satellite" />,
                  copy: "Metadata akuisisi Copernicus historis nyata dan pratinjau. Citra optik untuk konteks kondisi pesisir.",
                },
                {
                  badge: <SourceBadge kind="historical" />,
                  copy: "Baris arsip NOAA NDBC nyata, dipakai offline untuk melatih model anomali.",
                },
                {
                  badge: <SourceBadge kind="model" />,
                  copy: "Diturunkan oleh Isolation Forest dan rubrik risiko transparan.",
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
            <span className="eyebrow-plain">Gerbang penerimaan data</span>
            <h2 className="mt-2.5 text-[18px] font-semibold tracking-[-0.03em]">Syarat yang harus lolos</h2>
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
                Baris tidak valid disimpan dengan <span className="font-mono">validation_status=invalid</span> dan daftar
                galat, lalu dikecualikan dari grafik dan analitik. Baris tersebut tidak pernah dihapus diam-diam.
              </CaveatNote>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="eyebrow-plain">Model & silsilah data</span>
              <h2 className="mt-2.5 text-[18px] font-semibold tracking-[-0.03em]">
                {model?.training_dataset ?? "Dataset pelatihan belum terdaftar"}
              </h2>
            </div>
            <SourceBadge kind="historical" />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Lineage label="Periode pelatihan" value="2022–2024 (pemisahan kronologis)" />
            <Lineage label="Stasiun" value="51002 SW Hawaii · 41010 Canaveral East" />
            <Lineage label="Baris validasi" value={metrics?.validation_rows?.toLocaleString("en-GB") ?? "—"} />
            <Lineage
              label="Laju penandaan validasi terpasang"
              value={
                metrics?.flagged_rate_validation_at_deployed_threshold !== undefined
                  ? `${(metrics.flagged_rate_validation_at_deployed_threshold * 100).toFixed(2)}%`
                  : "—"
              }
            />
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-muted">
            Ambang operasi dikalibrasi pada {calibration?.windows ?? 90} jendela skenario normal
            ({(calibration?.target_false_alarm_rate ?? 0.1) * 100}% laju penandaan target). Pada irisan
            validasi NDBC nyata, ambang terpasang menandai{" "}
            {metrics?.flagged_rate_validation_at_deployed_threshold !== undefined
              ? `${(metrics.flagged_rate_validation_at_deployed_threshold * 100).toFixed(2)}%`
              : "sebagian kecil"}{" "}
            baris — jejak perbedaan domain antara data latih laut lepas dan telemetri pesisir.
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
              Kartu model di ruang kerja AI <ArrowUpRight className="h-3 w-3" aria-hidden />
            </Link>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-[15px] font-semibold tracking-[-0.02em]">Permukaan API publik</h2>
            <p className="mt-0.5 text-[11px] text-muted">
              Jalur dasar <span className="font-mono text-ink">{API_BASE_URL}</span> · JSON · ISO 8601 (UTC).
              Waktu pada tampilan disajikan dalam WIB. Ikon kunci menandai operasi yang memerlukan{" "}
              <span className="font-mono">X-API-Key</span>.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="border-b border-line bg-paper/70 text-[10px] font-medium text-muted">
                  <th className="px-5 py-2.5">Metode</th>
                  <th className="px-3 py-2.5">Endpoint</th>
                  <th className="px-3 py-2.5">Autentikasi</th>
                  <th className="px-5 py-2.5">Tujuan</th>
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
                          <KeyRound className="h-3 w-3" aria-hidden /> kunci
                        </span>
                      ) : (
                        <span className="text-[10px] text-muted">publik</span>
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
            <h2 className="text-[14px] font-semibold">Degradasi bertahap</h2>
            <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
              Jika Copernicus melewati batas waktu, tugas satelit ditandai{" "}
              <span className="font-mono">completed_with_fallback</span>, status penyedia menjadi{" "}
              <span className="font-mono">unavailable</span>, dan akuisisi ter-cache tetap terlihat dengan
              tanggal akuisisi aslinya. Pemantauan buoy dan analisis AI tetap berjalan karena konteks
              satelit adalah lapisan pelengkap.
            </p>
            <p className="mt-3 text-[10.5px] leading-relaxed text-muted">
              Untuk menguji jalur ini: putuskan jaringan (atau blokir host STAC), jalankan sinkronisasi,
              lalu periksa <span className="font-mono">/satellite/jobs/&#123;id&#125;</span> dan halaman ini.
              Katalog dataset harus tetap terisi.
            </p>
          </div>

          <div className="card p-6">
            <h2 className="text-[14px] font-semibold">Tata letak penyimpanan</h2>
            <ul className="mt-3 divide-y divide-line border-y border-line text-[11.5px] leading-relaxed text-muted">
              <li className="py-2.5">
                Tabel relasional untuk zona, perangkat, sesi, observasi, dataset, tugas, model,
                prediksi, peringatan, dan status sumber.
              </li>
              <li className="py-2.5">
                Geometri dalam SRID 4326: PostGIS POINT/MULTIPOLYGON di produksi, teks WKT pada mode SQLite lokal.
              </li>
              <li className="py-2.5">
                JPEG pratinjau di-cache di <span className="font-mono">data/satellite/</span>; hanya URI dan
                metadata yang berada di basis data.
              </li>
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusPill tone={health.data?.demo_mode ? "warn" : "ok"}>
                Kunci operator {health.data?.demo_mode ? "aktif" : "nonaktif"}
              </StatusPill>
              <span className="chip">Model terbaru {model?.trained_at ? formatWib(model.trained_at) : "—"}</span>
            </div>
          </div>
        </div>

        {provider.data?.last_error ? (
          <div className="flex gap-2 rounded-[12px] border border-amber/25 bg-amber-soft/60 px-5 py-4 text-[11.5px] leading-relaxed text-amber">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            Galat penyedia satelit terakhir: {provider.data.last_error}
          </div>
        ) : null}

        <p className="text-[10px] leading-relaxed text-muted">
          Laju yang ditampilkan berasal dari basis data saat ini. Kesegaran yang dihitung memakai waktu
          server dalam UTC, lalu ditampilkan dalam WIB.
          {sources.data ? ` Cuplikan ${formatWib(sources.data.generated_at)}.` : ""}
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
        <StatusPill tone={statusTone(status)}>{enumLabel(status)}</StatusPill>
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

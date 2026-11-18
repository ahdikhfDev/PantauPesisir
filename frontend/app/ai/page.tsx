"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  BrainCircuit,
  CheckCircle2,
  Database,
  History,
  Play,
  SlidersHorizontal,
  Sparkles,
  Target,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  ApiKeyField,
  CaveatNote,
  EmptyState,
  ErrorState,
  InlineSpinner,
  KeyValue,
  PageHero,
  RiskBadge,
  SourceBadge,
  StatusPill,
} from "@/components/ui";
import { ApiError, apiSend } from "@/lib/api";
import { cn, fixed, formatShortUtc, formatUtc, percent } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { useApiKey } from "@/lib/use-api-key";
import type { ModelInfo, Prediction, Zone } from "@/lib/types";

const WINDOWS = [30, 60, 120, 240];

interface MetricsShape {
  training_rows?: number;
  validation_rows?: number;
  flagged_rate_validation_at_deployed_threshold?: number;
  threshold_calibration?: { target_false_alarm_rate?: number; windows?: number };
  proxy_evaluation?: {
    recall_top5pct_pressure_change?: number;
    recall_top5pct_wave_height_change?: number;
    random_selection_baseline?: number;
    method?: string;
  };
  train_period?: [string, string];
}

export default function AiPage() {
  const [apiKey, setApiKey] = useApiKey();
  const [zoneCode, setZoneCode] = useState("JKT-BAY");
  const [windowMinutes, setWindowMinutes] = useState(60);
  const [createAlert, setCreateAlert] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<Prediction | null>(null);

  const zones = useApi<Zone[]>("/coastal/zones");
  const modelInfo = useApi<ModelInfo>("/analytics/model-info");
  const history = useApi<Prediction[]>("/analytics/history?limit=8", 30000);

  useEffect(() => {
    if (history.data?.length && !prediction) setPrediction(history.data[0]);
    if (!history.data?.length) {
      // A fresh install: show the latest prediction if one exists.
      fetchLatest().catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history.data]);

  const metrics = (modelInfo.data?.metrics ?? {}) as MetricsShape;
  const calibration = metrics.threshold_calibration;

  const run = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await apiSend<{ prediction: Prediction; acceptance_note: string }>(
        "/analytics/run",
        "POST",
        { zone_code: zoneCode, window_minutes: windowMinutes, create_alert: createAlert },
        apiKey,
      );
      setPrediction(response.prediction);
      setNotice(
        response.prediction.alert_id
          ? "Analisis selesai. Pemberitahuan baru ditambahkan ke halaman Peringatan warga."
          : "Analisis selesai. Kondisi belum melewati ambang pemberitahuan.",
      );
      history.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : err instanceof Error ? err.message : "Analisis gagal");
    } finally {
      setBusy(false);
    }
  };

  const openHistorical = async (id: string) => {
    try {
      const response = await fetch(
        `${(process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1").replace(/\/$/, "")}/analytics/${id}`,
        { cache: "no-store" },
      );
      if (!response.ok) return;
      setPrediction((await response.json()) as Prediction);
      setNotice("Analisis tersimpan dimuat dari basis data.");
    } catch {
      /* keep the current view */
    }
  };

  async function fetchLatest() {
    try {
      const response = await fetch(
        `${(process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1").replace(/\/$/, "")}/analytics/latest`,
        { cache: "no-store" },
      );
      if (response.ok) setPrediction((await response.json()) as Prediction);
    } catch {
      /* no analysis yet */
    }
  }

  const quality = prediction?.data_quality_summary as
    | {
        observation_count?: number;
        median_sampling_seconds?: number;
        simulated_share?: number;
        satellite_alignment?: { matched_pairs?: unknown[]; unmatched_satellite_dataset_ids?: string[] };
      }
    | null
    | undefined;

  return (
    <>
      <PageHero
        eyebrow="Intelijen risiko AI"
        title={
          <>
            Penyaringan, <span className="text-signal">sebelum membesar.</span>
          </>
        }
        description="Isolation Forest yang dilatih pada observasi NOAA NDBC asli memberi skor seberapa tidak biasa jendela terbaru. Rubrik terpisah yang mudah dibaca menilai keparahan absolut. Kedua lapisan ditampilkan — beserta input, versi, dan catatannya — agar setiap skor dapat ditelusuri."
        right={
          <div className="flex flex-col items-start gap-2 lg:items-end">
            <SourceBadge kind="model" />
            <span className="chip border-line-strong">
              {modelInfo.data?.model_version ?? "memuat model"}
            </span>
            <StatusPill tone={modelInfo.data ? "ok" : "neutral"}>
              {calibration?.target_false_alarm_rate
                ? `${percent(calibration.target_false_alarm_rate)} laju penandaan terkalibrasi`
                : "memuat kalibrasi"}
            </StatusPill>
          </div>
        }
      />

      <div className="space-y-6">
        <div className="grid gap-5 xl:grid-cols-[1fr_1.05fr]">
          {/* model card */}
          <div className="card p-6">
            <span className="eyebrow-plain">Ringkasan kartu model</span>
            <h2 className="mt-2 text-[19px] font-semibold">
              {modelInfo.data?.model_name ?? "pantaupesisir-anomaly-isolation-forest"}
            </h2>

            <dl className="mt-4 divide-y divide-line">
              <KeyValue label="Algoritma" value={modelInfo.data?.algorithm ?? "IsolationForest"} />
              <KeyValue
                label="Data latih"
                value={
                  <span className="text-[11px] leading-snug">
                    NOAA NDBC stdmet · stasiun 51002 &amp; 41010 · 2022–2024
                  </span>
                }
              />
              <KeyValue
                label="Baris data latih"
                value={metrics.training_rows ? metrics.training_rows.toLocaleString("en-GB") : "41,104"}
              />
              <KeyValue
                label="Laju penandaan aktif"
                value={
                  metrics.flagged_rate_validation_at_deployed_threshold !== undefined
                    ? percent(metrics.flagged_rate_validation_at_deployed_threshold)
                    : "—"
                }
              />
              <KeyValue
                label="Jendela kalibrasi"
                value={calibration?.windows ? `${calibration.windows} skenario normal` : "90 skenario normal"}
              />
              <KeyValue
                label="Fitur"
                value={`${modelInfo.data?.feature_schema.length ?? 11} fitur bergulir`}
              />
            </dl>

            <div className="mt-4 flex flex-wrap gap-2">
              <SourceBadge kind="historical" />
              <span className="chip">Tanpa label bahaya</span>
              <span className="chip">Tanpa pengawasan</span>
            </div>

            <div className="mt-4 border-t border-line pt-3.5">
              <p className="text-[10px] font-semibold text-muted">Proksi evaluasi</p>
              <p className="mt-1.5 text-[11px] leading-relaxed text-ink-soft">
                {metrics.proxy_evaluation?.method ??
                  "Penandaan diperiksa konsentrasinya pada perubahan tekanan dan tinggi gelombang yang cepat di irisan validasi nyata."}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-x-4 text-[10.5px]">
                <div className="flex items-baseline justify-between gap-3 border-t border-line pt-2">
                  <p className="text-muted">Recall perubahan tekanan</p>
                  <p className="metric text-[13px] font-medium">
                    {metrics.proxy_evaluation?.recall_top5pct_pressure_change !== undefined
                      ? percent(metrics.proxy_evaluation.recall_top5pct_pressure_change)
                      : "—"}
                  </p>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-t border-line pt-2">
                  <p className="text-muted">Baseline acak</p>
                  <p className="metric text-[13px] font-medium">
                    {metrics.proxy_evaluation?.random_selection_baseline !== undefined
                      ? percent(metrics.proxy_evaluation.random_selection_baseline)
                      : "—"}
                  </p>
                </div>
              </div>
            </div>

            <ul className="mt-4 space-y-2">
              {(modelInfo.data?.limitations ?? []).map((limitation) => (
                <li key={limitation} className="flex gap-2 text-[11px] leading-relaxed text-muted">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber" aria-hidden />
                  {limitation}
                </li>
              ))}
            </ul>
          </div>

          {/* run panel */}
          <div className="card p-6">
            <span className="eyebrow-plain">Jalankan analisis</span>
            <h2 className="mt-2 text-[19px] font-semibold">Saring jendela</h2>
            <p className="mt-1 max-w-md text-[11.5px] leading-relaxed text-muted">
              Pilih zona dan jendela. API memuat observasi valid tersimpan, memberi skor, menyelaraskan
              rekaman satelit tersinggah, dan menulis baris analisis baru.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="ai-zone">
                  Zona
                </label>
                <select id="ai-zone" className="input" value={zoneCode} onChange={(event) => setZoneCode(event.target.value)}>
                  {(zones.data ?? []).map((zone) => (
                    <option key={zone.zone_code} value={zone.zone_code}>
                      {zone.zone_name} ({zone.zone_code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className="label">Jendela observasi</span>
                <div className="flex rounded-[10px] border border-line-strong bg-white p-1">
                  {WINDOWS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setWindowMinutes(value)}
                      className={cn(
                        "flex-1 rounded-lg px-1 py-1.5 text-[11px] font-semibold transition",
                        windowMinutes === value ? "bg-paper text-ink" : "text-muted hover:text-ink",
                      )}
                      aria-pressed={windowMinutes === value}
                    >
                      {value}m
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <label className="mt-3 flex items-start gap-2.5 rounded-[10px] border border-line bg-paper/60 px-3.5 py-3">
              <input
                type="checkbox"
                checked={createAlert}
                onChange={(event) => setCreateAlert(event.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 accent-sea"
              />
              <span className="text-[11.5px] leading-relaxed text-ink-soft">
                Tambahkan pemberitahuan warga saat risiko mencapai sedang atau tinggi.
                <span className="mt-0.5 block text-[10px] text-muted">
                  Peringatan dapat dikonfirmasi di ruang kerja peringatan.
                </span>
              </span>
            </label>

            <ApiKeyField value={apiKey} onChange={setApiKey} className="mt-3" />

            <button type="button" onClick={run} disabled={busy} className="btn btn-primary mt-4 w-full">
              {busy ? <InlineSpinner label="Memberi skor jendela…" /> : <Play className="h-4 w-4" aria-hidden />}
              Jalankan analisis AI
            </button>

            {error ? (
              <div className="mt-3 rounded-[10px] border border-signal/25 bg-signal-soft px-3.5 py-3 text-[11.5px] leading-relaxed text-signal-dark">
                {error}
                {error.toLowerCase().includes("observation") ? (
                  <span className="mt-1 block text-[10.5px]">
                    Hasilkan telemetri di konsol laut terlebih dahulu, atau perlebar jendela.
                  </span>
                ) : null}
              </div>
            ) : null}
            {notice ? (
              <div className="mt-3 flex gap-2 rounded-[10px] border border-sea/15 bg-sea-soft/70 px-3.5 py-3 text-[11.5px] leading-relaxed text-sea">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                {notice}
              </div>
            ) : null}

            <div className="mt-4 flex items-start gap-2.5 rounded-[10px] border border-line bg-paper/70 px-3.5 py-3">
              <SlidersHorizontal className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
              <p className="text-[10.5px] leading-relaxed text-muted">
                Tingkat risiko berasal dari rubrik transparan (<span className="font-mono">rubrik_risiko_v1</span>)
                menggunakan tinggi gelombang absolut, angin, penurunan tekanan, dan periode.
              </p>
            </div>
          </div>
        </div>

        {/* result */}
        {prediction ? (
          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper/50 px-6 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <RiskBadge level={prediction.risk_level} />
                <span className="chip">{prediction.zone_code}</span>
                <span className="chip">{prediction.windows_evaluated} jendela diskor</span>
                {prediction.alert_id ? (
                  <Link href="/alerts" className="chip border-signal/25 bg-signal-soft text-signal-dark">
                    Peringatan dibuka <ArrowUpRight className="h-3 w-3" aria-hidden />
                  </Link>
                ) : null}
              </div>
              <span className="font-mono text-[9.5px] text-muted">
                analisis {prediction.id.slice(0, 8)} · {formatUtc(prediction.created_at)}
              </span>
            </div>

            <div className="grid gap-6 p-6 lg:grid-cols-[0.85fr_1.15fr]">
              <div>
                <p className="text-[10px] font-semibold text-muted">Indeks anomali</p>
                <p className="mt-1.5 flex items-baseline gap-2">
                  <span className="metric text-[38px] font-medium leading-none">
                    {fixed(prediction.anomaly_score, 2)}
                  </span>
                  <span className="text-[10.5px] text-muted">
                    {prediction.anomaly_detected ? "ditandai" : "dalam rentang"}
                  </span>
                </p>
                <div className="relative mt-4 h-[5px] rounded-full bg-line">
                  <div
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-full",
                      prediction.anomaly_detected ? "bg-signal" : "bg-sea",
                    )}
                    style={{ width: `${Math.min(Math.max(prediction.anomaly_score, 0), 1) * 100}%` }}
                  />
                  <span
                    className="absolute -top-[3px] h-[11px] w-[2px] bg-ink"
                    style={{ left: `${Math.min(Math.max(prediction.anomaly_threshold, 0), 1) * 100}%` }}
                    aria-hidden
                  />
                </div>
                <div className="mt-1.5 flex items-baseline justify-between text-[9.5px] text-muted">
                  <span className="metric">0.00</span>
                  <span>
                    ambang <span className="metric">{fixed(prediction.anomaly_threshold, 2)}</span>
                  </span>
                  <span className="metric">1.00</span>
                </div>

                <div className="mt-5">
                  <div className="flex items-center justify-between text-[10px] font-semibold text-muted">
                    <span>Skor risiko</span>
                    <span className="metric">{fixed(prediction.risk_score, 1)}/100</span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-line">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        prediction.risk_level === "high"
                          ? "bg-signal"
                          : prediction.risk_level === "moderate"
                            ? "bg-amber"
                            : "bg-ok",
                      )}
                      style={{ width: `${prediction.risk_score ?? 0}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-[10px] text-muted">
                    Metode <span className="font-mono">{prediction.risk_method ?? "rubrik_risiko_v1"}</span>
                  </p>
                </div>

                <dl className="mt-5 divide-y divide-line border-t border-line pt-2">
                  <KeyValue label="Versi model" value={<span className="font-mono text-[10px]">{prediction.model_version}</span>} />
                  <KeyValue label="Awal jendela" value={formatShortUtc(prediction.observation_window_start)} />
                  <KeyValue label="Akhir jendela" value={formatShortUtc(prediction.observation_window_end)} />
                  <KeyValue label="Observasi" value={prediction.input_observation_count} />
                  <KeyValue
                    label="Sampling median"
                    value={
                      quality?.median_sampling_seconds
                        ? `${fixed(quality.median_sampling_seconds / 60, 0)} min`
                        : "—"
                    }
                  />
                  <KeyValue
                    label="Kecocokan satelit"
                    value={`${quality?.satellite_alignment?.matched_pairs?.length ?? 0} pasangan`}
                  />
                  <KeyValue label="Asal input" value={prediction.is_simulated ? "Telemetri buoy" : "Campuran"} />
                </dl>
              </div>

              <div>
                <h3 className="text-[10px] font-semibold text-muted">Penjelasan</h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft">{prediction.explanation}</p>

                <h3 className="mt-5 text-[10px] font-semibold text-muted">Faktor kontributor</h3>
                <ul className="mt-2 divide-y divide-line border-y border-line">
                  {prediction.contributing_factors.map((factor) => {
                    const magnitude = Math.min(Math.abs(factor.deviation_sigma) / 4, 1);
                    const anomalous = factor.deviation_sigma > 0;
                    return (
                      <li key={factor.feature} className="py-2.5">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="text-[11.5px] text-ink-soft">{factor.label}</p>
                          <p className="metric text-[11px] text-muted">
                            {fixed(factor.value, 2)} {factor.unit}
                            <span className="ml-2 text-[10px]">
                              {factor.deviation_sigma > 0 ? "+" : ""}
                              {fixed(factor.deviation_sigma, 2)}σ
                            </span>
                          </p>
                        </div>
                        <div className="mt-1.5 h-1 rounded-full bg-line">
                          <div
                            className={cn("h-full rounded-full", anomalous ? "bg-signal" : "bg-sea")}
                            style={{ width: `${Math.max(magnitude * 100, 3)}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                  {prediction.contributing_factors.length === 0 ? (
                    <li className="py-2.5 text-[12px] text-muted">
                      Tidak ada faktor individual yang melampaui ambang pelaporan.
                    </li>
                  ) : null}
                </ul>
                <p className="mt-2 text-[9.5px] leading-relaxed text-muted">
                  Deviasi diukur terhadap baseline data latih untuk fitur yang sama. σ adalah
                  jarak terstandardisasi dari baseline model.
                </p>

                <div
                  className={cn(
                    "mt-5 rounded-[10px] border p-4",
                    prediction.risk_level === "high"
                      ? "border-signal/25 bg-signal-soft/70"
                      : prediction.risk_level === "moderate"
                        ? "border-amber/25 bg-amber-soft/70"
                        : "border-ok/20 bg-ok-soft/60",
                  )}
                >
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold text-ink">
                    <Target className="h-3 w-3" aria-hidden /> Rekomendasi operasional
                  </p>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-ink-soft">{prediction.recommendation}</p>
                </div>
              </div>
            </div>

            <div className="border-t border-line bg-paper/40 px-6 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <SourceBadge kind="model" />
                <SourceBadge kind={prediction.is_simulated ? "simulated" : "observed"} />
                <span className="text-[10.5px] text-muted">
                  Keluaran model diturunkan dari telemetri buoy tervalidasi.
                </span>
              </div>
              <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {prediction.caveats.map((caveat) => (
                  <li key={caveat} className="flex gap-1.5 text-[10px] leading-relaxed text-muted">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber" aria-hidden />
                    {caveat}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : history.loading ? (
          <div className="skeleton h-[320px] rounded-[14px]" />
        ) : history.error ? (
          <ErrorState message={history.error} onRetry={history.refresh} />
        ) : (
          <EmptyState
            title="Belum ada analisis tersimpan"
            description="Kirim batch telemetri di konsol laut, lalu saring jendela di sini. API akan menolak jendela kosong daripada mengarang hasil."
            action={
              <Link href="/ocean#simulator" className="btn btn-primary btn-sm">
                <Database className="h-3.5 w-3.5" aria-hidden /> Hasilkan telemetri dahulu
              </Link>
            }
          />
        )}

        {/* history */}
        <section>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className="eyebrow">Riwayat analisis</span>
              <h2 className="mt-3 text-[22px] font-semibold tracking-[-0.035em]">Eksekusi model terbaru</h2>
              <p className="mt-1 text-[12px] text-muted">
                Tersimpan di PostgreSQL/SQLite dengan versi model, jendela, dan ID observasi.
              </p>
            </div>
            <span className="chip">
              <History className="h-3 w-3" aria-hidden /> {history.data?.length ?? 0} eksekusi
            </span>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {(history.data ?? []).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openHistorical(item.id)}
                className={cn(
                  "card card-hover p-4 text-left",
                  prediction?.id === item.id ? "border-ink" : undefined,
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="chip">{item.zone_code}</span>
                  <RiskBadge level={item.risk_level} />
                </div>
                <p className="mt-3 text-[12px] font-semibold">{formatShortUtc(item.created_at)} UTC</p>
                <div className="mt-2 flex items-center justify-between text-[10.5px] text-muted">
                  <span className="metric">anomali {fixed(item.anomaly_score, 2)}</span>
                  <span className="metric">risiko {fixed(item.risk_score, 0)}</span>
                </div>
              </button>
            ))}
            {history.data?.length === 0 ? (
              <p className="text-[12px] text-muted">Belum ada eksekusi.</p>
            ) : null}
          </div>
        </section>
      </div>
    </>
  );
}



"use client";

import { Activity, CircleStop, Play, Radar, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { CaveatNote, InlineSpinner, StatusPill } from "@/components/ui";
import { ACTIVITIES } from "@/lib/coastal";
import { ApiError, DEMO_API_KEY, apiSend } from "@/lib/api";
import { cn, enumLabel, formatWib } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { SimulationJob, SimulatorStatus, Zone } from "@/lib/types";

const SCENARIOS = [
  { value: "normal", label: "Normal", copy: "Dasar tenang" },
  { value: "warning", label: "Waspada", copy: "Gelombang menguat" },
  { value: "extreme", label: "Ekstrem", copy: "Eskalasi cepat" },
] as const;

export function SimulatorPanel({
  zones,
  zoneCode,
  onZoneChange,
  onCompleted,
}: {
  zones: Zone[];
  zoneCode: string;
  onZoneChange: (zoneCode: string) => void;
  onCompleted: () => void;
}) {
  const apiKey = DEMO_API_KEY;
  const [scenario, setScenario] = useState<"normal" | "warning" | "extreme">("warning");
  const [mode, setMode] = useState<"manual" | "auto">("manual");
  const [interval, setIntervalSeconds] = useState(300);
  const [count, setCount] = useState(12);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [acceptance, setAcceptance] = useState<string | null>(null);
  const completedRef = useRef<string | null>(null);

  const status = useApi<SimulatorStatus>("/simulator/status", 8000);
  const job = useApi<SimulationJob>(jobId ? `/simulator/jobs/${jobId}` : null, 1500);

  useEffect(() => {
    if (!job.data) return;
    if (job.data.status === "completed" || job.data.status === "failed") {
      if (completedRef.current !== job.data.id) {
        completedRef.current = job.data.id;
        setNotice(
          job.data.status === "completed"
            ? `${job.data.observations_count} observasi tersimpan untuk ${job.data.zone_code}.`
            : `Batch gagal: ${job.data.notes ?? "lihat log server"}.`,
        );
        if (job.data.status === "completed") {
          onCompleted();
          // Panaskan ringkasan warga untuk zona ini supaya Kabar Laut langsung siap
          // dibuka setelah operator mengirim batch.
          const zoneCode = job.data.zone_code;
          if (zoneCode) {
            for (const item of ACTIVITIES) {
              void fetch(`/api/ringkasan?zone=${encodeURIComponent(zoneCode)}&activity=${item.key}`, {
                cache: "no-store",
              }).catch(() => undefined);
            }
          }
        }
        void status.refresh();
      }
    }
  }, [job.data, onCompleted, status]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = await apiSend<{ job: SimulationJob; acceptance_note: string }>(
        "/simulator/scenarios",
        "POST",
        {
          zone_code: zoneCode,
          scenario,
          mode,
          interval_seconds: interval,
          observations: count,
        },
        apiKey,
      );
      setAcceptance(response.acceptance_note);
      setJobId(response.job.id);
      completedRef.current = null;
      void status.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : err instanceof Error ? err.message : "Permintaan gagal");
    } finally {
      setBusy(false);
    }
  };

  const stopAuto = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiSend<SimulatorStatus>("/simulator/stop", "POST", {}, apiKey);
      setNotice("Umpan otomatis dihentikan.");
      await status.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Umpan otomatis tidak dapat dihentikan");
    } finally {
      setBusy(false);
    }
  };

  const tickNow = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiSend<Record<string, unknown>>("/simulator/tick", "POST", {}, apiKey);
      setNotice("Satu tick otomatis dihasilkan.");
      onCompleted();
      await status.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Tick gagal");
    } finally {
      setBusy(false);
    }
  };

  const autoRunning = status.data?.running ?? false;

  return (
    <div className="card grid overflow-hidden lg:grid-cols-[1.05fr_0.95fr]">
      <div className="p-6 sm:p-7">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="eyebrow-plain">Kontrol operator</span>
            <h2 className="mt-3 text-[20px] font-semibold tracking-[-0.03em]">Kirim batch telemetri</h2>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
              Setiap pembacaan divalidasi saat masuk dan ditandai dengan sesi ingestion-nya.
            </p>
          </div>
          <StatusPill tone={autoRunning ? "ok" : "neutral"}>
            {autoRunning ? "Otomatis berjalan" : "Otomatis menganggur"}
          </StatusPill>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {SCENARIOS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setScenario(item.value)}
              className={cn(
                "rounded-[12px] border px-3.5 py-3 text-left transition",
                scenario === item.value
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-white text-ink hover:border-line-strong",
              )}
              aria-pressed={scenario === item.value}
            >
              <span className="block text-[12px] font-semibold">{item.label}</span>
              <span
                className={cn(
                  "mt-0.5 block text-[10px]",
                  scenario === item.value ? "text-white/60" : "text-muted",
                )}
              >
                {item.copy}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="sim-zone">
              Zona
            </label>
            <select
              id="sim-zone"
              className="input"
              value={zoneCode}
              onChange={(event) => onZoneChange(event.target.value)}
            >
              {zones.map((zone) => (
                <option key={zone.zone_code} value={zone.zone_code}>
                  {zone.zone_name} ({zone.zone_code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <span className="label">Mode</span>
            <div className="flex rounded-[10px] border border-line-strong bg-white p-1">
              {(["manual", "auto"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  className={cn(
                    "flex-1 rounded-lg px-2 py-1.5 text-[11px] font-semibold capitalize transition",
                    mode === value ? "bg-paper text-ink" : "text-muted hover:text-ink",
                  )}
                  aria-pressed={mode === value}
                >
                  {value === "manual" ? "Batch manual" : "Umpan otomatis"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label" htmlFor="sim-interval">
              Interval (detik)
            </label>
            <input
              id="sim-interval"
              className="input"
              type="number"
              min={5}
              max={3600}
              step={5}
              value={interval}
              onChange={(event) => setIntervalSeconds(Number(event.target.value) || 60)}
            />
          </div>
          <div>
            <label className="label" htmlFor="sim-count">
              Observasi (batch manual)
            </label>
            <input
              id="sim-count"
              className="input"
              type="number"
              min={1}
              max={240}
              value={count}
              onChange={(event) => setCount(Number(event.target.value) || 1)}
              disabled={mode === "auto"}
            />
          </div>
        </div>

        <p className="mt-4 flex items-center gap-1.5 text-[10px] text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-ok" aria-hidden /> Mode demo — kontrol operator aktif.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={submit} disabled={busy} className="btn btn-primary btn-sm">
            {busy ? <InlineSpinner label="Mengirim…" /> : <Play className="h-3.5 w-3.5" aria-hidden />}
            {mode === "manual" ? "Kirim batch" : "Mulai umpan otomatis"}
          </button>
          <button type="button" onClick={tickNow} disabled={busy} className="btn btn-ghost btn-sm">
            <Activity className="h-3.5 w-3.5" aria-hidden /> Kirim satu pembacaan
          </button>
          <button type="button" onClick={stopAuto} disabled={busy || !autoRunning} className="btn btn-ghost btn-sm">
            {autoRunning ? <CircleStop className="h-3.5 w-3.5" aria-hidden /> : <Square className="h-3.5 w-3.5" aria-hidden />}
            Hentikan otomatis
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-[10px] border border-signal/25 bg-signal-soft px-3.5 py-3 text-[12px] text-signal-dark">
            {error}
            {error.toLowerCase().includes("api key") || error.includes("401") ? (
              <span className="mt-1 block text-[11px] text-signal-dark/80">
                Kunci operator: <code className="font-mono">pantaupesisir-demo-2026</code>. Tempelkan di
                atas lalu coba lagi.
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="border-t border-line bg-paper/70 p-6 sm:p-7 lg:border-l lg:border-t-0">
        <h3 className="text-[10px] font-semibold text-muted">Yang terjadi berikutnya</h3>
        <ol className="mt-3 divide-y divide-line border-t border-line">
          {[
            "Gateway mengirim pembacaan yang konsisten dengan kunci idempotensi.",
            "Batch manual menggantikan pembacaan sebelumnya dalam jendela pemutarannya.",
            "FastAPI memvalidasi rentang, unit, asal data, dan duplikat.",
            "Baris valid disimpan; yang tidak valid tetap dicatat dengan jejak audit.",
            "Grafik, kualitas data, dan analisis AI disegarkan dari database.",
          ].map((step, index) => (
            <li key={step} className="flex gap-3 py-2.5">
              <span className="metric mt-[2px] shrink-0 text-[9.5px] text-muted">
                {String(index + 1).padStart(2, "0")}
              </span>
              <p className="text-[12px] leading-relaxed text-ink-soft">{step}</p>
            </li>
          ))}
        </ol>

        {acceptance ? (
          <p className="mt-4 border-l-2 border-l-sea py-1 pl-3 text-[11px] leading-relaxed text-ink-soft">
            {acceptance}
          </p>
        ) : null}

        <div className="mt-5">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold text-muted">
            <Radar className="h-3 w-3" aria-hidden /> Status pekerjaan
          </p>
          {job.data ? (
            <>
              <div className="flex items-center justify-between gap-3 border-t border-line py-1.5 text-[12px] first:border-t-0">
                <span className="text-muted">Profil kondisi</span>
                <span className="font-semibold capitalize">{enumLabel(job.data.scenario)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-line py-1.5 text-[12px]">
                <span className="text-muted">Status</span>
                <StatusPill
                  tone={
                    job.data.status === "completed"
                      ? "ok"
                      : job.data.status === "failed"
                        ? "bad"
                        : "warn"
                  }
                >
                  {enumLabel(job.data.status)}
                </StatusPill>
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-line py-1.5 text-[12px]">
                <span className="text-muted">Observasi</span>
                <span className="metric font-semibold">{job.data.observations_count}</span>
              </div>
              <p className="mt-2 font-mono text-[9px] text-line-strong">{job.data.id}</p>
            </>
          ) : (
            <p className="text-[11px] leading-relaxed text-muted">
              Belum ada batch yang dikirim di tab ini. Status umpan saat ini ditampilkan di samping.
            </p>
          )}
        </div>

        {notice ? (
          <p className="mt-3 text-[11px] font-medium text-ink-soft">{notice}</p>
        ) : null}

        {status.data?.last_tick_at ? (
          <p className="mt-3 text-[10px] text-muted">Tick otomatis terakhir {formatWib(status.data.last_tick_at)}</p>
        ) : null}

        <div className="mt-4">
          <CaveatNote>
            Nilai mengikuti profil kondisi yang dipilih dan tercatat pada setiap batch telemetri.
          </CaveatNote>
        </div>
      </div>
    </div>
  );
}

"use client";

import { Activity, CircleStop, Play, Radar, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ApiKeyField, CaveatNote, InlineSpinner, StatusPill } from "@/components/ui";
import { ApiError, apiSend } from "@/lib/api";
import { cn, formatUtc } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { useApiKey } from "@/lib/use-api-key";
import type { SimulationJob, SimulatorStatus, Zone } from "@/lib/types";

const SCENARIOS = [
  { value: "normal", label: "Normal", copy: "Calm baseline" },
  { value: "warning", label: "Warning", copy: "Building sea" },
  { value: "extreme", label: "Extreme", copy: "Rapid escalation" },
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
  const [apiKey, setApiKey] = useApiKey();
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
            ? `${job.data.observations_count} synthetic observation(s) stored for ${job.data.zone_code}.`
            : `Scenario failed: ${job.data.notes ?? "see server logs"}.`,
        );
        if (job.data.status === "completed") onCompleted();
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
      setError(err instanceof ApiError ? err.detail : err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  const stopAuto = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiSend<SimulatorStatus>("/simulator/stop", "POST", {}, apiKey);
      setNotice("Automatic simulator stopped.");
      await status.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Could not stop the simulator");
    } finally {
      setBusy(false);
    }
  };

  const tickNow = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiSend<Record<string, unknown>>("/simulator/tick", "POST", {}, apiKey);
      setNotice("One automatic tick generated.");
      onCompleted();
      await status.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Tick failed");
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
            <span className="eyebrow-plain">Demo simulator</span>
            <h2 className="mt-3 text-[20px] font-extrabold tracking-[-0.03em]">Generate a scenario</h2>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
              Every reading is synthetic, validated on ingestion and tagged with its simulation session.
            </p>
          </div>
          <StatusPill tone={autoRunning ? "ok" : "neutral"}>
            {autoRunning ? "Auto running" : "Auto idle"}
          </StatusPill>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {SCENARIOS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setScenario(item.value)}
              className={cn(
                "rounded-2xl border px-3.5 py-3 text-left transition",
                scenario === item.value
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-white text-ink hover:border-line-strong",
              )}
              aria-pressed={scenario === item.value}
            >
              <span className="block text-[12px] font-extrabold">{item.label}</span>
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
              Zone
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
            <div className="flex rounded-xl border border-line-strong bg-white p-1">
              {(["manual", "auto"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  className={cn(
                    "flex-1 rounded-lg px-2 py-1.5 text-[11px] font-bold capitalize transition",
                    mode === value ? "bg-paper text-ink" : "text-muted hover:text-ink",
                  )}
                  aria-pressed={mode === value}
                >
                  {value === "manual" ? "Burst" : "Auto feed"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label" htmlFor="sim-interval">
              Interval (seconds)
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
              Observations (burst only)
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

        <ApiKeyField value={apiKey} onChange={setApiKey} className="mt-4" />

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={submit} disabled={busy} className="btn btn-primary btn-sm">
            {busy ? <InlineSpinner label="Submitting…" /> : <Play className="h-3.5 w-3.5" aria-hidden />}
            {mode === "manual" ? "Generate burst" : "Start auto feed"}
          </button>
          <button type="button" onClick={tickNow} disabled={busy} className="btn btn-ghost btn-sm">
            <Activity className="h-3.5 w-3.5" aria-hidden /> Force tick
          </button>
          <button type="button" onClick={stopAuto} disabled={busy || !autoRunning} className="btn btn-ghost btn-sm">
            {autoRunning ? <CircleStop className="h-3.5 w-3.5" aria-hidden /> : <Square className="h-3.5 w-3.5" aria-hidden />}
            Stop auto
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-signal/25 bg-signal-soft px-3.5 py-3 text-[12px] text-signal-dark">
            {error}
            {error.toLowerCase().includes("api key") || error.includes("401") ? (
              <span className="mt-1 block text-[11px] text-signal-dark/80">
                The documented demo key is <code className="font-mono">cews-demo-2026</code>. Paste it
                above and retry.
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="border-t border-line bg-paper/70 p-6 sm:p-7 lg:border-l lg:border-t-0">
        <h3 className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-muted">What happens next</h3>
        <ol className="mt-4 space-y-4">
          {[
            "The simulator posts coherent readings with an idempotency key.",
            "A manual burst replaces earlier synthetic readings in its replay window.",
            "FastAPI validates ranges, units, provenance and duplicates.",
            "Valid rows are stored; invalid ones are kept with an audit trail.",
            "Charts, data quality and AI analysis refresh from the database.",
          ].map((step, index) => (
            <li key={step} className="flex gap-3">
              <span className="metric mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-line bg-white text-[9px] font-semibold text-muted">
                {index + 1}
              </span>
              <p className="text-[12px] leading-relaxed text-ink-soft">{step}</p>
            </li>
          ))}
        </ol>

        {acceptance ? (
          <p className="mt-5 rounded-xl border border-sea/15 bg-sea-soft/60 px-3.5 py-3 text-[11px] leading-relaxed text-sea">
            {acceptance}
          </p>
        ) : null}

        <div className="mt-5 space-y-2 rounded-xl border border-line bg-white p-4">
          <p className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.1em] text-muted">
            <Radar className="h-3 w-3" aria-hidden /> Job status
          </p>
          {job.data ? (
            <>
              <div className="flex items-center justify-between gap-3 text-[12px]">
                <span className="text-muted">Scenario</span>
                <span className="font-semibold capitalize">{job.data.scenario}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-[12px]">
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
                  {job.data.status}
                </StatusPill>
              </div>
              <div className="flex items-center justify-between gap-3 text-[12px]">
                <span className="text-muted">Observations</span>
                <span className="metric font-semibold">{job.data.observations_count}</span>
              </div>
              <p className="font-mono text-[9px] text-line-strong">{job.data.id}</p>
            </>
          ) : (
            <p className="text-[11px] leading-relaxed text-muted">
              No scenario has been requested in this tab yet. The current feed state is shown right.
            </p>
          )}
        </div>

        {notice ? (
          <p className="mt-3 text-[11px] font-semibold text-ok">{notice}</p>
        ) : null}

        {status.data?.last_tick_at ? (
          <p className="mt-3 text-[10px] text-muted">Last automatic tick {formatUtc(status.data.last_tick_at)}</p>
        ) : null}

        <div className="mt-4">
          <CaveatNote>
            Scenario values are synthetic. A scenario label does not mean the sea is actually dangerous;
            check official BMKG forecasts before any real-world decision.
          </CaveatNote>
        </div>
      </div>
    </div>
  );
}

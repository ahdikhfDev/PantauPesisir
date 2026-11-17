"use client";

import { BellRing, Check, ChevronDown, ChevronUp, Lock, RotateCcw } from "lucide-react";
import { useState } from "react";

import {
  ApiKeyField,
  EmptyState,
  ErrorState,
  InlineSpinner,
  PageHero,
  SeverityBadge,
  StatusPill,
} from "@/components/ui";
import { ApiError, apiSend } from "@/lib/api";
import { cn, formatUtc } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { useApiKey } from "@/lib/use-api-key";
import type { Alert, AlertList, Zone } from "@/lib/types";

const STATUS_FILTERS = [
  { value: "", label: "All statuses" },
  { value: "open", label: "Open" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "resolved", label: "Resolved" },
];

const SEVERITY_FILTERS = [
  { value: "", label: "All severities" },
  { value: "high", label: "High" },
  { value: "moderate", label: "Moderate" },
  { value: "info", label: "Info" },
];

export default function AlertsPage() {
  const [apiKey, setApiKey] = useApiKey();
  const [statusFilter, setStatusFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const zones = useApi<Zone[]>("/coastal/zones");
  const params = new URLSearchParams({ limit: "100" });
  if (statusFilter) params.set("status", statusFilter);
  if (severityFilter) params.set("severity", severityFilter);
  if (zoneFilter) params.set("zone_code", zoneFilter);
  const alerts = useApi<AlertList>(`/alerts?${params.toString()}`, 20000);

  const patchAlert = async (alert: Alert, status: "acknowledged" | "resolved" | "open") => {
    setBusy(alert.id);
    setError(null);
    setNotice(null);
    try {
      await apiSend<Alert>(
        `/alerts/${alert.id}`,
        "PATCH",
        {
          status,
          actor: "demo-operator",
          note: status === "resolved" ? "Closed after operator review in the prototype console." : undefined,
        },
        apiKey,
      );
      setNotice(
        status === "acknowledged"
          ? "Alert acknowledged with the operator identity and UTC timestamp."
          : status === "resolved"
            ? "Alert resolved. The history keeps both timestamps."
            : "Alert reopened.",
      );
      alerts.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(null);
    }
  };

  const counts = alerts.data?.counts_by_status ?? {};

  return (
    <>
      <PageHero
        eyebrow="Alert management"
        title={
          <>
            Alerts with a <span className="text-signal">paper trail.</span>
          </>
        }
        description="Every prototype alert is linked to the analysis that produced it, carries its severity and timestamps, and moves through an explicit lifecycle. Alerts never claim to be official warnings."
        right={
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone="bad">{counts.open ?? 0} open</StatusPill>
            <StatusPill tone="warn">{counts.acknowledged ?? 0} acknowledged</StatusPill>
            <StatusPill tone="ok">{counts.resolved ?? 0} resolved</StatusPill>
          </div>
        }
      />

      <div className="space-y-6">
        <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
          <div className="card p-5">
            <div className="flex flex-wrap items-center gap-2">
              {STATUS_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setStatusFilter(filter.value)}
                  className={cn(
                    "border-b px-1 pb-1.5 text-[11px] font-medium transition-colors",
                    statusFilter === filter.value
                      ? "border-signal text-ink"
                      : "border-transparent text-muted hover:text-ink",
                  )}
                  aria-pressed={statusFilter === filter.value}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {SEVERITY_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setSeverityFilter(filter.value)}
                  className={cn(
                    "border-b px-1 pb-1.5 text-[11px] font-medium transition-colors",
                    severityFilter === filter.value
                      ? "border-signal text-signal-dark"
                      : "border-transparent text-muted hover:text-ink",
                  )}
                  aria-pressed={severityFilter === filter.value}
                >
                  {filter.label}
                </button>
              ))}
              <select
                className="ml-auto h-8 rounded-[7px] border border-line bg-transparent px-2 text-[11px] font-medium text-ink-soft outline-none focus:border-sea"
                value={zoneFilter}
                onChange={(event) => setZoneFilter(event.target.value)}
                aria-label="Filter by zone"
              >
                <option value="">All zones</option>
                {(zones.data ?? []).map((zone) => (
                  <option key={zone.zone_code} value={zone.zone_code}>
                    {zone.zone_code}
                  </option>
                ))}
              </select>
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-muted">
              {alerts.data?.total ?? 0} alert(s) match the current filters. Severity describes the
              prototype rubric level at the moment of analysis; it is not a probability.
            </p>
            <div className="mt-4 border-t border-line pt-4">
              <p className="text-[9.5px] font-semibold text-muted">
                How an alert appears here
              </p>
              <ol className="mt-2 divide-y divide-line border-t border-line">
                {[
                  "An analysis reaches moderate or high on the prototype rubric.",
                  "The API writes an alert linked to the prediction and the zone.",
                  "An operator acknowledges, then resolves it with a UTC timestamp.",
                ].map((step, index) => (
                  <li key={step} className="flex gap-2.5 py-2 text-[11px] leading-relaxed text-ink-soft">
                    <span className="metric mt-[1px] shrink-0 text-[9.5px] text-muted">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
            {notice ? (
              <p className="mt-3 border-l-2 border-l-ok py-1 pl-3 text-[11.5px] text-ink-soft">{notice}</p>
            ) : null}
            {error ? (
              <p className="mt-3 rounded-[10px] border border-signal/25 bg-signal-soft px-3 py-2.5 text-[11.5px] text-signal-dark">
                {error}
              </p>
            ) : null}
          </div>

          <div className="card p-5">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold text-muted">
              <Lock className="h-3 w-3" aria-hidden /> Privileged actions
            </p>
            <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
              Acknowledging and resolving writes to the database and requires an API key.
            </p>
            <ApiKeyField value={apiKey} onChange={setApiKey} className="mt-3" />
            <div className="mt-3 grid grid-cols-3 divide-x divide-line border-t border-line pt-3 text-center">
              {[
                ["High", alerts.data?.counts_by_severity.high ?? 0],
                ["Moderate", alerts.data?.counts_by_severity.moderate ?? 0],
                ["Info", alerts.data?.counts_by_severity.info ?? 0],
              ].map(([label, value]) => (
                <div key={String(label)} className="px-2">
                  <p className="text-[9.5px] text-muted">{label}</p>
                  <p className="metric mt-1 text-[16px] font-medium">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {alerts.error ? (
          <ErrorState message={alerts.error} onRetry={alerts.refresh} />
        ) : alerts.loading && !alerts.data ? (
          <div className="space-y-3">
            {[0, 1, 2].map((index) => (
              <div key={index} className="skeleton h-[150px] rounded-[14px]" />
            ))}
          </div>
        ) : alerts.data && alerts.data.items.length === 0 ? (
          <EmptyState
            title="No alerts match these filters"
            description="Alerts are only created by a completed analysis whose risk rubric reaches moderate or high. Run an extreme scenario, then screen the window in the AI workspace."
          />
        ) : (
          <div className="space-y-3">
            {(alerts.data?.items ?? []).map((alert) => {
              const isOpen = expanded === alert.id;
              return (
                <article
                  key={alert.id}
                  className={cn(
                    "card overflow-hidden border-l-4",
                    alert.severity === "high"
                      ? "border-l-signal"
                      : alert.severity === "moderate"
                        ? "border-l-amber"
                        : "border-l-sea",
                  )}
                >
                  <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <SeverityBadge severity={alert.severity} />
                        <StatusPill
                          tone={
                            alert.status === "open" ? "bad" : alert.status === "acknowledged" ? "warn" : "ok"
                          }
                        >
                          {alert.status}
                        </StatusPill>
                        <span className="chip">{alert.zone_code}</span>
                        <span className="font-mono text-[9.5px] text-muted">{formatUtc(alert.created_at)}</span>
                      </div>

                      <h2 className="mt-3 text-[15.5px] font-semibold tracking-[-0.02em]">{alert.title}</h2>
                      <p
                        className={cn(
                          "mt-2 whitespace-pre-line text-[12px] leading-relaxed text-muted",
                          isOpen ? "" : "line-clamp-2",
                        )}
                      >
                        {alert.description}
                      </p>

                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : alert.id)}
                        className="mt-2 inline-flex items-center gap-1 text-[10.5px] font-semibold text-sea"
                      >
                        {isOpen ? <ChevronUp className="h-3 w-3" aria-hidden /> : <ChevronDown className="h-3 w-3" aria-hidden />}
                        {isOpen ? "Collapse note" : "Read full note"}
                      </button>

                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[10px] text-muted">
                        <span>
                          Created <strong className="font-semibold text-ink">{formatUtc(alert.created_at)}</strong>
                        </span>
                        <span>
                          Acknowledged{" "}
                          <strong className="font-semibold text-ink">
                            {alert.acknowledged_at ? formatUtc(alert.acknowledged_at) : "—"}
                          </strong>
                          {alert.acknowledged_by ? ` · ${alert.acknowledged_by}` : ""}
                        </span>
                        <span>
                          Resolved{" "}
                          <strong className="font-semibold text-ink">
                            {alert.resolved_at ? formatUtc(alert.resolved_at) : "—"}
                          </strong>
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2 lg:flex-col lg:items-stretch">
                      {alert.status === "open" ? (
                        <button
                          type="button"
                          onClick={() => patchAlert(alert, "acknowledged")}
                          disabled={busy === alert.id}
                          className="btn btn-ghost btn-sm"
                        >
                          {busy === alert.id ? <InlineSpinner label="Saving" /> : <Check className="h-3.5 w-3.5" aria-hidden />}
                          Acknowledge
                        </button>
                      ) : null}
                      {alert.status !== "resolved" ? (
                        <button
                          type="button"
                          onClick={() => patchAlert(alert, "resolved")}
                          disabled={busy === alert.id}
                          className="btn btn-dark btn-sm"
                        >
                          Resolve
                        </button>
                      ) : (
                        <span className="rounded-[10px] border border-line px-3 py-2 text-center text-[10.5px] text-muted">
                          Closed
                        </span>
                      )}
                      {alert.status === "acknowledged" ? (
                        <button
                          type="button"
                          onClick={() => patchAlert(alert, "open")}
                          disabled={busy === alert.id}
                          className="btn btn-ghost btn-sm"
                        >
                          <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reopen
                        </button>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="border-t border-line pt-3 text-[10.5px] leading-relaxed text-muted">
          <strong className="text-ink">Lifecycle rules.</strong> Open → acknowledged → resolved is the
          intended path. Resolved alerts cannot be reopened (409 from the API), which preserves an honest
          audit trail. Acknowledgement stores the actor label and a UTC timestamp.
        </div>
      </div>
    </>
  );
}

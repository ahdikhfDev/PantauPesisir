"use client";

import { BellRing, ChevronDown, ChevronUp, Clock, ShieldCheck } from "lucide-react";
import { useState } from "react";

import { EmptyState, ErrorState, PageHero, SeverityBadge, StatusPill } from "@/components/ui";
import { cn, formatWib } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { AlertList, Zone } from "@/lib/types";

const SEVERITY_FILTERS = [
  { value: "", label: "Semua tingkat" },
  { value: "high", label: "Tinggi" },
  { value: "moderate", label: "Sedang" },
  { value: "info", label: "Info" },
];

export default function AlertsPage() {
  const [severityFilter, setSeverityFilter] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const zones = useApi<Zone[]>("/coastal/zones");
  const params = new URLSearchParams({ status: "open", limit: "100" });
  if (severityFilter) params.set("severity", severityFilter);
  if (zoneFilter) params.set("zone_code", zoneFilter);
  const alerts = useApi<AlertList>(`/alerts?${params.toString()}`, 20000);

  const severityCounts = (alerts.data?.items ?? []).reduce<Record<string, number>>((acc, item) => {
    acc[item.severity] = (acc[item.severity] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <PageHero
        eyebrow="Peringatan warga"
        title={
          <>
            Pemberitahuan kondisi pesisir
          </>
        }
        description="Pemberitahuan aktif untuk setiap pantai, lengkap dengan waktu dan tingkat keparahannya. Tidak perlu login dan tidak ada yang harus dikonfirmasi — pemberitahuan berakhir sendiri saat kondisinya sudah lewat."
        right={
          <StatusPill tone={alerts.data?.total ? "bad" : "ok"}>
            {alerts.data?.total ?? 0} pemberitahuan aktif
          </StatusPill>
        }
      />

      <div className="space-y-6">
        <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
          <div className="card p-5">
            <div className="flex flex-wrap items-center gap-2">
              {SEVERITY_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setSeverityFilter(filter.value)}
                  className={cn(
                    "border-b px-1 pb-1.5 text-[14px] font-medium transition-colors",
                    severityFilter === filter.value
                      ? "border-ground text-ground"
                      : "border-transparent text-muted hover:text-ink",
                  )}
                  aria-pressed={severityFilter === filter.value}
                >
                  {filter.label}
                </button>
              ))}
              <select
                className="ml-auto h-9 rounded-full bg-surface px-3 text-[14px] font-medium text-ink-soft outline-none"
                value={zoneFilter}
                onChange={(event) => setZoneFilter(event.target.value)}
                aria-label="Filter berdasarkan zona"
              >
                <option value="">Semua pantai</option>
                {(zones.data ?? []).map((zone) => (
                  <option key={zone.zone_code} value={zone.zone_code}>
                    {zone.zone_name}
                  </option>
                ))}
              </select>
            </div>

            <p className="mt-4 text-[14px] leading-relaxed text-muted">
              {alerts.data?.total ?? 0} pemberitahuan cocok dengan filter saat ini. Tingkat keparahan
              menggambarkan hasil analisis risiko saat pemberitahuan dibuat.
            </p>

            <div className="mt-4 border-t border-line pt-4">
              <p className="text-[17px] font-medium text-ink">Bagaimana pemberitahuan dibuat</p>
              <ol className="mt-2 divide-y divide-line border-t border-line">
                {[
                  "Analisis risiko menemukan kondisi sedang atau tinggi di suatu pantai.",
                  "Sistem menulis pemberitahuan yang tertaut ke analisis dan zona tersebut.",
                  "Pemberitahuan berlaku 6 jam, lalu berakhir otomatis tanpa perlu ditutup.",
                ].map((step, index) => (
                  <li key={step} className="flex gap-2.5 py-2 text-[14px] leading-relaxed text-ink-soft">
                    <span className="metric mt-[1px] shrink-0 text-[14px] text-muted">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>

          <div className="card p-5">
            <p className="flex items-center gap-1.5 text-[17px] font-medium text-ink">
              <ShieldCheck className="h-3 w-3" aria-hidden /> Tanpa akun, tanpa tindakan
            </p>
            <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
              Halaman ini hanya untuk dibaca. Tidak ada tombol akui atau selesai karena tidak ada akun
              petugas yang perlu dicatat.
            </p>
            <div className="mt-4 grid grid-cols-3 divide-x divide-line border-t border-line pt-3 text-center">
              {[
                ["Tinggi", severityCounts.high ?? 0],
                ["Sedang", severityCounts.moderate ?? 0],
                ["Info", severityCounts.info ?? 0],
              ].map(([label, value]) => (
                <div key={String(label)} className="px-2">
                  <p className="text-[14px] text-muted">{label}</p>
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
              <div key={index} className="skeleton h-[130px]" />
            ))}
          </div>
        ) : alerts.data && alerts.data.items.length === 0 ? (
          <EmptyState
            title="Tidak ada pemberitahuan aktif"
            description="Semua pantai yang dipantau sedang tidak memiliki pemberitahuan. Pemberitahuan baru muncul otomatis saat analisis risiko menemukan kondisi sedang atau tinggi."
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
                  <div className="p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityBadge severity={alert.severity} />
                      <span className="chip">{alert.zone_name ?? alert.zone_code}</span>
                      <span className="flex items-center gap-1 font-mono text-[14px] text-muted">
                        <Clock className="h-3 w-3" aria-hidden />
                        {formatWib(alert.created_at)}
                      </span>
                    </div>

                    <h2 className="mt-3 text-[15.5px] font-semibold tracking-[-0.02em]">{alert.title}</h2>
                    <p
                      className={cn(
                        "mt-2 whitespace-pre-line text-[13.5px] leading-relaxed text-muted",
                        isOpen ? "" : "line-clamp-2",
                      )}
                    >
                      {alert.description}
                    </p>

                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : alert.id)}
                      className="mt-2 inline-flex items-center gap-1 text-[14px] font-medium text-sea"
                    >
                      {isOpen ? (
                        <ChevronUp className="h-3 w-3" aria-hidden />
                      ) : (
                        <ChevronDown className="h-3 w-3" aria-hidden />
                      )}
                      {isOpen ? "Sembunyikan catatan" : "Baca catatan lengkap"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="flex items-start gap-2 border-t border-line pt-3 text-[14px] leading-relaxed text-muted">
          <BellRing className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <p>
            <strong className="text-ink">Pemberitahuan berakhir otomatis.</strong> Setiap pemberitahuan
            berlaku 6 jam sejak dibuat, lalu tidak lagi ditampilkan. Untuk prakiraan resmi, cek juga BMKG.
          </p>
        </div>
      </div>
    </>
  );
}

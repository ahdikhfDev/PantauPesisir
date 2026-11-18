"use client";

import { AlertTriangle, CheckCircle2, Circle, Eye, EyeOff, KeyRound } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import { cn } from "@/lib/format";

export function SectionHeading({
  eyebrow,
  title,
  description,
  right,
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 md:flex-row md:items-end md:justify-between", className)}>
      <div className="max-w-2xl">
        <span className="eyebrow">{eyebrow}</span>
        <h2 className="mt-3 text-[20px] font-semibold leading-tight tracking-[-0.03em]">{title}</h2>
        {description ? <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{description}</p> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

export function PageHero({
  eyebrow,
  title,
  description,
  right,
}: {
  eyebrow: string;
  title: ReactNode;
  description: ReactNode;
  right?: ReactNode;
}) {
  return (
    <section className="mb-6 flex flex-col gap-4 border-b border-line pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        <span className="eyebrow">{eyebrow}</span>
        <h1 className="font-display mt-2 text-[26px] font-semibold leading-[1.06] tracking-[-0.04em] sm:text-[30px]">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-muted">{description}</p>
      </div>
      {right ? <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 lg:justify-end">{right}</div> : null}
    </section>
  );
}

type Tone = "ok" | "warn" | "bad" | "neutral" | "sea";

const DOT: Record<Tone, string> = {
  ok: "bg-ok",
  warn: "bg-amber",
  bad: "bg-signal",
  neutral: "bg-muted/50",
  sea: "bg-sea",
};

const TEXT: Record<Tone, string> = {
  ok: "text-ink-soft",
  warn: "text-amber",
  bad: "text-signal-dark",
  neutral: "text-muted",
  sea: "text-sea",
};

export function StatusPill({
  tone,
  children,
  icon = true,
}: {
  tone: Tone;
  children: ReactNode;
  icon?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap text-[10px] font-semibold",
        TEXT[tone],
      )}
    >
      {icon ? <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT[tone])} aria-hidden /> : null}
      {children}
    </span>
  );
}

export function SourceBadge({
  kind,
}: {
  kind: "simulated" | "satellite" | "model" | "historical" | "observed";
}) {
  const config = {
    simulated: { tone: "ok" as Tone, label: "Telemetri buoy" },
    satellite: { tone: "sea" as Tone, label: "Satelit · historis" },
    model: { tone: "neutral" as Tone, label: "Keluaran model" },
    historical: { tone: "warn" as Tone, label: "Dataset historis" },
    observed: { tone: "sea" as Tone, label: "Teramati" },
  }[kind];

  return <StatusPill tone={config.tone}>{config.label}</StatusPill>;
}

export function RiskBadge({ level }: { level: "low" | "moderate" | "high" | null | undefined }) {
  if (level === "high") return <StatusPill tone="bad">Risiko tinggi</StatusPill>;
  if (level === "moderate") return <StatusPill tone="warn">Risiko sedang</StatusPill>;
  if (level === "low") return <StatusPill tone="ok">Risiko rendah</StatusPill>;
  return <StatusPill tone="neutral">Belum ada analisis</StatusPill>;
}

export function SeverityBadge({ severity }: { severity: "info" | "moderate" | "high" }) {
  if (severity === "high") return <StatusPill tone="bad">Tinggi</StatusPill>;
  if (severity === "moderate") return <StatusPill tone="warn">Sedang</StatusPill>;
  return <StatusPill tone="sea">Info</StatusPill>;
}

export function FreshnessBadge({ stale, age }: { stale: boolean; age?: string }) {
  return (
    <StatusPill tone={stale ? "warn" : "ok"}>
      {stale ? "Usang" : "Terkini"}
      {age ? ` · ${age}` : ""}
    </StatusPill>
  );
}

export function Metric({
  label,
  value,
  unit,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      {label ? <p className="text-[10.5px] font-semibold text-muted">{label}</p> : null}
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="metric text-[26px] font-medium leading-none text-ink">{value}</span>
        {unit ? <span className="text-[11px] font-medium text-muted">{unit}</span> : null}
      </p>
      {hint ? <p className="mt-2 text-[10.5px] leading-snug text-muted">{hint}</p> : null}
    </div>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-[10px] border border-line border-l-2 border-l-signal bg-surface p-5">
      <div className="flex items-center gap-2 text-[12px] font-semibold text-signal-dark">
        <AlertTriangle className="h-4 w-4" aria-hidden />
        Data gagal dimuat
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-muted">{message}</p>
      <p className="mt-1 text-[10.5px] text-muted">
        Koneksi ke server mungkin sedang lambat. Coba lagi dalam beberapa detik.
      </p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="btn btn-ghost btn-sm mt-3">
          Coba lagi
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[10px] border border-dashed border-line-strong p-6">
      <div className="flex items-center gap-2">
        <Circle className="h-3 w-3 text-muted" aria-hidden />
        <p className="text-[13px] font-semibold text-ink">{title}</p>
      </div>
      <p className="mt-2 max-w-md text-[12px] leading-relaxed text-muted">{description}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function CaveatNote({ children, tone = "warn" }: { children: ReactNode; tone?: "warn" | "sea" }) {
  return (
    <div
      className={cn(
        "border-l-2 py-1 pl-3 text-[11.5px] leading-relaxed text-muted",
        tone === "warn" ? "border-l-amber" : "border-l-sea",
      )}
    >
      {children}
    </div>
  );
}

export function ApiKeyField({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={cn("border-t border-line pt-3", className)}>
      <label className="label flex items-center gap-1.5" htmlFor="api-key">
        <KeyRound className="h-3 w-3" aria-hidden /> Kunci operator
      </label>
      <div className="relative">
        <input
          id="api-key"
          className="input pr-10 font-mono text-[11.5px]"
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder="pantaupesisir-demo-2026"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-ink"
          aria-label={visible ? "Sembunyikan API key" : "Tampilkan API key"}
        >
          {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-muted">
        Kunci operator hanya mengontrol aksi tulis dan disimpan di tab ini.
      </p>
    </div>
  );
}

export function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 text-[11.5px]">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}

export function InlineSpinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[11.5px] font-medium text-muted">
      <span className="h-3 w-3 animate-spin rounded-full border border-line-strong border-t-signal" />
      {label ?? "Memproses…"}
    </span>
  );
}

export function VerifiedMark({ children }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[10.5px] text-muted">
      <CheckCircle2 className="h-3 w-3 text-sea" aria-hidden />
      {children ?? "Tervalidasi"}
    </span>
  );
}

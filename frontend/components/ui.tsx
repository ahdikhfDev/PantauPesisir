"use client";

import { AlertTriangle, Circle, Eye, EyeOff, KeyRound } from "lucide-react";
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
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="display mt-2 text-[clamp(1.6rem,2.6vw,2.1rem)]">{title}</h2>
        {description ? <p className="mt-2 text-[15px] leading-[1.6] text-ink-soft">{description}</p> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

/**
 * A page opens with its name in the sign face and one line saying what the page
 * is for. The rule under it belongs to the page, so it spans the full column.
 */
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
    <section className="mb-6 flex flex-col gap-4 pb-1 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        <p className="eyebrow enter-fade">{eyebrow}</p>
        <h1 className="display enter-up stagger-1 mt-2.5 text-[clamp(2.1rem,4.4vw,3.4rem)]">{title}</h1>
        <p className="enter-up stagger-2 mt-3 max-w-2xl text-[15.5px] leading-[1.6] text-ink-soft">
          {description}
        </p>
      </div>
      {right ? (
        <div className="enter-up stagger-3 flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2 lg:justify-end">
          {right}
        </div>
      ) : null}
    </section>
  );
}

type Tone = "ok" | "warn" | "bad" | "neutral" | "sea";

const DOT: Record<Tone, string> = {
  ok: "bg-ok",
  warn: "bg-amber",
  bad: "bg-signal",
  neutral: "bg-muted",
  sea: "bg-sea",
};

const TEXT: Record<Tone, string> = {
  ok: "text-ok",
  warn: "text-amber",
  bad: "text-signal",
  neutral: "text-muted",
  sea: "text-ink-soft",
};

/**
 * A state, not a badge: square dot plus a word. Colour never carries it alone.
 */
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
        "inline-flex items-center gap-1.5 text-[14px] font-medium whitespace-nowrap",
        TEXT[tone],
      )}
    >
      {icon ? <span className={cn("h-2 w-2 shrink-0", DOT[tone])} aria-hidden /> : null}
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
    simulated: { tone: "sea" as Tone, label: "Telemetri buoy" },
    satellite: { tone: "sea" as Tone, label: "Satelit, data historis" },
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
  return <StatusPill tone="neutral">Belum dianalisis</StatusPill>;
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
      {age ? `, ${age}` : ""}
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
      {label ? <p className="text-[14px] text-muted">{label}</p> : null}
      <p className="mt-1.5 flex items-baseline gap-1.5">
        <span className="metric text-[27px] leading-none font-medium text-ink">{value}</span>
        {unit ? <span className="text-[14px] text-muted">{unit}</span> : null}
      </p>
      {hint ? <p className="mt-1.5 text-[13.5px] leading-snug text-muted">{hint}</p> : null}
    </div>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card border-l-[3px] border-l-signal p-5">
      <div className="flex items-center gap-2 text-[14px] font-medium text-signal">
        <AlertTriangle className="h-4 w-4" aria-hidden />
        Data tidak bisa dimuat
      </div>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-soft">{message}</p>
      <p className="mt-1 text-[14px] text-muted">
        Kemungkinan server sedang lambat atau sedang menyala ulang.
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
    <div className="rounded-[var(--radius-card)] border border-dashed border-line-strong p-6">
      <div className="flex items-center gap-2">
        <Circle className="h-3 w-3 text-muted" aria-hidden />
        <p className="text-[14px] font-medium text-ink">{title}</p>
      </div>
      <p className="mt-1.5 max-w-md text-[14px] leading-relaxed text-muted">{description}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function CaveatNote({ children, tone = "warn" }: { children: ReactNode; tone?: "warn" | "sea" }) {
  return (
    <div
      className={cn(
        "border-l-2 py-1 pl-3 text-[14px] leading-relaxed text-ink-soft",
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
        <KeyRound className="h-3.5 w-3.5" aria-hidden /> Kunci operator
      </label>
      <div className="relative">
        <input
          id="api-key"
          className="input pr-10 font-mono text-[14px]"
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder="pantaupesisir-operator-2026"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-ink"
          aria-label={visible ? "Sembunyikan kunci" : "Tampilkan kunci"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
        Hanya untuk aksi tulis. Disimpan di tab ini, tidak dikirim ke mana pun selain server.
      </p>
    </div>
  );
}

export function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 text-[14px]">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}

export function InlineSpinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[14px] font-medium text-muted">
      <span className="h-3 w-3 animate-spin rounded-full border border-line-strong border-t-signal" />
      {label ?? "Memproses…"}
    </span>
  );
}

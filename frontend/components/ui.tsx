"use client";

import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Circle,
  Database,
  Eye,
  EyeOff,
  KeyRound,
  Radio,
  Satellite,
  ShieldAlert,
  Waves,
} from "lucide-react";
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
    <div className={cn("flex flex-col gap-6 md:flex-row md:items-end md:justify-between", className)}>
      <div className="max-w-2xl">
        <span className="eyebrow">{eyebrow}</span>
        <h2 className="mt-4 text-[clamp(1.9rem,3.6vw,2.9rem)] font-extrabold leading-[1.02] tracking-[-0.04em]">
          {title}
        </h2>
        {description ? (
          <p className="mt-4 text-[15px] leading-relaxed text-muted">{description}</p>
        ) : null}
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
        <h1 className="mt-2.5 text-[26px] font-extrabold leading-[1.05] tracking-[-0.04em] sm:text-[30px]">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-muted">{description}</p>
      </div>
      {right ? <div className="w-full min-w-0 sm:w-auto lg:shrink-0">{right}</div> : null}
    </section>
  );
}

type Tone = "ok" | "warn" | "bad" | "neutral" | "sea";

const TONE_STYLES: Record<Tone, string> = {
  ok: "border-ok/20 bg-ok-soft text-ok",
  warn: "border-amber/25 bg-amber-soft text-amber",
  bad: "border-signal/25 bg-signal-soft text-signal-dark",
  neutral: "border-line bg-paper text-muted",
  sea: "border-sea/20 bg-sea-soft text-sea",
};

export function StatusPill({
  tone,
  children,
  icon,
}: {
  tone: Tone;
  children: ReactNode;
  icon?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.09em]",
        TONE_STYLES[tone],
      )}
    >
      {icon === false ? null : tone === "ok" ? (
        <CheckCircle2 className="h-3 w-3" aria-hidden />
      ) : tone === "warn" ? (
        <AlertTriangle className="h-3 w-3" aria-hidden />
      ) : tone === "bad" ? (
        <ShieldAlert className="h-3 w-3" aria-hidden />
      ) : (
        <Circle className="h-2 w-2 fill-current" aria-hidden />
      )}
      {children}
    </span>
  );
}

export function SourceBadge({ kind }: { kind: "simulated" | "satellite" | "model" | "historical" | "observed" }) {
  if (kind === "satellite") {
    return (
      <StatusPill tone="sea">
        <Satellite className="h-3 w-3" aria-hidden /> Satellite · historical
      </StatusPill>
    );
  }
  if (kind === "model") {
    return (
      <StatusPill tone="neutral">
        <BrainCircuit className="h-3 w-3" aria-hidden /> Model output
      </StatusPill>
    );
  }
  if (kind === "historical") {
    return (
      <StatusPill tone="warn">
        <Database className="h-3 w-3" aria-hidden /> Historical dataset
      </StatusPill>
    );
  }
  if (kind === "observed") {
    return (
      <StatusPill tone="ok">
        <Radio className="h-3 w-3" aria-hidden /> Observed
      </StatusPill>
    );
  }
  return (
    <StatusPill tone="bad">
      <Waves className="h-3 w-3" aria-hidden /> Simulated
    </StatusPill>
  );
}

export function RiskBadge({ level }: { level: "low" | "moderate" | "high" | null | undefined }) {
  if (level === "high") return <StatusPill tone="bad">Prototype risk · high</StatusPill>;
  if (level === "moderate") return <StatusPill tone="warn">Prototype risk · moderate</StatusPill>;
  if (level === "low") return <StatusPill tone="ok">Prototype risk · low</StatusPill>;
  return <StatusPill tone="neutral">No analysis yet</StatusPill>;
}

export function SeverityBadge({ severity }: { severity: "info" | "moderate" | "high" }) {
  if (severity === "high") return <StatusPill tone="bad">High severity</StatusPill>;
  if (severity === "moderate") return <StatusPill tone="warn">Moderate severity</StatusPill>;
  return <StatusPill tone="sea">Info</StatusPill>;
}

export function FreshnessBadge({ stale, age }: { stale: boolean; age?: string }) {
  return (
    <StatusPill tone={stale ? "warn" : "ok"}>
      {stale ? "Stale" : "Fresh"}
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
      {label ? (
        <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted">{label}</p>
      ) : null}
      <p className="mt-2 flex items-baseline gap-1">
        <span className="metric text-[26px] font-semibold leading-none text-ink">{value}</span>
        {unit ? <span className="text-[12px] font-semibold text-muted">{unit}</span> : null}
      </p>
      {hint ? <p className="mt-2 text-[11px] leading-snug text-muted">{hint}</p> : null}
    </div>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} />;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card flex flex-col items-start gap-3 border-signal/20 bg-signal-soft/60 p-5">
      <div className="flex items-center gap-2 text-[13px] font-bold text-signal-dark">
        <AlertTriangle className="h-4 w-4" aria-hidden />
        The console could not load this data
      </div>
      <p className="text-[13px] leading-relaxed text-signal-dark/80">{message}</p>
      <p className="text-[11px] text-signal-dark/70">
        Check that the FastAPI backend is running and `NEXT_PUBLIC_API_BASE_URL` points at it.
      </p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="btn btn-ghost btn-sm mt-1">
          Retry request
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
    <div className="card flex flex-col items-start gap-2 border-dashed p-8">
      <Activity className="h-5 w-5 text-muted" aria-hidden />
      <p className="mt-1 text-[15px] font-bold text-ink">{title}</p>
      <p className="max-w-md text-[13px] leading-relaxed text-muted">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function CaveatNote({ children, tone = "warn" }: { children: ReactNode; tone?: "warn" | "sea" }) {
  return (
    <div
      className={cn(
        "flex gap-2.5 rounded-xl border px-3.5 py-3 text-[12px] leading-relaxed",
        tone === "warn"
          ? "border-amber/25 bg-amber-soft/70 text-amber"
          : "border-sea/20 bg-sea-soft/70 text-sea",
      )}
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <div>{children}</div>
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
    <div className={cn("rounded-xl border border-line bg-paper/70 p-3", className)}>
      <label className="label flex items-center gap-1.5" htmlFor="api-key">
        <KeyRound className="h-3 w-3" aria-hidden /> Operator API key
      </label>
      <div className="relative">
        <input
          id="api-key"
          className="input pr-10 font-mono text-[12px]"
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder="cews-demo-2026"
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:text-ink"
          aria-label={visible ? "Hide API key" : "Show API key"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-muted">
        The demo key is public by design and only unlocks simulator/analysis controls. It is stored in
        this browser tab only.
      </p>
    </div>
  );
}

export function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 text-[12px]">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="text-right font-semibold text-ink">{value}</dd>
    </div>
  );
}

export function InlineSpinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[12px] font-semibold text-muted">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-signal" />
      {label ?? "Working…"}
    </span>
  );
}

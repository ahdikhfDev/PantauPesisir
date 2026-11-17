"use client";

import {
  BellRing,
  BrainCircuit,
  Database,
  LayoutDashboard,
  Menu,
  Radio,
  Satellite,
  ShieldCheck,
  Waves,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { cn, formatShortUtc } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { SystemHealth } from "@/lib/types";

const NAV = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/ocean", label: "Ocean monitoring", icon: Waves },
  { href: "/satellite", label: "Satellite", icon: Satellite },
  { href: "/ai", label: "AI risk", icon: BrainCircuit },
  { href: "/alerts", label: "Alerts", icon: BellRing },
  { href: "/sources", label: "Data sources", icon: Database },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [clock, setClock] = useState("--:--:--");
  const health = useApi<SystemHealth>("/system/health", 60000);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const tick = () => {
      setClock(
        new Intl.DateTimeFormat("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
          timeZone: "UTC",
        }).format(new Date()),
      );
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const current = NAV.find((item) =>
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href),
  );
  const healthy = health.data?.status === "ok";

  return (
    <div className="min-h-screen bg-paper">
      {open ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm lg:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[252px] flex-col overflow-y-auto bg-sea-deep text-white transition-transform duration-300 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div
          className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-signal/25 blur-3xl"
          aria-hidden
        />

        <div className="relative flex items-center justify-between px-5 pt-6">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-signal">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M2.5 9c2.2-2.3 4.3-2.3 6.5 0s4.3 2.3 6.5 0 4.3-2.3 6 0M2.5 15.5c2.2-2.3 4.3-2.3 6.5 0s4.3 2.3 6.5 0 4.3-2.3 6 0"
                  stroke="white"
                  strokeWidth="2.1"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span className="leading-none">
              <span className="block text-[18px] font-extrabold tracking-[-0.04em]">CEWS</span>
              <span className="mt-1 block text-[8px] font-extrabold uppercase tracking-[0.2em] text-white/45">
                Operations console
              </span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="grid h-8 w-8 place-items-center rounded-full border border-white/15 text-white/70 lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative mt-7 px-3">
          <p className="px-3 text-[9px] font-extrabold uppercase tracking-[0.18em] text-white/35">
            Monitoring
          </p>
          <nav className="mt-2 space-y-0.5">
            {NAV.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[12.5px] font-semibold transition",
                    active
                      ? "bg-white/10 text-white"
                      : "text-white/55 hover:bg-white/5 hover:text-white/90",
                  )}
                >
                  {active ? (
                    <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-signal" />
                  ) : null}
                  <item.icon className="h-4 w-4 shrink-0" aria-hidden />
                  {item.label}
                  {item.href === "/alerts" ? (
                    <span className="ml-auto rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-bold text-white/60">
                      {health.data?.counts.alerts_open ?? 0}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="relative mt-6 px-3">
          <p className="px-3 text-[9px] font-extrabold uppercase tracking-[0.18em] text-white/35">Data mode</p>
          <div className="mt-2 rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="flex items-center gap-1.5 text-[10px] font-bold text-white/80">
              <span className="h-1.5 w-1.5 rounded-full bg-signal" aria-hidden />
              Simulated telemetry
            </p>
            <p className="mt-1 text-[9.5px] leading-relaxed text-white/40">
              Buoy readings are generated by the CEWS simulator. Satellite records are real historical
              acquisitions.
            </p>
          </div>
        </div>

        <div className="relative mt-auto space-y-3 p-3 pb-5">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] font-extrabold uppercase tracking-[0.14em] text-white/40">System</span>
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  healthy ? "bg-emerald-400" : health.error ? "bg-signal" : "bg-amber-400",
                )}
                aria-hidden
              />
            </div>
            <p className="mt-1.5 text-[11px] font-semibold text-white/80">
              {health.error ? "API unreachable" : healthy ? "Core services healthy" : "Degraded"}
            </p>
            <p className="mt-1 text-[9.5px] text-white/40">
              DB {health.data?.database.dialect ?? "—"} · model {health.data?.model.version ?? "—"}
            </p>
            <Link href="/sources" className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-[#ff9a91]">
              System health →
            </Link>
          </div>
          <p className="px-1 text-[8.5px] leading-relaxed text-white/30">
            IT RUSH 2026 prototype · decision support only · not an official warning service.
          </p>
        </div>
      </aside>

      <div className="lg:pl-[252px]">
        <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line bg-white text-ink lg:hidden"
                aria-label="Open navigation"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div className="min-w-0">
                <p className="truncate text-[9px] font-extrabold uppercase tracking-[0.16em] text-muted">
                  CEWS / {current?.label ?? "Console"}
                </p>
                <p className="truncate text-[14px] font-extrabold tracking-[-0.02em]">
                  {current?.label ?? "Overview"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1.5 text-[10px] font-bold text-muted sm:flex">
                <Radio className="h-3 w-3 text-signal" aria-hidden />
                Simulated feed
              </span>
              <span className="hidden items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1.5 text-[10px] font-bold text-muted md:flex">
                <ShieldCheck className="h-3 w-3 text-ok" aria-hidden />
                Prototype
              </span>
              <span className="rounded-full border border-line bg-white px-2.5 py-1.5 font-mono text-[10px] text-ink-soft">
                {clock} UTC
              </span>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>

        <footer className="mx-auto w-full max-w-[1500px] px-4 pb-8 text-[10px] leading-relaxed text-muted sm:px-6 lg:px-8">
          <p>
            CEWS is a student-competition prototype. Simulated buoy telemetry is labelled throughout;
            Copernicus records are historical acquisitions; AI output is model-derived. Never use this
            console for evacuation or safety-of-life decisions — consult BMKG, BPBD and port authorities.
          </p>
          {health.data ? (
            <p className="mt-1">
              API v{health.data.version} · {health.data.counts.buoy_observations} stored readings · last
              source refresh {formatShortUtc(health.data.generated_at)} UTC
            </p>
          ) : null}
        </footer>
      </div>
    </div>
  );
}

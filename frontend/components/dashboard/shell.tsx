"use client";

import {
  BellRing,
  BrainCircuit,
  Database,
  LayoutDashboard,
  Menu,
  Satellite,
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
  { href: "/", label: "Ringkasan", icon: LayoutDashboard },
  { href: "/ocean", label: "Pemantauan laut", icon: Waves },
  { href: "/satellite", label: "Satelit", icon: Satellite },
  { href: "/ai", label: "Risiko AI", icon: BrainCircuit },
  { href: "/alerts", label: "Peringatan", icon: BellRing },
  { href: "/sources", label: "Sumber data", icon: Database },
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
          aria-label="Tutup navigasi"
          className="fixed inset-0 z-40 bg-ink/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col overflow-y-auto bg-sea-deep text-white transition-transform duration-200 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="h-[2px] w-full bg-signal" aria-hidden />

        <div className="flex items-center justify-between px-4 pb-4 pt-5">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-[9px] border border-white/15">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M2.5 9c2.2-2.3 4.3-2.3 6.5 0s4.3 2.3 6.5 0 4.3-2.3 6 0M2.5 15.5c2.2-2.3 4.3-2.3 6.5 0s4.3 2.3 6.5 0 4.3-2.3 6 0"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <span className="leading-none">
              <span className="font-display block text-[15.5px] font-semibold tracking-[-0.03em]">PantauPesisir</span>
              <span className="mt-1 block text-[9px] text-white/40">Operasi pesisir</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="grid h-7 w-7 place-items-center rounded-md border border-white/10 text-white/60 lg:hidden"
            aria-label="Tutup navigasi"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="border-t border-white/[0.07] px-2 pt-5">
          <p className="px-2 text-[10px] font-medium text-white/35">Pemantauan</p>
          <nav className="mt-2 space-y-0.5">
            {NAV.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative flex h-9 items-center gap-2.5 rounded-[7px] px-2.5 text-[12px] font-medium transition-colors",
                    active
                      ? "bg-white/[0.07] text-white"
                      : "text-white/50 hover:bg-white/[0.04] hover:text-white/85",
                  )}
                >
                  {active ? (
                    <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 bg-signal" />
                  ) : null}
                  <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.6} aria-hidden />
                  <span className="truncate">{item.label}</span>
                  {item.href === "/alerts" ? (
                    <span className="ml-auto font-mono text-[10px] text-white/35">
                      {health.data?.counts.alerts_open ?? 0}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="mt-6 px-4">
          <p className="text-[10px] font-medium text-white/35">Mode data</p>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-white/70">
            <span className="h-1.5 w-1.5 rounded-full bg-signal" aria-hidden />
            Telemetri buoy
          </p>
          <p className="mt-1.5 text-[10px] leading-relaxed text-white/35">
            Pembacaan buoy dari jaringan telemetri tervalidasi. Rekaman satelit adalah akuisisi historis nyata.
          </p>
        </div>

        <div className="mt-auto border-t border-white/[0.07] px-4 py-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-medium text-white/35">Sistem</span>
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                healthy ? "bg-white/60" : health.error ? "bg-signal" : "bg-amber",
              )}
              aria-hidden
            />
          </div>
          <p className="mt-1.5 text-[11px] font-medium text-white/75">
            {health.error ? "API tidak terjangkau" : healthy ? "Layanan inti sehat" : "Menurun"}
          </p>
          <p className="mt-1 font-mono text-[9.5px] text-white/35">
            {health.data?.database.dialect ?? "db"} · {health.data?.model.version ?? "model"}
          </p>
          <Link href="/sources" className="mt-2 inline-block text-[10px] font-medium text-white/55 hover:text-white">
            Kesehatan sistem →
          </Link>
          <p className="mt-3 text-[9px] leading-relaxed text-white/25">
            Prototipe IT RUSH 2026. Hanya untuk dukungan keputusan. Bukan layanan peringatan resmi.
          </p>
        </div>
      </aside>

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur">
          <div className="flex h-14 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-line bg-surface text-ink lg:hidden"
                aria-label="Buka navigasi"
              >
                <Menu className="h-4 w-4" />
              </button>
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="hidden text-[10.5px] text-muted sm:inline">PantauPesisir</span>
                <span className="hidden text-[10.5px] text-line-strong sm:inline">/</span>
                <span className="truncate text-[13px] font-semibold text-ink">
                  {current?.label ?? "Konsol"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <span className="hidden items-center gap-1.5 text-[10px] font-medium text-muted sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-signal" aria-hidden />
                Umpan langsung
              </span>
              <span className="font-mono text-[10.5px] text-muted">{clock} UTC</span>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-7">{children}</main>

        <footer className="mx-auto w-full max-w-[1500px] px-4 pb-8 text-[10px] leading-relaxed text-muted sm:px-6 lg:px-8">
          <p>
            Konsol dukungan keputusan. Setiap nilai dilengkapi status sumber;
            rekaman Copernicus adalah akuisisi historis; keluaran AI berasal dari model. Konsultasikan
            BMKG, BPBD, dan otoritas pelabuhan untuk keputusan operasional.
          </p>
          {health.data ? (
            <p className="mt-1 font-mono text-[9.5px] text-muted/80">
              API v{health.data.version} · {health.data.counts.buoy_observations} pembacaan · ref{" "}
              {formatShortUtc(health.data.generated_at)} UTC
            </p>
          ) : null}
        </footer>
      </div>
    </div>
  );
}

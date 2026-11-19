"use client";

import {
  Anchor,
  BellRing,
  BookOpen,
  BrainCircuit,
  Compass,
  Database,
  LayoutDashboard,
  LifeBuoy,
  Satellite,
  Waves,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import type { LucideIcon } from "lucide-react";

import { Logo } from "@/components/logo";
import { cn, formatShortWib } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import type { SystemHealth } from "@/lib/types";

type NavItem = { href: string; label: string; short: string; icon: LucideIcon };

const WARGA_NAV: NavItem[] = [
  { href: "/cek", label: "Cek kondisi", short: "Cek", icon: LifeBuoy },
  { href: "/ringkasan", label: "Kabar laut", short: "Kabar", icon: Waves },
  { href: "/belajar", label: "Belajar", short: "Belajar", icon: BookOpen },
  { href: "/alerts", label: "Peringatan", short: "Awas", icon: BellRing },
];

const KONSOL_NAV: NavItem[] = [
  { href: "/konsol", label: "Ringkasan", short: "Ringkas", icon: LayoutDashboard },
  { href: "/ocean", label: "Pemantauan laut", short: "Laut", icon: Waves },
  { href: "/satellite", label: "Satelit", short: "Satelit", icon: Satellite },
  { href: "/ai", label: "Analisis AI", short: "AI", icon: BrainCircuit },
  { href: "/sources", label: "Sumber & sistem", short: "Sumber", icon: Database },
];

const CONSOLE_PREFIXES = ["/konsol", "/ocean", "/satellite", "/ai", "/sources"];

function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5" aria-label="PantauPesisir, beranda">
      <Logo size={32} />
      <span className="font-display text-[21px] leading-none font-semibold tracking-[-0.01em]">
        {compact ? "PP" : "PantauPesisir"}
      </span>
    </Link>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [clock, setClock] = useState("--:--:--");
  const health = useApi<SystemHealth>("/system/health", 60000);

  useEffect(() => {
    const tick = () => {
      setClock(
        new Intl.DateTimeFormat("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
          timeZone: "Asia/Jakarta",
        }).format(new Date()),
      );
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, []);

  const isConsole = CONSOLE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  const visibleNav = isConsole ? KONSOL_NAV : WARGA_NAV;

  // The landing page is a poster, not a page of the book: it owns its own frame.
  if (pathname === "/") {
    return <div className="min-h-screen">{children}</div>;
  }

  const healthy = health.data?.status === "ok";
  const down = Boolean(health.error);

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:border focus:border-ink focus:bg-paper focus:px-4 focus:py-2"
      >
        Lewati ke konten
      </a>

      {/* Status rail. Red is the brand; it greys out when the server is gone. */}
      <div className={cn("h-[3px] w-full", down ? "bg-line-strong" : "bg-signal")} aria-hidden />

      <header>
        <div className="container-x flex h-[58px] items-center justify-between gap-4">
          <Wordmark />

          <div className="flex items-center gap-5">
            <span className="hidden items-baseline gap-2 sm:flex">
              <span
                className={cn(
                  "h-2 w-2 translate-y-px",
                  down ? "bg-ink" : healthy ? "bg-ok" : "bg-amber live-dot",
                )}
                aria-hidden
              />
              <span className="text-[14px] text-ink-soft">
                {down ? "Server tidak terjangkau" : healthy ? "Sistem normal" : "Sebagian terganggu"}
              </span>
            </span>
            <span className="metric text-[14px] text-ink-soft" aria-label="Waktu Indonesia Barat">
              {clock} WIB
            </span>
            <Link
              href={isConsole ? "/cek" : "/konsol"}
              className="btn btn-ghost btn-sm hidden sm:inline-flex"
            >
              {isConsole ? "Mode warga" : "Mode operator"}
            </Link>
          </div>
        </div>
      </header>

      {/* Section nav. Underline on the active item, the way the reference marks it. */}
      <nav aria-label="Navigasi bagian" className="hidden border-b border-line lg:block">
        <div className="container-x flex items-center gap-1">
          {visibleNav.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-11 items-center gap-2 px-3.5 text-[14px] transition-colors",
                  active
                    ? "font-semibold text-ink after:absolute after:inset-x-3 after:-bottom-px after:h-[2px] after:bg-signal"
                    : "text-ink-soft hover:text-ink",
                )}
              >
                <item.icon
                  className={cn("h-[15px] w-[15px]", active ? "text-signal" : "text-muted")}
                  strokeWidth={2}
                  aria-hidden
                />
                {item.label}
              </Link>
            );
          })}
          <span className="ml-auto text-[14px] text-muted">
            {isConsole ? "Konsol operator" : "Untuk warga"}
          </span>
        </div>
      </nav>

      <main className="container-x pb-28 pt-5 lg:pb-14">
        <div id="main">
          {children}
        </div>
      </main>

      <footer className="mt-2 hidden lg:block">
        <div className="container-x flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-4 text-[14px]">
          <p className="text-muted">
            Alat bantu keputusan, bukan peringatan resmi. Untuk prakiraan, cek BMKG.
          </p>
          {health.data ? (
            <p className="metric text-muted">
              {health.data.counts.buoy_observations} pembacaan · data{" "}
              {formatShortWib(health.data.generated_at)} WIB
            </p>
          ) : null}
        </div>
      </footer>

      {/* Phone: the board becomes a strip you can reach with a thumb. */}
      <nav
        aria-label="Navigasi utama"
        className="fixed inset-x-0 bottom-0 z-40 bg-paper/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-16px_rgba(23,25,27,0.3)] backdrop-blur lg:hidden"
      >
        <ul
          className="mx-auto grid max-w-lg"
          style={{ gridTemplateColumns: `repeat(${visibleNav.length + 1}, minmax(0, 1fr))` }}
        >
          {visibleNav.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "mx-0.5 my-2 flex h-[52px] flex-col items-center justify-center gap-[5px] rounded-2xl px-1 pb-1 text-[12.5px] leading-none transition-colors",
                    active ? "bg-signal-soft font-semibold text-signal" : "text-muted",
                  )}
                >
                  <item.icon className="h-[19px] w-[19px]" strokeWidth={active ? 2.2 : 1.8} aria-hidden />
                  {item.short}
                </Link>
              </li>
            );
          })}
          <li>
            <Link
              href={isConsole ? "/cek" : "/konsol"}
              className="mx-0.5 my-2 flex h-[52px] flex-col items-center justify-center gap-[5px] rounded-2xl px-1 pb-1 text-[12.5px] leading-none text-muted transition-colors"
            >
              {isConsole ? (
                <Anchor className="h-[19px] w-[19px]" strokeWidth={1.8} aria-hidden />
              ) : (
                <LayoutDashboard className="h-[19px] w-[19px]" strokeWidth={1.8} aria-hidden />
              )}
              {isConsole ? "Warga" : "Konsol"}
            </Link>
          </li>
        </ul>
      </nav>
    </div>
  );
}

import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Manrope, Space_Grotesk } from "next/font/google";

import { DashboardShell } from "@/components/dashboard/shell";
import { ServiceWorkerRegistrar } from "@/components/pwa-register";

import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-manrope",
  display: "swap",
});

const space = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-space",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "PantauPesisir — Konsol Pemantauan Pesisir",
    template: "%s · PantauPesisir",
  },
  description:
    "Konsol pemantauan pesisir dan intelijen risiko PantauPesisir: telemetri buoy tervalidasi, metadata Copernicus Sentinel-2 terverifikasi, dan penyaringan anomali berbasis pembelajaran mesin.",
  applicationName: "PantauPesisir",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "PantauPesisir",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0c2c31" },
    { media: "(prefers-color-scheme: dark)", color: "#0c2c31" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${manrope.variable} ${space.variable} ${jetbrains.variable}`}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
        >
          Lewati ke konten
        </a>
        <DashboardShell>
          <div id="main">{children}</div>
        </DashboardShell>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}

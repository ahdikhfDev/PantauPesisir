import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

import { DashboardShell } from "@/components/dashboard/shell";
import { ServiceWorkerRegistrar } from "@/components/pwa-register";

import "./globals.css";

// Three faces, three jobs. Barlow Condensed is the painted sign face: it only
// appears on the verdict and page names, always large. Plex Sans carries prose
// and UI. Plex Mono marks measurements, codes, and timestamps so a number is
// never mistaken for a sentence.
const sign = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-sign",
  display: "swap",
});

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "PantauPesisir — Cek Kondisi Laut Sebelum Berangkat",
    template: "%s · PantauPesisir",
  },
  description:
    "PantauPesisir membantu warga pesisir dan pengunjung pantai memeriksa ombak, angin, dan peringatan sebelum ke laut, dengan konsol teknis untuk pengguna lanjutan.",
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
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${sign.variable} ${plex.variable} ${plexMono.variable}`}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:border focus:border-ink focus:bg-paper focus:px-4 focus:py-2 focus:text-ink"
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

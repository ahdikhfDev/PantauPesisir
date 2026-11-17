import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Manrope, Space_Grotesk } from "next/font/google";

import { DashboardShell } from "@/components/dashboard/shell";

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
    default: "CEWS — Coastal Early Warning System",
    template: "%s · CEWS",
  },
  description:
    "Coastal monitoring and risk-intelligence console for the CEWS prototype: simulated buoy telemetry, verified Copernicus Sentinel-2 metadata and machine-learning anomaly screening. Not an official warning service.",
  applicationName: "CEWS",
};

export const viewport: Viewport = {
  themeColor: "#0c2c31",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${space.variable} ${jetbrains.variable}`}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:text-white"
        >
          Skip to content
        </a>
        <DashboardShell>
          <div id="main">{children}</div>
        </DashboardShell>
      </body>
    </html>
  );
}

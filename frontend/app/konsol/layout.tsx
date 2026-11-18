import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ringkasan teknis",
  description:
    "Konsol teknis PantauPesisir: telemetri buoy, metadata satelit Copernicus, analisis risiko, dan status sumber data.",
};

export default function KonsolLayout({ children }: { children: React.ReactNode }) {
  return children;
}

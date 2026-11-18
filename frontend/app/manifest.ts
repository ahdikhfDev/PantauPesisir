import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PantauPesisir — Konsol Pemantauan Pesisir",
    short_name: "PantauPesisir",
    description:
      "Konsol pemantauan pesisir: telemetri buoy, metadata satelit Copernicus, dan penyaringan anomali yang dapat ditelusuri. Bukan layanan peringatan resmi.",
    lang: "id",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#f4f2ec",
    theme_color: "#0c2c31",
    categories: ["weather", "utilities", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Ringkasan", short_name: "Ringkasan", url: "/" },
      { name: "Pemantauan laut", short_name: "Pemantauan", url: "/ocean" },
      { name: "Risiko AI", short_name: "Risiko AI", url: "/ai" },
      { name: "Peringatan", short_name: "Peringatan", url: "/alerts" },
    ],
  };
}

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PantauPesisir — Cek Kondisi Laut",
    short_name: "PantauPesisir",
    description:
      "Cek kondisi laut sebelum ke pantai atau melaut: ombak, angin, dan peringatan dalam bahasa sederhana.",
    lang: "id",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#1a3a38",
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
      { name: "Cek Kondisi", short_name: "Cek", url: "/cek" },
      { name: "Kabar Laut", short_name: "Kabar", url: "/ringkasan" },
      { name: "Belajar", short_name: "Belajar", url: "/belajar" },
      { name: "Peringatan warga", short_name: "Peringatan", url: "/alerts" },
    ],
  };
}

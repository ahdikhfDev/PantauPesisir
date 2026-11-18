import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ringkasan AI",
  description:
    "Ringkasan kondisi laut dalam bahasa sehari-hari untuk warga dan pengunjung pantai.",
};

export default function RingkasanLayout({ children }: { children: React.ReactNode }) {
  return children;
}

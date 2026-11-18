import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Kabar Laut",
  description:
    "Kabar kondisi laut hari ini dalam bahasa sehari-hari untuk warga dan pengunjung pantai.",
};

export default function RingkasanLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cek Sebelum ke Laut",
  description:
    "Pilih lokasi dan aktivitas, lalu lihat ringkasan kondisi laut: aman, hati-hati, atau sebaiknya tunda.",
};

export default function CekLayout({ children }: { children: React.ReactNode }) {
  return children;
}

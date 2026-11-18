import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Belajar",
  description:
    "Kenali istilah laut sehari-hari dan coba eksperimen kecil untuk memahami arti status aman, hati-hati, dan tunda.",
};

export default function BelajarLayout({ children }: { children: React.ReactNode }) {
  return children;
}

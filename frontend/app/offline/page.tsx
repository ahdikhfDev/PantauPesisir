import Link from "next/link";

export const metadata = {
  title: "Mode offline",
};

export default function OfflinePage() {
  return (
    <div className="mx-auto max-w-xl py-16">
      <div className="card border-l-2 border-l-amber p-6">
        <img src="/brand/logo.svg" alt="PantauPesisir" width={280} height={74} className="mb-5 h-auto w-[230px]" />
        <p className="text-[17px] font-medium tracking-[0.12em] text-muted">MODE OFFLINE</p>
        <h1 className="font-display mt-3 text-[22px] font-semibold">Koneksi terputus</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          Halaman yang sudah pernah dibuka masih dapat diakses dari cache. Data operasional
          membutuhkan koneksi karena konsol selalu mengambil nilai terbaru dari API.
        </p>
        <ul className="mt-4 space-y-1.5 text-[13.5px] text-muted">
          <li>
            · Cek Kondisi, Kabar Laut, Belajar, Peringatan warga, dan konsol teknis tersedia offline.
          </li>
          <li>· Analisis baru, sinkronisasi satelit, dan perubahan peringatan memerlukan jaringan.</li>
        </ul>
        <div className="mt-5 flex gap-2">
          <Link href="/" className="btn btn-primary btn-sm">
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    </div>
  );
}

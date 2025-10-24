"use client";
import Link from "next/link";
import FooterTabs from "@/components/FooterTabs";

export default function RatingsHubPage() {
  return (
    <>
      <div className="mx-auto max-w-4xl p-4 pb-24 text-white">
        <h1 className="text-lg font-semibold mb-2">Değerlendir</h1>
        <p className="text-sm text-neutral-300">
          Bekleyen özel bir değerlendirme akışı yok. Oyuncu ekranındaki
          “Davranış Değerlendirmeleri” kartından devam edebilirsin.
        </p>
        <div className="mt-3">
          <Link
            href="/oyuncu#ratings"
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-neutral-950 hover:bg-emerald-500"
          >
            Oyuncu sayfasındaki karta git
          </Link>
        </div>
      </div>
      <FooterTabs />
    </>
  );
}

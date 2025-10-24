"use client";

import * as React from "react";
import Link from "next/link";
import RateMatchModal, { RatePayload } from "./RateMatchModal";
import { authHeader } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/** Landing’dekİ ile birebir aynı davranış: bekleyen varsa sarı, yoksa gri; tıklayınca modal açılır */
export default function PendingRatingsBell() {
  const [items, setItems] = React.useState<RatePayload[]>([]);
  const [open, setOpen] = React.useState(false);
  const [payload, setPayload] = React.useState<RatePayload | null>(null);

  const load = React.useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/ratings/pending`, {
        headers: { ...authHeader() },
        cache: "no-store",
      });
      const j = await r.json().catch(() => ({}));
      const arr = Array.isArray(j?.items) ? j.items : [];
      setItems(arr);
    } catch {}
  }, []);

  React.useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const count = items.length;

  return (
    <>
      <button
        onClick={() => {
          if (items[0]) {
            setPayload(items[0]);
            setOpen(true);
          }
        }}
        className={`rounded-lg px-3 py-1.5 text-sm ${
          count ? "bg-amber-600/90 hover:bg-amber-600 text-black" : "bg-neutral-800 text-neutral-300"
        }`}
        title="Değerlendirme bekliyor"
        disabled={!count}
      >
        Değerlendir ({count})
      </button>

      <Link
        href="/notifications"
        className="hidden" // sadece landing ile aynı yerleşim için placeholder; istersen kaldır
      >
        Bildirimler
      </Link>

      <RateMatchModal open={open} onClose={() => setOpen(false)} match={payload} onSaved={load} />
    </>
  );
}

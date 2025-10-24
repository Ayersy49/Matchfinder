"use client";

import * as React from "react";
import Link from "next/link";
import { authHeader } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/** Landing’dekine eş: unread sayısını çekip etikete yazıyor; tıklayınca /notifications'a gider. */
export default function NotificationsBell() {
  const [unread, setUnread] = React.useState<number>(0);

  const load = React.useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/notifications?unread=1`, {
        headers: { ...(authHeader() as any) },
        cache: "no-store",
      });
      const j = await r.json().catch(() => ({}));
      const count = Array.isArray(j?.items) ? j.items.length : Number(j?.count || 0);
      setUnread(count || 0);
    } catch {
      setUnread(0);
    }
  }, []);

  React.useEffect(() => {
    load();
    const t = setInterval(load, 20000); // 20 sn’de bir tazele
    return () => clearInterval(t);
  }, [load]);

  // landing’deki stil ile uyumlu basit bir buton/Link
  const label = unread > 0 ? `Bildirimler (${unread})` : "Bildirimler";

  return (
    <Link
      href="/notifications"
      className="rounded-xl bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
      title={label}
      prefetch={false}
    >
      {label}
    </Link>
  );
}

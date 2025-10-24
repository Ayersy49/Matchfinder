"use client";

import * as React from "react";
import Link from "next/link";
import { authHeader } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/** Bekleyen davet sayısını gösterir, tıklayınca /invites açar. */
export default function InvitesBell() {
  const [pending, setPending] = React.useState<number>(0);

  const load = React.useCallback(async () => {
    try {
      // Gelen kutusunda PENDING olanları say
      const r = await fetch(`${API_URL}/matches/invites/inbox?status=PENDING`, {
        headers: { ...(authHeader() as any) },
        cache: "no-store",
      });
      const j = await r.json().catch(() => ({}));
      const count = Array.isArray(j?.items) ? j.items.length : Number(j?.count || 0);
      setPending(count || 0);
    } catch {
      setPending(0);
    }
  }, []);

  React.useEffect(() => {
    load();
    const t = setInterval(load, 20000); // 20 sn’de bir tazele
    return () => clearInterval(t);
  }, [load]);

  const label = pending > 0 ? `Davetler (${pending})` : "Davetler";

  return (
    <Link
      href="/invites"
      className="rounded-xl bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
      title={label}
      prefetch={false}
    >
      {label}
    </Link>
  );
}

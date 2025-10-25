"use client";
import * as React from "react";
import Link from "next/link";
import { getMyTeams } from "@/lib/api";

export default function TeamsTab() {
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    getMyTeams()
      .then(setItems)
      .catch((e) => setErr(e?.message || String(e)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Takımlarım</h1>
        <Link href="/teams/new" className="rounded-xl bg-emerald-600 px-3 py-1.5 text-sm">
          Yeni Takım
        </Link>
      </div>

      {loading && <div>Yükleniyor…</div>}
      {err && <div className="text-red-400 text-sm">Error: {err}</div>}

      <div className="grid gap-3">
        {items.map((t) => (
          <div key={t.id} className="rounded-xl bg-neutral-900 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-base font-medium">{t.name}</div>
                <div className="text-xs text-neutral-400">
                  {t.city || ""} {t.district || ""}
                </div>
              </div>
              <div className="flex gap-2">
                <Link href={`/team/${t.id}`} className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm">
                  Aç
                </Link>
                <Link href={`/team/${t.id}?opponent=new`} className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm">
                  Rakip Ara
                </Link>
              </div>
            </div>
          </div>
        ))}
        {!loading && items.length === 0 && (
          <div className="text-neutral-400 text-sm">Henüz takım yok.</div>
        )}
      </div>
    </div>
  );
}

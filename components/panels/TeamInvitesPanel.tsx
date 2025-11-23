"use client";
import React from "react";
import { getMyTeamInviteInbox, respondTeamInvite } from "@/lib/api";

type TeamInvite = {
  id: string;
  teamId: string;
  status: string;          // PENDING|ACCEPTED|REJECTED|...
  message?: string | null;
  createdAt?: string;
  team?: { id: string; name: string } | null;
};

export default function TeamInvitesPanel({
  limit,
  compact = false,
}: { limit?: number; compact?: boolean }) {
  const [items, setItems] = React.useState<TeamInvite[]>([]);
  const [loading, setLoading] = React.useState(true);

  async function refresh() {
    try {
      setLoading(true);
      const list = await getMyTeamInviteInbox(); // GET /team-invites/inbox
      setItems(Array.isArray(list) ? list : []);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { refresh(); }, []);

  async function act(id: string, action: "accept" | "decline") {
    const ok = await respondTeamInvite(id, action); // POST /team-invites/:id/respond
    if (!ok) {
      alert("İşlem başarısız.");
      return;
    }
    refresh();
  }

  const data = typeof limit === "number" ? items.slice(0, limit) : items;

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
        <div className="h-6 w-40 animate-pulse rounded bg-neutral-800" />
        <div className="mt-3 h-16 animate-pulse rounded bg-neutral-800" />
      </div>
    );
  }

  if (!data.length) {
    return compact ? null : (
      <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
        <div className="text-sm text-neutral-400">Takım daveti yok.</div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
      {!compact && <div className="mb-2 text-base font-semibold">Takım Davetleri</div>}
      <div className="space-y-2">
        {data.map((inv) => (
          <div key={inv.id} className="flex items-center justify-between rounded-lg bg-neutral-800/60 p-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">
                {inv.team?.name ?? "Takım"} daveti
              </div>
              {inv.message && (
                <div className="mt-0.5 line-clamp-2 text-xs text-neutral-400">{inv.message}</div>
              )}
            </div>
            <div className="shrink-0 space-x-2">
              <button
                onClick={() => act(inv.id, "decline")}
                className="rounded-lg bg-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-600"
              >
                Reddet
              </button>
              <button
                onClick={() => act(inv.id, "accept")}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-neutral-950 hover:bg-emerald-500"
              >
                Kabul Et
              </button>
            </div>
          </div>
        ))}
      </div>
      {typeof limit === "number" && items.length > limit && (
        <div className="mt-2 text-right text-xs text-neutral-400">
          +{items.length - limit} daha…
        </div>
      )}
    </div>
  );
}

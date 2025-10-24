"use client";

import * as React from "react";
import Link from "next/link";
import FooterTabs from "@/components/FooterTabs";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const getToken = () => {
  try {
    return (
      localStorage.getItem("token") ||
      localStorage.getItem("access_token") ||
      localStorage.getItem("jwt") ||
      ""
    );
  } catch {
    return "";
  }
};

type NotificationRow = {
  id: string;
  type?: string | null;
  message?: string | null;
  matchId?: string | null;
  data?: any;
  readAt?: string | null;
  createdAt?: string;
};

export default function NotificationsPage() {
  const [items, setItems] = React.useState<NotificationRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [unreadOnly, setUnreadOnly] = React.useState(false);

  async function load() {
    setLoading(true);
    try {
      const qs = unreadOnly ? "?unread=1" : "";
      const r = await fetch(`${API_URL}/notifications${qs}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
        cache: "no-store",
      });
      const j = await r.json().catch(() => ({}));
      setItems(Array.isArray(j?.items) ? j.items : []);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, [unreadOnly]);

  async function markRead(id: string) {
    try {
      const r = await fetch(`${API_URL}/notifications/${id}/read`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.message || `HTTP ${r.status}`);
      await load();
    } catch (e: any) {
      alert(e?.message || "Bildirim okunamadı");
    }
  }

  return (
    <>
      <div className="mx-auto max-w-4xl p-4 pb-24 text-white">
        <div className="mb-3 flex items-center gap-2">
          <h1 className="text-lg font-semibold">Bildirimler</h1>
          <label className="ml-2 flex items-center gap-2 text-sm text-neutral-300">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
            />
            Sadece okunmamışlar
          </label>
          <button
            onClick={load}
            className="ml-auto rounded-lg bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
          >
            Yenile
          </button>
        </div>

        {loading ? (
          <div className="text-sm text-neutral-400">Yükleniyor…</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-neutral-400">Bildirim yok.</div>
        ) : (
          <div className="space-y-2">
            {items.map((n) => {
              const isUnread = !n.readAt;
              const when = n.createdAt
                ? new Date(n.createdAt).toLocaleString([], {
                    dateStyle: "short",
                    timeStyle: "short",
                  })
                : "";
              const label =
                n.message ||
                (n.type === "rating_reminder"
                  ? "Maç değerlendirme hatırlatması"
                  : (n.type || "Bildirim"));

              return (
                <div
                  key={n.id}
                  className={`rounded-xl border border-white/10 bg-neutral-900/60 p-3 ${
                    isUnread ? "ring-1 ring-emerald-500/20" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{label}</div>
                      <div className="text-xs text-neutral-400">{when}</div>
                      {n.matchId && (
                        <div className="mt-1">
                          <Link
                            href={`/match/${n.matchId}`}
                            className="text-xs text-emerald-300 hover:underline"
                          >
                            Maç detayına git
                          </Link>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isUnread && (
                        <button
                          onClick={() => markRead(n.id)}
                          className="rounded-lg bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700"
                        >
                          Okundu işaretle
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <FooterTabs />
    </>
  );
}

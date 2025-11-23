"use client";

import React from "react";
import Link from "next/link";
import { Bell, Check, ExternalLink } from "lucide-react";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/api";

type Noti = {
  id: string;
  type: string;               // "time_proposal" | "time_proposal_vote" | "time_proposal_admin_approve" ...
  matchId?: string | null;
  data?: any;
  createdAt: string;
  readAt?: string | null;
};

function formatWhen(iso: string) {
  const d = new Date(iso);
  const now = Date.now();
  const diff = (now - d.getTime()) / 1000;
  if (diff < 60) return "az önce";
  if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} sa önce`;
  return d.toLocaleDateString("tr-TR") + " " + d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
}

function pretty(n: Noti) {
  switch (n.type) {
    case "time_proposal":
      return { title: "Yeni saat önerisi", desc: "Maç için yeni bir saat teklif edildi." };
    case "time_proposal_vote":
      return { title: "Saat önerisine oy", desc: "Bir oyuncu saat önerisine oy verdi." };
    case "time_proposal_admin_approve":
      return { title: "Saat kesinleşti", desc: "Kaptan onayı alındı." };

    case "access_approved":
      return { title: "Erişim onaylandı", desc: "Maça katılma talebin kabul edildi." };
    case "access_declined":
      return { title: "Erişim reddedildi", desc: "Maça katılma talebin reddedildi." };

    case "rating_reminder":
      return { title: "Puanlama zamanı", desc: "Maç bitti, takım arkadaşlarını değerlendir." };

    default:
      return { title: n.type.replace(/_/g, " "), desc: "" };
  }
}


export default function NotificationsBell({
  className,
}: {
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<Noti[]>([]);
  const unread = items.filter((x) => !x.readAt).length;

  async function refresh() {
    try {
      const list = await getNotifications();
      setItems(Array.isArray(list) ? list : []);
    } catch (e) {
      // yut
    }
  }

  React.useEffect(() => {
    refresh();
  }, []);

  async function handleMarkAll() {
    await markAllNotificationsRead();
    await refresh();
  }

  async function handleMarkOne(id: string) {
    await markNotificationRead(id);
    await refresh();
  }

  return (
    <div className={`relative ${className || ""}`}>
      {/* Bell */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-lg bg-neutral-900 px-2 py-2 ring-1 ring-white/10 hover:bg-neutral-800"
        aria-label="Bildirimler"
      >
        <Bell className="h-5 w-5 text-neutral-200" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid min-w-[18px] place-items-center rounded-full bg-emerald-600 px-1 text-[10px] font-semibold text-neutral-950">
            {unread}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          className="absolute right-0 z-50 mt-2 w-[360px] overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 shadow-xl"
          onBlur={() => setOpen(false)}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <div className="text-sm font-medium">Bildirimler</div>
            <div className="flex items-center gap-2">
              <button
                onClick={refresh}
                className="rounded-md bg-neutral-800 px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-700"
              >
                Yenile
              </button>
              <button
                onClick={handleMarkAll}
                className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold text-neutral-950 hover:bg-emerald-500"
              >
                <Check className="h-3.5 w-3.5" />
                Hepsini okundu yap
              </button>
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {items.length === 0 && (
              <div className="p-4 text-sm text-neutral-400">Bildirim yok.</div>
            )}

            {items.map((n) => {
              const meta = pretty(n);
              const isUnread = !n.readAt;
              return (
                <div
                  key={n.id}
                  className={[
                    "flex items-start gap-3 border-b border-white/5 px-3 py-3",
                    isUnread ? "bg-emerald-600/5" : "bg-transparent",
                  ].join(" ")}
                >
                  {/* bullet */}
                  <div
                    className={[
                      "mt-[6px] size-2 rounded-full",
                      isUnread ? "bg-emerald-500" : "bg-neutral-600",
                    ].join(" ")}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-neutral-100">
                      {meta.title}
                    </div>
                    <div className="truncate text-xs text-neutral-400">
                      {meta.desc}
                    </div>
                    <div className="mt-1 text-[11px] text-neutral-500">
                      {formatWhen(n.createdAt)}
                    </div>

                    <div className="mt-2 flex gap-2">
                      {n.matchId && (
                        <Link
                          href={`/matches/${n.matchId}`}
                          className="inline-flex items-center gap-1 rounded-md bg-neutral-800 px-2 py-1 text-xs text-neutral-200 ring-1 ring-white/10 hover:bg-neutral-700"
                          onClick={() => setOpen(false)}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Maç detayı
                        </Link>
                      )}
                      {isUnread && (
                        <button
                          onClick={() => handleMarkOne(n.id)}
                          className="inline-flex items-center gap-1 rounded-md bg-neutral-800 px-2 py-1 text-xs text-neutral-200 ring-1 ring-white/10 hover:bg-neutral-700"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Okundu
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import FooterTabs from "@/components/FooterTabs";
import {
  BellRing,
  Clock,
  ThumbsUp,
  CheckCircle2,
  Star,
  ChevronRight,
  XCircle,            
} from "lucide-react";


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

// ---- helpers ----
function formatRelative(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diff < 60) return "az önce";
  if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} sa önce`;
  return d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function dayBucket(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return "Bugün";

  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  const isYesterday =
    d.getFullYear() === y.getFullYear() &&
    d.getMonth() === y.getMonth() &&
    d.getDate() === y.getDate();
  if (isYesterday) return "Dün";

  return d.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });
}

function iconAndTitle(n: NotificationRow) {
  switch (n.type) {
    case "time_proposal":
      return { Icon: Clock, title: "Yeni saat önerisi" };
    case "time_proposal_vote":
      return { Icon: ThumbsUp, title: "Saat önerisine oy verildi" };
    case "time_proposal_admin_approve":
      return { Icon: CheckCircle2, title: "Kaptan onayı: saat kesinleşti" };

    case "access_approved":
      return { Icon: CheckCircle2, title: "Maça erişim onaylandı" };
    case "access_declined":
      return { Icon: XCircle, title: "Maça erişim reddedildi" };

    case "rating_reminder":
      return { Icon: Star, title: "Maç değerlendirme hatırlatması" };

    default:
      return { Icon: BellRing, title: n.message || "Bildirim" };
  }
}


function groupByDay(items: NotificationRow[]) {
  const buckets: Record<string, NotificationRow[]> = {};
  for (const it of items) {
    const b = dayBucket(it.createdAt);
    if (!buckets[b]) buckets[b] = [];
    buckets[b].push(it);
  }
  // kronolojik: en yeni üstte
  return Object.entries(buckets).sort((a, b) => {
    const ad = a[1][0]?.createdAt || "";
    const bd = b[1][0]?.createdAt || "";
    return (new Date(bd).getTime() - new Date(ad).getTime());
  });
}

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

  // Backend'te toplu endpoint yoksa hepsini tek tek işaretler
  async function markAllRead() {
    const unread = items.filter((x) => !x.readAt).map((x) => x.id);
    if (!unread.length) return;
    await Promise.allSettled(unread.map((id) => fetch(`${API_URL}/notifications/${id}/read`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
    })));
    await load();
  }

  const grouped = groupByDay(items);

  return (
    <>
      <div className="mx-auto max-w-4xl p-4 pb-24 text-white">
        {/* header */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold">Bildirimler</h1>

          <button
            onClick={() => setUnreadOnly((v) => !v)}
            className={`rounded-full px-3 py-1 text-sm ${
              unreadOnly
                ? "bg-emerald-600 text-neutral-950"
                : "bg-neutral-800 hover:bg-neutral-700"
            }`}
          >
            Sadece okunmamışlar
          </button>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={markAllRead}
              className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
            >
              Tümünü okundu say
            </button>
            <button
              onClick={load}
              className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
            >
              Yenile
            </button>
          </div>
        </div>

        {/* content */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-neutral-900/60" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-sm text-neutral-400">Bildirim yok.</div>
        ) : (
          <div className="space-y-6">
            {grouped.map(([day, rows]) => (
              <div key={day} className="space-y-2">
                <div className="text-xs uppercase tracking-wider text-neutral-400">
                  {day}
                </div>

                <div className="space-y-2">
                  {rows.map((n) => {
                    const isUnread = !n.readAt;
                    const { Icon, title } = iconAndTitle(n);
                    const subtitle = n.message && n.message !== title ? n.message : undefined;
                    const href = n.matchId ? `/matches/${n.matchId}` : undefined;


                    const Card = (
                      <div
                        className={`group relative flex items-center gap-3 rounded-xl border border-white/10 bg-neutral-900/60 p-3 transition ${
                          isUnread ? "ring-1 ring-emerald-500/20" : ""
                        }`}
                      >
                        <div className="grid size-10 place-items-center rounded-full bg-neutral-800">
                          <Icon className="h-5 w-5 text-neutral-200" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">
                            {title}
                          </div>
                          <div className="mt-0.5 line-clamp-2 text-sm text-neutral-300">
                            {subtitle || ""}
                          </div>
                          <div className="mt-1 text-xs text-neutral-400">
                            {formatRelative(n.createdAt)}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          {isUnread && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                markRead(n.id);
                              }}
                              className="rounded-lg bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700"
                            >
                              Okundu
                            </button>
                          )}
                          {href && (
                            <ChevronRight className="h-4 w-4 text-neutral-500 group-hover:text-neutral-300" />
                          )}
                        </div>
                      </div>
                    );

                    return href ? (
                      <Link key={n.id} href={href} prefetch={false}>
                        {Card}
                      </Link>
                    ) : (
                      <div key={n.id}>{Card}</div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <FooterTabs />
    </>
  );
}

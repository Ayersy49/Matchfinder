// app/invites/InvitesInbox.tsx
"use client";

import * as React from "react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function getToken(): string {
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
}

type InviteRow = {
  id: string;
  matchId: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED";
  message: string | null;
  createdAt: string;
  updatedAt: string;
  from?: { id: string; phone: string | null };
  to?: { id: string; phone: string | null };
  match?: {
    id: string;
    title: string | null;
    time: string | null;
    location: string | null;
    format: string | null;
    level: string | null;
  };
};

const STATUS_TR: Record<InviteRow["status"], string> = {
  PENDING: "Bekliyor…",
  ACCEPTED: "Kabul edildi",
  DECLINED: "Reddedildi",
  CANCELLED: "İptal edildi",
};

export default function InvitesInbox() {
  const [tab, setTab] = React.useState<"INBOX" | "SENT">("INBOX");
  const [items, setItems] = React.useState<InviteRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<"" | InviteRow["status"]>("");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const qs = filter ? `?status=${filter}` : "";
      const url =
        tab === "INBOX"
          ? `${API_URL}/matches/invites/inbox${qs}`
          : `${API_URL}/matches/invites/sent${qs}`;
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${getToken()}` },
        cache: "no-store",
      });
      const data = await r.json();
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      console.error(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [tab, filter]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function respond(inviteId: string, action: "ACCEPT" | "DECLINE" | "CANCEL") {
    try {
      const r = await fetch(`${API_URL}/matches/invites/${inviteId}/respond`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ action }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data?.ok) throw new Error(data?.message || "İşlem başarısız");
      await load();
    } catch (e: any) {
      alert(e?.message || "İşlem başarısız");
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-900/60">
      {/* ====== ÜST BAR: Ana menü + Başlık ====== */}
      <div className="flex items-center justify-between border-b border-white/10 p-3">
        <div className="flex items-center gap-2">
          <Link
            href="/landing"
            className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
          >
            ← Ana menü
          </Link>
          <div className="text-base font-semibold">Davetler</div>
        </div>
      </div>

      {/* ====== SEKME + FİLTRE ====== */}
      <div className="flex items-center justify-between border-b border-white/10 p-3">
        <div className="flex gap-2">
          <button
            onClick={() => setTab("INBOX")}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              tab === "INBOX" ? "bg-white/10" : "bg-neutral-800 hover:bg-neutral-700"
            }`}
          >
            Gelen davetler
          </button>
          <button
            onClick={() => setTab("SENT")}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              tab === "SENT" ? "bg-white/10" : "bg-neutral-800 hover:bg-neutral-700"
            }`}
          >
            Gönderilen davetler
          </button>
        </div>

        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as any)}
          className="rounded-md border border-white/10 bg-neutral-800 px-2 py-1 text-sm"
        >
          <option value="">Tümü</option>
          <option value="PENDING">Bekliyor…</option>
          <option value="ACCEPTED">Kabul edildi</option>
          <option value="DECLINED">Reddedildi</option>
          <option value="CANCELLED">İptal edildi</option>
        </select>
      </div>

      {/* ====== LİSTE ====== */}
      <div className="p-3">
        {loading ? (
          <div className="text-sm text-neutral-400">Yükleniyor…</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-neutral-400">Kayıt yok.</div>
        ) : (
          <div className="space-y-2">
            {items.map((x) => {
              const canAcceptDecline = tab === "INBOX" && x.status === "PENDING";
              const canCancel = tab === "SENT" && x.status === "PENDING";
              const matchId = x.match?.id ?? x.matchId; // Detay linki için

              return (
                <div
                  key={x.id}
                  className="rounded-xl border border-white/10 bg-neutral-900 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">
                        {tab === "INBOX" ? (
                          <>
                            <span className="opacity-70">Gönderen:</span>{" "}
                            {x.from?.phone ?? "—"}
                          </>
                        ) : (
                          <>
                            <span className="opacity-70">Alıcı:</span>{" "}
                            {x.to?.phone ?? "—"}
                          </>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-neutral-300">
                        {x.match?.title || "Maç"} • {x.match?.location || "—"} •{" "}
                        {x.match?.format || "—"}
                        {x.match?.time
                          ? ` • ${new Date(x.match.time).toLocaleString([], {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}`
                          : ""}
                      </div>
                      {x.message ? (
                        <div className="mt-1 text-xs italic text-neutral-400">
                          “{x.message}”
                        </div>
                      ) : null}
                    </div>

                    {/* durum badge */}
                    <span
                      className={[
                        "rounded-full px-2 py-1 text-xs ring-1",
                        x.status === "PENDING"
                          ? "bg-amber-500/20 text-amber-300 ring-amber-500/30"
                          : x.status === "ACCEPTED"
                          ? "bg-emerald-500/20 text-emerald-300 ring-emerald-500/30"
                          : x.status === "DECLINED"
                          ? "bg-rose-500/20 text-rose-300 ring-rose-500/30"
                          : "bg-zinc-700/30 text-zinc-300 ring-zinc-500/30",
                      ].join(" ")}
                      title={x.status}
                    >
                      {STATUS_TR[x.status]}
                    </span>

                    {/* aksiyonlar */}
                    <div className="flex items-center gap-2">
                      {/* Kabul edilmiş davet → Maç detayına git */}
                      {x.status === "ACCEPTED" && matchId && (
                        <Link
                          href={`/match/${matchId}`}
                          className="rounded-lg bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700"
                          title="Maç detayına git"
                        >
                          Detay
                        </Link>
                      )}

                      {canAcceptDecline && (
                        <>
                          <button
                            onClick={() => respond(x.id, "ACCEPT")}
                            className="text-xs text-emerald-300 hover:underline"
                          >
                            Kabul et
                          </button>
                          <button
                            onClick={() => respond(x.id, "DECLINE")}
                            className="text-xs text-rose-300 hover:underline"
                          >
                            Reddet
                          </button>
                        </>
                      )}
                      {canCancel && (
                        <button
                          onClick={() => respond(x.id, "CANCEL")}
                          className="text-xs text-amber-300 hover:underline"
                        >
                          İptal et
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
    </div>
  );
}

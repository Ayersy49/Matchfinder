"use client";

import React from "react";
import Link from "next/link";
import PendingRatingsBell from "@/app/ratings/PendingRatingsBell";
import NotificationsBell from "@/app/notifications/NotificationsBell";
import InvitesBell from "@/app/invites/InvitesBell";
import { authHeader } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const H = (): HeadersInit => (authHeader() as unknown as HeadersInit);

type SeriesRow = {
  id: string;
  title: string;
  location?: string | null;
  format: string;
  inviteOnly: boolean;
  canRSVP?: boolean;
  nextMatch?: {
    id: string;
    time: string;
    attendance?: { going: number; notGoing: number };
  } | null;
};

export default function SeriesTab() {
  const [level, setLevel] = React.useState<"" | "Kolay" | "Orta" | "Zor">("");
  const [format, setFormat] = React.useState<
    "" | "5v5" | "6v6" | "7v7" | "8v8" | "9v9" | "10v10" | "11v11"
  >("");
  const [items, setItems] = React.useState<SeriesRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  async function refresh() {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (level) qs.set("level", level);
      if (format) qs.set("format", format);
      const r = await fetch(`${API_URL}/series/active?${qs.toString()}`, {
        headers: { ...H() },
        cache: "no-store",
      });
      const j = await r.json().catch(() => ({}));
      setItems(Array.isArray(j) ? j : []);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    refresh();
  }, [level, format]);

  async function downloadIcs(matchId: string, title?: string | null) {
    try {
      const r = await fetch(`${API_URL}/matches/${matchId}/ics`, {
        headers: { ...H() },
        cache: "no-store",
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `match-${matchId}.ics`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e?.message || "ICS indirilemedi");
    }
  }

  async function rsvp(matchId: string, status: "GOING" | "NOT_GOING") {
    try {
      const r = await fetch(`${API_URL}/matches/${matchId}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...H() },
        body: JSON.stringify({ status }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.ok !== true) throw new Error(j?.message || `HTTP ${r.status}`);
      await refresh();
    } catch (e: any) {
      alert(e?.message || "RSVP hatası");
    }
  }

  return (
    <div className="mx-auto max-w-4xl text-white">
      {/* Üst bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link
          href="/series/new"
          className="rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-medium text-neutral-950 hover:bg-emerald-500"
        >
          Seri Oluştur
        </Link>

        <div className="ml-2 flex flex-wrap items-center gap-2">
          <label className="text-xs opacity-75">Seviye</label>
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value as any)}
            className="rounded-lg border border-white/10 bg-neutral-900/60 px-2 py-1 text-sm"
          >
            <option value="">Hepsi</option>
            <option>Kolay</option>
            <option>Orta</option>
            <option>Zor</option>
          </select>

          <label className="ml-2 text-xs opacity-75">Format</label>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as any)}
            className="rounded-lg border border-white/10 bg-neutral-900/60 px-2 py-1 text-sm"
          >
            <option value="">Hepsi</option>
            <option>5v5</option>
            <option>6v6</option>
            <option>7v7</option>
            <option>8v8</option>
            <option>9v9</option>
            <option>10v10</option>
            <option>11v11</option>
          </select>
        </div>

        {/* Sağ üst aksiyonlar */}
        <div className="ml-auto flex items-center gap-2">
          <PendingRatingsBell />
          <NotificationsBell />
          <Link
            href="/friends"
            className="rounded-xl bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
          >
            Arkadaşlar
          </Link>
          <InvitesBell />
          <button
            onClick={refresh}
            className="rounded-xl bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
          >
            Yenile
          </button>
        </div>
      </div>

      {/* Liste */}
      {loading && <div className="text-sm text-neutral-400">Yükleniyor…</div>}
      {!loading && !items.length && (
        <div className="text-sm text-neutral-400">Kayıt yok</div>
      )}

      <div className="space-y-3">
        {items.map((s) => {
          const nm = s.nextMatch ?? null;
          const dt = nm?.time ? new Date(nm.time) : null;
          const dayLbl = dt ? ["Paz","Pts","Sal","Çar","Per","Cum","Cts"][dt.getDay()] : null;
          const human = dt
            ? `${dayLbl} ${String(dt.getHours()).padStart(2, "0")}:${String(
                dt.getMinutes()
              ).padStart(2, "0")} • ${dt.toLocaleDateString()}`
            : "—";

          const going = nm?.attendance?.going ?? 0;
          const notGoing = nm?.attendance?.notGoing ?? 0;

          return (
            <div
              key={s.id}
              className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                {/* SOL */}
                <div>
                  <div className="text-base font-semibold flex items-center gap-2">
                    <span>{s.title || "Seri"}</span>
                    {s.inviteOnly ? (
                      <span className="rounded bg-neutral-700 px-2 py-0.5 text-xs">
                        Kilitli
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-xs text-neutral-300">
                    {s.location || "—"} • {s.format || "—"} • {human}
                  </div>

                  {/* RSVP sayacı */}
                  {nm && (
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <span className="rounded-full bg-emerald-600/20 px-2 py-0.5 text-emerald-300 ring-1 ring-emerald-500/30">
                        Geliyor: {going}
                      </span>
                      <span className="rounded-full bg-rose-600/20 px-2 py-0.5 text-rose-300 ring-1 ring-rose-500/30">
                        Gelmiyor: {notGoing}
                      </span>
                    </div>
                  )}
                </div>

                {/* SAĞ */}
                <div className="flex items-center gap-2">
                  <Link
                    href={nm ? `/match/${nm.id}` : "#"}
                    className="rounded-xl bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
                    aria-disabled={!nm}
                    onClick={(e) => {
                      if (!nm) e.preventDefault();
                    }}
                  >
                    Detay
                  </Link>

                  <button
                    onClick={() => nm && downloadIcs(nm.id, s.title)}
                    disabled={!nm}
                    className="rounded-xl bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700 disabled:opacity-50"
                  >
                    Takvime ekle
                  </button>

                  {/* Sadece owner/üyeye RSVP butonları */}
                  {s.canRSVP && nm && (
                    <>
                      <button
                        onClick={() => rsvp(nm.id, "GOING")}
                        className="rounded-xl bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
                        title="Bu hafta geliyorum"
                      >
                        Geliyorum
                      </button>
                      <button
                        onClick={() => rsvp(nm.id, "NOT_GOING")}
                        className="rounded-xl bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
                        title="Bu hafta gelemeyeceğim"
                      >
                        Gelmeyeceğim
                      </button>
                    </>
                  )}

                  {/* Admin (owner) yayınla */}
                  {nm && (
                    <button
                      onClick={async () => {
                        try {
                          const r = await fetch(
                            `${API_URL}/matches/${nm.id}/publish`,
                            {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                ...(H() as any),
                              },
                              body: JSON.stringify({ listed: true }),
                            }
                          );
                          const j = await r.json().catch(() => ({}));
                          if (!r.ok || j?.ok !== true)
                            throw new Error(j?.message || "Hata");
                          alert("Maç yayınlandı (genel listeye düştü).");
                          await refresh();
                        } catch (e: any) {
                          alert(e?.message || "Hata");
                        }
                      }}
                      className="rounded-xl bg-emerald-600 px-3 py-1.5 text-sm text-neutral-950 hover:bg-emerald-500"
                    >
                      Yayınla
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

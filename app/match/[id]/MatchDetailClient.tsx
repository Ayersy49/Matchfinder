// app/match/[id]/MatchDetailClient.tsx  (CLIENT COMPONENT)
"use client";

import React from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type Slot = { pos: string; userId?: string | null };
type MatchDetail = {
  id: string;
  title: string | null;
  location: string | null;
  level: string | null;
  format: string | null;
  price: number | null;
  time: string | null;
  slots: Slot[];
};

function getToken(): string {
  try {
    return localStorage.getItem("token") || "";
  } catch {
    return "";
  }
}

function myId(): string | null {
  try {
    const t = getToken();
    if (!t) return null;
    const p = JSON.parse(atob(t.split(".")[1] || ""));
    return p?.id || p?.sub || p?.userId || null;
  } catch {
    return null;
  }
}

export default function MatchDetailClient({ id }: { id: string }) {
  const me = myId();

  const [m, setM] = React.useState<MatchDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/matches/${id}`, { cache: "no-store" });
      const data = await r.json();
      setM(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  // benim slotum
  const mySlot = m?.slots?.find((s) => s.userId === me);

  async function join(pos?: string) {
    try {
      setBusy(true);
      const r = await fetch(`${API_URL}/matches/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ matchId: id, pos }),
      });
      const data = await r.json();
      if (!r.ok || !data?.ok) throw new Error(data?.message || "Katılım başarısız");
      await refresh();
    } catch (e: any) {
      alert(e?.message || "Katılım başarısız");
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    try {
      setBusy(true);
      const r = await fetch(`${API_URL}/matches/leave`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ matchId: id }),
      });
      const data = await r.json();
      if (!r.ok || !data?.ok) throw new Error(data?.message || "Ayrılma başarısız");
      await refresh();
    } catch (e: any) {
      alert(e?.message || "Ayrılma başarısız");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="p-6 text-sm text-neutral-400">Yükleniyor…</div>;
  if (!m) return <div className="p-6 text-sm text-red-400">Maç bulunamadı</div>;

  return (
    <div className="mx-auto max-w-4xl p-4 space-y-4">
      {/* Başlık */}
      <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-base font-semibold">{m.title || "Maç"}</div>
            <div className="mt-1 text-xs text-neutral-300">
              {m.location || "—"} • {m.format || "—"} • {m.level || "—"}
              {m.price != null ? <> • Fiyat: ₺{m.price}</> : null}
              {m.time ? (
                <> • Saat: {new Date(m.time).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</>
              ) : null}
              <> • ID: {m.id}</>
            </div>
            <div className="mt-2 text-xs">
              Senin pozisyonun:{" "}
              {mySlot ? <span className="text-emerald-400">{mySlot.pos}</span> : <span className="text-neutral-400">—</span>}
            </div>
          </div>

          {mySlot ? (
            <button
              onClick={leave}
              disabled={busy}
              className="rounded-xl bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700 disabled:opacity-50"
            >
              Ayrıl
            </button>
          ) : null}
        </div>
      </div>

      {/* Pozisyonlar */}
      <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
        <div className="mb-2 text-sm font-medium">Pozisyonlar</div>
        <div className="flex flex-wrap gap-2">
          {m.slots.map((s) => {
            const isMine = s.userId === me;
            const isEmpty = !s.userId;

            return (
              <button
                key={s.pos}
                onClick={() => (isEmpty ? join(s.pos) : undefined)}
                disabled={!isEmpty || !!mySlot || busy}
                className={[
                  "rounded-full px-3 py-1 text-sm border",
                  isMine
                    ? "border-emerald-400 text-emerald-400"
                    : isEmpty
                    ? "border-white/20 text-white/90 hover:border-white/40"
                    : "border-white/10 text-white/40 cursor-not-allowed",
                ].join(" ")}
                title={
                  isMine ? "Senin pozisyonun"
                    : isEmpty ? "Boş — tıklayıp katıl"
                    : "Dolu"
                }
              >
                {s.pos}
              </button>
            );
          })}
        </div>
      </div>

      {/* (İsteğe bağlı) Maç sohbetini burada tutuyorsan, mevcut chat bileşenini buraya ekle */}
      {/* <MatchChat matchId={m.id} /> */}
    </div>
  );
}

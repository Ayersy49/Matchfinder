"use client";

import React, {
  useEffect,
  useRef,
  useState,
  use as usePromise, // Next 15 / React 19: params Promise -> React.use ile aç
} from "react";
import { useMe } from "@/lib/useMe";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/** response.json() güvenli parse (boş/gexersiz body'lerde patlamasın) */
async function safeJson<T>(res: Response): Promise<T | null> {
  const txt = await res.text();
  if (!txt) return null;
  try {
    return JSON.parse(txt) as T;
  } catch {
    return null;
  }
}

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

/* ---------------- Demo META (eksik alanlar için fallback) ---------------- */
const META: Record<
  string,
  {
    location: string;
    level: "Kolay" | "Orta" | "Zor";
    format: "5v5" | "7v7" | "8v8" | "11v11";
    price?: number;
  }
> = {
  "demo-1": { location: "Beşiktaş Halısaha", level: "Orta", format: "7v7", price: 150 },
  "demo-2": { location: "Kadıköy Çetin Emeç", level: "Kolay", format: "7v7", price: 120 },
  "demo-3": { location: "Mecidiyeköy Likör", level: "Zor", format: "8v8", price: 180 },
};

/* -------------------------------- Tipler --------------------------------- */
type Slot = { pos: string; userId?: string | null };

type Match = {
  id: string;
  title?: string | null;
  location?: string | null;
  level?: "Kolay" | "Orta" | "Zor" | string | null;
  format?: "5v5" | "7v7" | "8v8" | "11v11" | string | null;
  price?: number | null;
  time?: string | null; // ISO string olabilir
  slots?: Slot[];
  ownerId?: string | null;
};

const POSITIONS = ["GK", "LB", "CB", "RB", "LWB", "RWB", "DM", "CM", "AM", "LW", "RW", "ST"];

export default function MatchDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Next 15: params bir Promise
  const { id: matchId } = usePromise(params);

  const { me } = useMe();

  /* ----------------------------- Chat state'leri --------------------------- */
  const [msgs, setMsgs] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const boxRef = useRef<HTMLDivElement>(null);
  const sinceRef = useRef<string | null>(null);

  /* ----------------------------- Match state ------------------------------ */
  const [match, setMatch] = useState<Match | null>(null);
  const [mLoading, setMLoading] = useState(true);

  /* ----------------------- Match detayını çek ----------------------------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setMLoading(true);
        const r = await fetch(`${API_URL}/matches/${matchId}`, {
          headers: { Authorization: `Bearer ${getToken()}` },
          cache: "no-store",
        });
        if (!r.ok) throw new Error(await r.text());
        const data = await safeJson<Match>(r);
        if (alive) setMatch(data);
      } catch (e) {
        console.error("match fetch error", e);
      } finally {
        if (alive) setMLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [matchId]);

  /** Detayı tekrar çek (join/leave sonrası) */
  async function reloadMatch() {
    try {
      const r = await fetch(`${API_URL}/matches/${matchId}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
        cache: "no-store",
      });
      if (!r.ok) return;
      const data = await safeJson<Match>(r);
      setMatch(data);
    } catch {
      /* sessiz geç */
    }
  }

  /* ----------------------- Chat mesajlarını çek --------------------------- */
  async function pull(initial = false) {
    const qs = new URLSearchParams({ matchId });
    if (!initial && sinceRef.current) qs.set("after", sinceRef.current);

    const res = await fetch(`${API_URL}/messages?` + qs.toString(), {
      headers: { Authorization: `Bearer ${getToken()}` },
      cache: "no-store",
    });
    if (!res.ok) return;

    const data = await res.json();
    if (data.length) {
      sinceRef.current = data[data.length - 1].createdAt;

      // de-dupe + sıralama (createdAt, sonra id)
      setMsgs((prev) => {
        const map = new Map<string, any>();
        for (const m of prev) map.set(m.id, m);
        for (const m of data) map.set(m.id, m);
        return Array.from(map.values()).sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
            String(a.id).localeCompare(String(b.id)),
        );
      });

      // En alta kaydır
      setTimeout(() => boxRef.current?.scrollTo({ top: 1e9, behavior: "smooth" }), 0);
    }
  }

  async function send() {
    const t = text.trim();
    if (!t) return;
    setText("");
    await fetch(`${API_URL}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ matchId, text: t }),
    });
    pull(false);
  }

  useEffect(() => {
    let timer: any;
    (async () => {
      setLoading(true);
      sinceRef.current = null;
      setMsgs([]);
      await pull(true);
      setLoading(false);
      timer = setInterval(() => pull(false), 3000); // 3 sn polling
    })();
    return () => timer && clearInterval(timer);
  }, [matchId]);

  /* ----------------------- Pozisyon join/leave ---------------------------- */
  async function joinPos(pos: string) {
    await fetch(`${API_URL}/matches/join`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ matchId, pos }),
    });
    reloadMatch();
  }

  async function leavePos() {
    await fetch(`${API_URL}/matches/leave`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify({ matchId }),
    });
    reloadMatch();
  }

  /* -------------------- Görüntülenecek alanlar (fallback) ----------------- */
  const meta = META[matchId];
  const title = match?.title ?? "—";
  const location = match?.location ?? meta?.location ?? "—";
  const level = match?.level ?? meta?.level ?? "—";
  const format = match?.format ?? meta?.format ?? "—";
  const price =
    typeof match?.price === "number"
      ? `₺${match!.price}`
      : typeof meta?.price === "number"
      ? `₺${meta.price}`
      : "—";

  return (
    <div className="mx-auto max-w-3xl p-4">
      {/* Üst bilgi */}
      <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Maç Detayı</h2>
          <span className="text-xs text-neutral-400">ID: {matchId}</span>
        </div>

        {mLoading ? (
          <div className="mt-2 text-sm text-neutral-400">Maç bilgisi yükleniyor…</div>
        ) : (
          <div className="mt-2 grid gap-2 text-sm text-neutral-300 md:grid-cols-5">
            <div>
              <b>Başlık:</b> {title}
            </div>
            <div>
              <b>Konum:</b> {location}
            </div>
            <div>
              <b>Formasyon:</b> {format}
            </div>
            <div>
              <b>Seviye:</b> {level}
            </div>
            <div>
              <b>Fiyat:</b> {price}
            </div>
            {match?.time ? (
              <div className="md:col-span-5">
                <b>Saat:</b>{" "}
                {new Date(String(match.time)).toLocaleString([], {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Katılım (Pozisyon Seçimi) */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
        <div className="mb-2 text-sm font-medium">Pozisyonlar</div>

        {mLoading ? (
          <div className="text-neutral-400 text-sm">Yükleniyor…</div>
        ) : (
          <>
            {/* benim pozisyonum */}
            <div className="mb-3 text-xs text-neutral-400">
              Senin pozisyonun:{" "}
              <b>{match?.slots?.find((s) => s.userId === me?.id)?.pos ?? "—"}</b>
            </div>

            {/* butonlar */}
            <div className="flex flex-wrap gap-2">
              {POSITIONS.map((p) => {
                const taken = match?.slots?.some((s) => s.pos === p && s.userId) ?? false;
                const mine = match?.slots?.some((s) => s.pos === p && s.userId === me?.id) ?? false;
                return (
                  <button
                    key={p}
                    onClick={() => joinPos(p)}
                    disabled={taken && !mine}
                    className={`px-3 py-1 rounded-xl text-sm border border-white/10
                    ${mine ? "bg-emerald-600 text-neutral-950"
                           : taken ? "bg-neutral-700 text-neutral-300"
                                   : "bg-neutral-800 hover:bg-neutral-700"}`}
                    title={taken && !mine ? "Dolu" : mine ? "Sen" : "Katıl"}
                  >
                    {p}
                    {mine ? " • Sen" : taken ? " • Dolu" : ""}
                  </button>
                );
              })}
            </div>

            {/* Ayrıl */}
            <div className="mt-3">
              <button
                onClick={leavePos}
                className="px-3 py-1 rounded-xl text-sm bg-neutral-800 hover:bg-neutral-700 border border-white/10"
              >
                Pozisyondan Ayrıl
              </button>
            </div>
          </>
        )}
      </div>

      {/* Chat */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
        <div className="mb-2 text-sm font-medium">Maç Sohbeti</div>

        {/* Kaydırmalı kutu */}
        <div ref={boxRef} className="h-72 w-full overflow-y-auto rounded-xl bg-neutral-800 p-3">
          {loading && <div className="text-neutral-400">Yükleniyor…</div>}
          {!loading && msgs.length === 0 && (
            <div className="text-neutral-400">Henüz mesaj yok. İlk mesajı yaz!</div>
          )}

          {msgs.map((m) => {
            const mine = m.user?.id === me?.id;
            const k = `${m.id}-${new Date(m.createdAt).getTime()}`; // benzersiz key
            return (
              <div key={k} className={`mb-2 flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-xl px-3 py-2 text-sm ${
                    mine ? "bg-emerald-600 text-neutral-950" : "bg-neutral-700 text-neutral-100"
                  }`}
                >
                  {!mine && (
                    <div className="mb-0.5 text-[10px] opacity-70">
                      {m.user?.nickname ?? "Anon"}
                    </div>
                  )}
                  <div>{m.text}</div>
                  <div className="mt-1 text-[10px] opacity-60">
                    {new Date(m.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Giriş alanı */}
        <div className="mt-3 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Mesaj yaz…"
            className="flex-1 rounded-xl bg-neutral-800 px-3 py-2 text-sm outline-none"
          />
          <button
            onClick={send}
            className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-emerald-400"
          >
            Gönder
          </button>
        </div>
      </div>
    </div>
  );
}

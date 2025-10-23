"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMe } from "@/lib/useMe";
import { authHeader } from "@/lib/auth";


const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type Slot = {
  pos: string;
  userId?: string | null;
  placeholder?: 'ADMIN' | 'GUEST' | null;
  guestOfUserId?: string | null;
};

type MatchDetail = {
  id: string;
  slots?: Slot[];
  inviteOnly?: boolean | null;
};

type MatchLite = {
  id: string;
  title?: string | null;
  location?: string | null;
  level?: "Kolay" | "Orta" | "Zor" | string | null;
  format?: "5v5" | "7v7" | "8v8" | "11v11" | string | null;
  price?: number | null;
  time?: string | null; // ISO
  inviteOnly?: boolean | null;
};

const POSITIONS = ["GK","LB","CB","RB","LWB","RWB","DM","CM","AM","LW","RW","ST"] as const;

async function safeJson<T>(res: Response): Promise<T | null> {
  const txt = await res.text();
  if (!txt) return null;
  try { return JSON.parse(txt) as T; } catch { return null; }
}
function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}
function moneyTRY(v?: number | null) {
  if (v == null) return "";
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      maximumFractionDigits: 0,
    }).format(v);
  } catch { return `${v} ₺`; }
}

export default function MatchesPage() {
  const r = useRouter();
  const { me } = useMe();

  const [items, setItems] = React.useState<MatchLite[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [joiningId, setJoiningId] = React.useState<string | null>(null);

  // -- İstek yolla state'i --
  const [requestingId, setRequestingId] = React.useState<string | null>(null);
  const [requested, setRequested] = React.useState<Record<string, boolean>>({});

  async function requestAccess(matchId: string, message?: string) {
    const token = getToken();
    if (!token) { alert("Giriş gerekli."); r.push("/"); return; }
    try {
      setRequestingId(matchId);
      const res = await fetch(`${API_URL}/matches/${matchId}/request-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: message ?? "" }),
      });
      const j = await safeJson<any>(res);
      if (!res.ok || j?.ok === false) throw new Error(j?.message || `HTTP ${res.status}`);
      setRequested(prev => ({ ...prev, [matchId]: true }));
      alert("Erişim isteği gönderildi!");
    } catch (e: any) {
      alert(e?.message || "İstek gönderilemedi");
    } finally {
      setRequestingId(null);
    } 
  }
  // Filtreler
  const [level, setLevel] = React.useState<"" | "Kolay" | "Orta" | "Zor">("");
  const [format, setFormat] = React.useState<"" | "5v5" | "7v7" | "8v8" | "11v11">("");
  const [futureOnly, setFutureOnly] = React.useState(true);

  // Detay cache (eksik pozisyonlar ve "benim pozisyonum" için)
  const [details, setDetails] = React.useState<Record<string, MatchDetail>>({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/matches`, {
        cache: "no-store",
        headers: { ...authHeader() },
      });
      const json = await safeJson<MatchLite[]>(res);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const list = Array.isArray(json) ? json : [];
      setItems(list);
      // N+1 (MVP): her maç için detayları paralel çek
      const detEntries = await Promise.all(
        list.map(async (m) => {
          try {
            const r = await fetch(`${API_URL}/matches/${m.id}`, {
              cache: "no-store",
              headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {},
            });
            const d = await safeJson<MatchDetail>(r);
            return [m.id, d ?? { id: m.id, slots: [] }] as const;
          } catch {
            return [m.id, { id: m.id, slots: [] }] as const;
          }
        }),
      );
      setDetails(Object.fromEntries(detEntries));
    } catch (e: any) {
      setError(e?.message || "Yükleme hatası");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => { load(); }, []);

  // Sıralama + filtreleme
  const filtered = React.useMemo(() => {
    const now = Date.now();
    return [...items]
      .sort((a, b) => {
        const ta = a.time ? Date.parse(String(a.time)) : Number.POSITIVE_INFINITY;
        const tb = b.time ? Date.parse(String(b.time)) : Number.POSITIVE_INFINITY;
        return ta - tb;
      })
      .filter((m) => {
        if (futureOnly && m.time && Date.parse(String(m.time)) < now) return false;
        if (level && m.level !== level) return false;
        if (format && m.format !== format) return false;
        return true;
      });
  }, [items, level, format, futureOnly]);

  function myPosFor(id: string) {
    const d = details[id];
    const uid = me?.id;
    return d?.slots?.find((s) => s.userId === uid)?.pos ?? null;
  }

  function missingFor(id: string): string[] {
    const d = details[id];
    const slots = d?.slots ?? [];
    const defined = slots.length ? Array.from(new Set(slots.map((s) => s.pos))) : POSITIONS.slice();
    const missing: string[] = [];
    for (const p of defined) {
      const hasFree = slots.some((s) => s.pos === p && !s.userId && !s.placeholder);
      if (hasFree) missing.push(p as string);
    }
    return missing;
  }

  async function quickJoin(matchId: string) {
    const token =
      localStorage.getItem("token") ||
      localStorage.getItem("access_token") ||
      localStorage.getItem("jwt");

    if (!token) {
      alert("Oturum gerekli. Lütfen giriş yapın.");
      r.push("/landing");
      return;
    }

    // 1) Listedeki kayıttan inviteOnly kontrolü
    const m = items.find((x) => x.id === matchId);
    if (m?.inviteOnly) {
      alert("Bu maç kilitli. Admin onayı/davet gerekli.");
      return;
    }

    setJoiningId(matchId);

    try {
      // 2) Detay yoksa çek (inviteOnly fallback’i)
      let detail = details[matchId];
      if (!detail) {
        const dRes = await fetch(`${API_URL}/matches/${matchId}`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        });
        detail = (await safeJson<MatchDetail>(dRes)) ?? { id: matchId, slots: [] };
      }

      // Detaydan da kilit kontrolü (liste güncel olmayabilir)
      if (detail?.inviteOnly) {
        alert("Bu maç kilitli. Admin onayı/davet gerekli.");
        return;
      }

      // 3) Boş slotlar (placeholder’ları da dolu say!)
      const slots = detail.slots ?? [];
      const isFree = (s: any) => !s.userId && !s.placeholder;
      const missing = slots.filter(isFree).map((s) => s.pos?.toUpperCase());

      // 4) Sadece ilk 3 tercihten uygun olanı dene
      const myTop3: string[] = Array.isArray(me?.positions) ? (me!.positions as string[]) : [];
      const top3Upper = myTop3.map((p) => String(p).toUpperCase());
      const chosen = top3Upper.find((p) => missing.includes(p)) || null;

      // Tercihlerden hiçbiri boş değil → detaya yönlendir
      if (!chosen) {
        r.push(`/match/${matchId}`);
        return;
      }

      // 5) Katıl
      const jRes = await fetch(`${API_URL}/matches/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ matchId, pos: chosen }),
      });

      const data = await safeJson<any>(jRes);

      // Kilitli maç hata kodu
      if (jRes.status === 403) {
        alert("Bu maç kilitli. Davet gerekiyor.");
        r.push(`/landing`);
        return;
      }

      // Slot yarışı / dolu hali
      if (jRes.status === 409) {
        r.push(`/match/${matchId}`);
        return;
      }

      if (!jRes.ok || data?.ok === false) {
        throw new Error(data?.message || `HTTP ${jRes.status}`);
      }

      // Başarılı → detaya
      r.push(`/match/${matchId}`);
    } catch (e: any) {
      alert(e?.message || "Katılma sırasında hata.");
      r.push(`/match/${matchId}`);
    } finally {
      setJoiningId(null);
    }
  }

  async function quickLeave(matchId: string) {
    if (!getToken()) { r.push("/landing"); return; }
    setJoiningId(matchId);
    try {
      await fetch(`${API_URL}/matches/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ matchId }),
      });
      // sadece ilgili detayını yenile
      const rDet = await fetch(`${API_URL}/matches/${matchId}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const d = (await safeJson<MatchDetail>(rDet)) ?? { id: matchId, slots: [] };
      setDetails((prev) => ({ ...prev, [matchId]: d }));
    } catch { /* sessiz */ }
    finally { setJoiningId(null); }
  }

  return (
    <div className="mx-auto max-w-4xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Maçlar</h1>
        <div className="flex gap-2">
          <Link
            href="/matches/new"
            className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-emerald-500"
          >
            Maç Oluştur
          </Link>
          <button
            onClick={load}
            className="rounded-xl bg-neutral-800 px-3 py-2 text-sm hover:bg-neutral-700"
          >
            Yenile
          </button>
        </div>
      </div>

      {/* Filtre çubuğu */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-neutral-900/50 p-3">
        <label className="text-xs text-neutral-300">
          Seviye{" "}
          <select value={level} onChange={(e)=>setLevel(e.target.value as any)}
                  className="ml-1 rounded-md bg-neutral-800 px-2 py-1 text-xs outline-none">
            <option value="">Hepsi</option><option value="Kolay">Kolay</option>
            <option value="Orta">Orta</option><option value="Zor">Zor</option>
          </select>
        </label>
        <label className="text-xs text-neutral-300">
          Format{" "}
          <select value={format} onChange={(e)=>setFormat(e.target.value as any)}
                  className="ml-1 rounded-md bg-neutral-800 px-2 py-1 text-xs outline-none">
            <option value="">Hepsi</option>
            <option value="5v5">5v5</option><option value="7v7">7v7</option>
            <option value="8v8">8v8</option><option value="11v11">11v11</option>
          </select>
        </label>
        <label className="ml-2 inline-flex cursor-pointer items-center gap-2 text-xs text-neutral-300">
          <input type="checkbox" checked={futureOnly} onChange={(e)=>setFutureOnly(e.target.checked)} />
          Geçmişi Gizle
        </label>
        <div className="ml-auto flex items-center gap-2 text-xs">
          <button onClick={()=>{ setLevel(""); setFormat(""); setFutureOnly(true); }}
                  className="rounded-md bg-neutral-800 px-2 py-1 hover:bg-neutral-700">Temizle</button>
          <span className="text-neutral-400">{filtered.length} sonuç</span>
        </div>
      </div>

      {loading && <div className="rounded-xl border border-neutral-800 p-6 text-sm text-neutral-400">Yükleniyor…</div>}
      {error &&   <div className="rounded-xl border border-red-900 bg-red-950/30 p-4 text-sm text-red-300">{error}</div>}
      {!loading && !error && filtered.length === 0 &&
        <div className="rounded-xl border border-neutral-800 p-6 text-sm text-neutral-400">Filtrelere uyan maç bulunamadı.</div>
      }

      <div className="grid grid-cols-1 gap-4">
        {filtered.map((m) => {
          const myPos = myPosFor(m.id);
          const missing = missingFor(m.id);
          const showMissing = missing.slice(0, 4);
          const extra = Math.max(0, missing.length - showMissing.length);

          return (
            <div key={m.id} className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-lg font-medium flex items-center gap-2">
                    <span className="truncate">{m.title ?? "—"}</span>
                    {m.inviteOnly ? (
                      <span className="rounded bg-neutral-700 px-2 py-0.5 text-xs">Kilitli</span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-xs text-neutral-400">
                    {[m.location || "Konum yok", m.level || "Seviye yok", m.format || ""]
                      .filter(Boolean).join(" • ")}
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div className="font-semibold">{m.price != null ? moneyTRY(m.price) : ""}</div>
                  <div className="text-xs text-neutral-400">
                    {m.time ? new Date(String(m.time)).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : ""}
                  </div>
                </div>
              </div>

              {/* Eksik pozisyonlar + benim pozisyonum */}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {showMissing.map((p) => (
                  <span key={p} className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
                    {p}
                  </span>
                ))}
                {extra > 0 && (
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">+{extra}</span>
                )}
                <span className="ml-auto text-[11px] text-neutral-400">
                  {myPos ? <>Senin pozisyonun: <b>{myPos}</b></> : "Pozisyon seçilmemiş"}
                </span>
              </div>

              <div className="mt-3 flex gap-2">
                {m.inviteOnly && !myPos ? (
                  <>
                    <button
                      onClick={() => requestAccess(m.id)}
                      disabled={!!requested[m.id] || requestingId === m.id}
                      className="rounded-xl bg-neutral-800 px-3 py-1 text-sm hover:bg-neutral-700 disabled:opacity-60"
                      title="Maç kilitli, admin onayı gerekir"
                    >
                      {requested[m.id] ? "İstek gönderildi" : (requestingId === m.id ? "Gönderiliyor…" : "İstek yolla")}
                    </button>
                    <span className="rounded-xl bg-neutral-900/60 px-3 py-1 text-sm text-neutral-400 opacity-60">
                      Detay (Kilitli.)
                    </span>
                  </>
                ) : (
                  <>
                    {myPos ? (
                      <button
                        onClick={() => quickLeave(m.id)}
                        disabled={joiningId === m.id}
                        className="rounded-xl bg-neutral-800 px-3 py-1 text-sm hover:bg-neutral-700 disabled:opacity-60"
                      >
                        Ayrıl
                      </button>
                    ) : (
                      <button
                        onClick={() => quickJoin(m.id)}
                        disabled={joiningId === m.id}
                        className="rounded-xl bg-emerald-600 px-3 py-1 text-sm font-medium text-neutral-950 hover:bg-emerald-500 disabled:opacity-50"
                      >
                        {joiningId === m.id ? "Katılıyor…" : "Katıl"}
                      </button>
                    )}
                    <Link href={`/match/${m.id}`} className="rounded-xl bg-neutral-800 px-3 py-1 text-sm hover:bg-neutral-700">
                      Detay
                    </Link>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// app/matches/page.tsx
"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMe } from "@/lib/useMe";
import { authHeader } from "@/lib/auth";
import { getMyTeams } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type Slot = {
  pos: string;
  userId?: string | null;
  placeholder?: "ADMIN" | "GUEST" | null;
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
  format?: "5v5" | "6v6" | "7v7" | "8v8" | "9v9" | "10v10" | "11v11" | string | null;
  price?: number | null;
  time?: string | null; // ISO
  inviteOnly?: boolean | null;

  // ---- opsiyonel backend alanları (takım maçı highlight için) ----
  createdFrom?: string | null;     // 'TEAM_MATCH'
  highlightUntil?: string | null;  // ISO
  teamAId?: string | null;
  teamBId?: string | null;
  isTeamMatch?: boolean | null;    // bazı backendler bool dönebilir
};

const POSITIONS = [
  "GK",
  "LB",
  "CB",
  "RB",
  "LWB",
  "RWB",
  "DM",
  "CM",
  "AM",
  "LW",
  "RW",
  "ST",
] as const;

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "red" | "green" }) {
  const cls =
    tone === "red"
      ? "bg-red-600/20 text-red-300 ring-1 ring-red-500/40"
      : tone === "green"
      ? "bg-emerald-600/20 text-emerald-300 ring-1 ring-emerald-500/40"
      : "bg-white/10 text-neutral-200 ring-1 ring-white/15";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide ${cls}`}>
      {children}
    </span>
  );
}

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
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("jwt")
  );
}
function moneyTRY(v?: number | null) {
  if (v == null) return "";
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      maximumFractionDigits: 0,
    }).format(v);
  } catch {
    return `${v} ₺`;
  }
}

export default function MatchesPage() {
  const r = useRouter();
  const { me } = useMe();

  const [items, setItems] = React.useState<MatchLite[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [joiningId, setJoiningId] = React.useState<string | null>(null);

  // istek yolla
  const [requestingId, setRequestingId] = React.useState<string | null>(null);
  const [requested, setRequested] = React.useState<Record<string, boolean>>({});

  // benim takımlarım (takım maçı önceliği/rozeti için)
  const [myTeams, setMyTeams] = React.useState<any[]>([]);

  // filtreler
  const [level, setLevel] = React.useState<"" | "Kolay" | "Orta" | "Zor">("");
  const [format, setFormat] = React.useState<"" | "5v5" | "6v6" | "7v7" | "8v8" | "9v9" | "10v10" | "11v11">("");
  const [futureOnly, setFutureOnly] = React.useState(true);

  // Detay cache
  const [details, setDetails] = React.useState<Record<string, MatchDetail>>({});

  // ---------- helpers ----------
  const myTeamIds = React.useMemo(() => (myTeams || []).map((t: any) => t.id), [myTeams]);

  function isTeamMatch(m: MatchLite): boolean {
    return Boolean(m.isTeamMatch || m.createdFrom === "TEAM_MATCH" || ((m as any).teamAId && (m as any).teamBId));
  }
  function isMyTeamMatch(m: MatchLite): boolean {
    const a = (m as any).teamAId as string | undefined;
    const b = (m as any).teamBId as string | undefined;
    return !!(a && myTeamIds.includes(a)) || !!(b && myTeamIds.includes(b));
  }
  function isHighlightActive(m: MatchLite): boolean {
    if (!isTeamMatch(m)) return false;
    // highlightUntil gelecekteyse aktif kabul et
    if (m.highlightUntil) {
      const t = Date.parse(String(m.highlightUntil));
      if (Number.isFinite(t) && t > Date.now()) return true;
    }
    // highlightUntil yoksa: benim takımımsa yine vurgula
    if (isMyTeamMatch(m)) return true;
    return false;
  }

  function myPosFor(id: string) {
    const d = details[id];
    const uid = me?.id;
    return d?.slots?.find((s) => s.userId === uid)?.pos ?? null;
  }

  function missingFor(id: string): string[] {
    const d = details[id];
    const slots = d?.slots ?? [];
    const defined = slots.length ? Array.from(new Set(slots.map((s) => s.pos))) : (POSITIONS as any as string[]);
    const missing: string[] = [];
    for (const p of defined) {
      const hasFree = slots.some((s) => s.pos === p && !s.userId && !s.placeholder);
      if (hasFree) missing.push(p);
    }
    return missing;
  }

  // ---------- data load ----------
  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [resMatches, myTeamsApi] = await Promise.all([
        fetch(`${API_URL}/matches`, { cache: "no-store", headers: { ...authHeader() } }),
        getMyTeams().catch(() => []),
      ]);
      const json = await safeJson<MatchLite[]>(resMatches);
      if (!resMatches.ok) throw new Error(`HTTP ${resMatches.status}`);

      const list = Array.isArray(json) ? json : [];
      setItems(list);
      setMyTeams(Array.isArray(myTeamsApi) ? myTeamsApi : []);

      // N+1 (MVP): detayları çek
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
  React.useEffect(() => { void load(); }, []);

  // ---------- filtre + öncelik sıralaması ----------
  const filtered = React.useMemo(() => {
    const now = Date.now();
    const base = items.filter((m) => {
      if (futureOnly && m.time && Date.parse(String(m.time)) < now) return false;
      if (level && m.level !== level) return false;
      if (format && m.format !== format) return false;
      return true;
    });

    function score(m: MatchLite): number {
      const joined = !!myPosFor(m.id);
      let s = 0;
      if (isTeamMatch(m)) s += 100;          // takım maçı yüksek öncelik
      if (isMyTeamMatch(m)) s += 60;         // benim takımlarımın maçı
      if (joined) s += 35;                   // zaten katıldığım
      // zamanı yaklaşan biraz daha öne
      const t = m.time ? Date.parse(String(m.time)) : Number.POSITIVE_INFINITY;
      if (Number.isFinite(t)) {
        const hours = Math.max(0, (t - Date.now()) / (1000 * 60 * 60));
        s += Math.max(0, 24 - Math.min(24, hours)); // 24 saat içindekilere küçük bonus
      }
      return s;
    }

    return [...base].sort((a, b) => {
      const sb = score(b) - score(a);
      if (sb !== 0) return sb;
      const ta = a.time ? Date.parse(String(a.time)) : Number.POSITIVE_INFINITY;
      const tb = b.time ? Date.parse(String(b.time)) : Number.POSITIVE_INFINITY;
      return ta - tb;
    });
  }, [items, level, format, futureOnly, myTeams, details]);

  // ---------- istek yolla ----------
  async function requestAccess(matchId: string, message?: string) {
    const token = getToken();
    if (!token) {
      alert("Giriş gerekli.");
      r.push("/landing");
      return;
    }
    try {
      setRequestingId(matchId);
      const res = await fetch(`${API_URL}/matches/${matchId}/request-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: message ?? "" }),
      });
      const j = await safeJson<any>(res);
      if (!res.ok || j?.ok === false) throw new Error(j?.message || `HTTP ${res.status}`);
      setRequested((prev) => ({ ...prev, [matchId]: true }));
      alert("Erişim isteği gönderildi!");
    } catch (e: any) {
      alert(e?.message || "İstek gönderilemedi");
    } finally {
      setRequestingId(null);
    }
  }

  // ---------- join/leave ----------
  async function quickJoin(matchId: string) {
    const token = getToken();
    if (!token) {
      alert("Oturum gerekli. Lütfen giriş yapın.");
      r.push("/landing");
      return;
    }

    // listedeki kayıttan inviteOnly kontrolü
    const m = items.find((x) => x.id === matchId);
    if (m?.inviteOnly) {
      alert("Bu maç kilitli. Admin onayı/davet gerekli.");
      return;
    }

    setJoiningId(matchId);

    try {
      // detay yoksa çek
      let detail = details[matchId];
      if (!detail) {
        const dRes = await fetch(`${API_URL}/matches/${matchId}`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        });
        detail = (await safeJson<MatchDetail>(dRes)) ?? { id: matchId, slots: [] };
      }

      if (detail?.inviteOnly) {
        alert("Bu maç kilitli. Admin onayı/davet gerekli.");
        return;
      }

      // boş slotlardan ilk uygun tercihi dene
      const slots = detail.slots ?? [];
      const isFree = (s: any) => !s.userId && !s.placeholder;
      const missing = slots.filter(isFree).map((s) => s.pos?.toUpperCase());

      const myTop3: string[] = Array.isArray(me?.positions) ? (me!.positions as any) : [];
      const top3Upper = myTop3.map((p) => String(p).toUpperCase());
      const chosen = top3Upper.find((p) => missing.includes(p)) || null;

      if (!chosen) {
        r.push(`/match/${matchId}`);
        return;
      }

      const jRes = await fetch(`${API_URL}/matches/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ matchId, pos: chosen }),
      });
      const data = await safeJson<any>(jRes);

      if (jRes.status === 403) {
        alert("Bu maç kilitli. Davet gerekiyor.");
        r.push(`/landing`);
        return;
      }
      if (jRes.status === 409) {
        r.push(`/match/${matchId}`);
        return;
      }
      if (!jRes.ok || data?.ok === false) {
        throw new Error(data?.message || `HTTP ${jRes.status}`);
      }
      r.push(`/match/${matchId}`);
    } catch (e: any) {
      alert(e?.message || "Katılma sırasında hata.");
      r.push(`/match/${matchId}`);
    } finally {
      setJoiningId(null);
    }
  }

  async function quickLeave(matchId: string) {
    if (!getToken()) {
      r.push("/landing");
      return;
    }
    setJoiningId(matchId);
    try {
      await fetch(`${API_URL}/matches/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ matchId }),
      });
      // detayını yenile
      const rDet = await fetch(`${API_URL}/matches/${matchId}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const d = (await safeJson<MatchDetail>(rDet)) ?? { id: matchId, slots: [] };
      setDetails((prev) => ({ ...prev, [matchId]: d }));
    } catch {
      /* sessiz */
    } finally {
      setJoiningId(null);
    }
  }

  // ---------- paylaş ----------
  async function shareMatch(m: MatchLite) {
    const url = typeof window !== "undefined" ? `${window.location.origin}/match/${m.id}` : "";
    const payload = { title: m.title || "Maç", text: m.location || "", url };
    try {
      if (navigator.share) {
        await navigator.share(payload);
      } else {
        await navigator.clipboard.writeText(url);
        alert("Maç bağlantısı kopyalandı.");
      }
    } catch {
      /* yok say */
    }
  }

  // ---------- UI ----------
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
          <select
            value={level}
            onChange={(e) => setLevel(e.target.value as any)}
            className="ml-1 rounded-md bg-neutral-800 px-2 py-1 text-xs outline-none"
          >
            <option value="">Hepsi</option>
            <option value="Kolay">Kolay</option>
            <option value="Orta">Orta</option>
            <option value="Zor">Zor</option>
          </select>
        </label>
        <label className="text-xs text-neutral-300">
          Format{" "}
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value as any)}
            className="ml-1 rounded-md bg-neutral-800 px-2 py-1 text-xs outline-none"
          >
            <option value="">Hepsi</option>
            <option value="5v5">5v5</option>
            <option value="6v6">6v6</option>
            <option value="7v7">7v7</option>
            <option value="8v8">8v8</option>
            <option value="9v9">9v9</option>
            <option value="10v10">10v10</option>
            <option value="11v11">11v11</option>
          </select>
        </label>
        <label className="ml-2 inline-flex cursor-pointer items-center gap-2 text-xs text-neutral-300">
          <input type="checkbox" checked={futureOnly} onChange={(e) => setFutureOnly(e.target.checked)} />
          Geçmişi Gizle
        </label>
        <div className="ml-auto flex items-center gap-2 text-xs">
          <button
            onClick={() => {
              setLevel("");
              setFormat("");
              setFutureOnly(true);
            }}
            className="rounded-md bg-neutral-800 px-2 py-1 hover:bg-neutral-700"
          >
            Temizle
          </button>
          <span className="text-neutral-400">{filtered.length} sonuç</span>
        </div>
      </div>

      {loading && (
        <div className="rounded-xl border border-neutral-800 p-6 text-sm text-neutral-400">Yükleniyor…</div>
      )}
      {error && (
        <div className="rounded-xl border border-red-900 bg-red-950/30 p-4 text-sm text-red-300">{error}</div>
      )}
      {!loading && !error && filtered.length === 0 && (
        <div className="rounded-xl border border-neutral-800 p-6 text-sm text-neutral-400">
          Filtrelere uyan maç bulunamadı.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {filtered.map((m) => {
          const myPos = myPosFor(m.id);
          const missing = missingFor(m.id);
          const showMissing = missing.slice(0, 4);
          const extra = Math.max(0, missing.length - showMissing.length);

          const teamMatch = isTeamMatch(m);
          const mine = isMyTeamMatch(m);
          const highlight = isHighlightActive(m);

          const cardBase =
            "relative rounded-2xl border bg-neutral-900/40 p-4 transition-shadow";
          const cardStyle = highlight
            ? "border-red-500/50 shadow-[0_0_0_2px_rgba(239,68,68,.35),0_0_28px_rgba(239,68,68,.35)]"
            : "border-neutral-800";
          const pingDot = highlight ? (
            <>
              <span className="absolute -top-2 -right-2 h-3 w-3 rounded-full bg-red-500/80 animate-ping" />
              <span className="absolute -top-2 -right-2 h-3 w-3 rounded-full bg-red-400" />
            </>
          ) : null;

          return (
            <div key={m.id} className={`${cardBase} ${cardStyle}`}>
              {pingDot}

              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-lg font-medium flex flex-wrap items-center gap-2">
                    <span className="truncate">{m.title ?? "—"}</span>
                    {teamMatch && <Badge tone="red">Takım Maçı</Badge>}
                    {mine && <Badge tone="green">Senin takımın</Badge>}
                    {m.inviteOnly ? <Badge>Kilitli</Badge> : null}
                  </div>
                  <div className="mt-1 text-xs text-neutral-400">
                    {[m.location || "Konum yok", m.level || "Seviye yok", m.format || ""]
                      .filter(Boolean)
                      .join(" • ")}
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div className="font-semibold">{m.price != null ? moneyTRY(m.price) : ""}</div>
                  <div className="text-xs text-neutral-400">
                    {m.time
                      ? new Date(String(m.time)).toLocaleString([], {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : ""}
                  </div>
                </div>
              </div>

              {/* Eksik pozisyonlar + benim pozisyonum */}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {showMissing.map((p) => (
                  <span
                    key={p}
                    className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300"
                  >
                    {p}
                  </span>
                ))}
                {extra > 0 && (
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
                    +{extra}
                  </span>
                )}
                <span className="ml-auto text-[11px] text-neutral-400">
                  {myPos ? (
                    <>
                      Senin pozisyonun: <b>{myPos}</b>
                    </>
                  ) : (
                    "Pozisyon seçilmemiş"
                  )}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {/* Takım maçıysa özel kısayollar */}
                {teamMatch && (
                  <>
                    <button
                      onClick={() => void shareMatch(m)}
                      className="rounded-xl bg-red-600/20 px-3 py-1 text-xs text-red-300 ring-1 ring-red-500/40 hover:bg-red-600/25"
                      title="Bağlantıyı paylaş / kopyala"
                    >
                      Maçı dağıt
                    </button>
                    <Link
                      href={`/match/${m.id}#chat`}
                      className="rounded-xl bg-neutral-800 px-3 py-1 text-xs hover:bg-neutral-700"
                    >
                      Ortak sohbet
                    </Link>
                  </>
                )}

                {/* Standart aksiyonlar */}
                {m.inviteOnly && !myPos ? (
                  <>
                    <button
                      onClick={() => requestAccess(m.id)}
                      disabled={!!requested[m.id] || requestingId === m.id}
                      className="rounded-xl bg-neutral-800 px-3 py-1 text-sm hover:bg-neutral-700 disabled:opacity-60"
                      title="Maç kilitli, admin onayı gerekir"
                    >
                      {requested[m.id]
                        ? "İstek gönderildi"
                        : requestingId === m.id
                        ? "Gönderiliyor…"
                        : "İstek yolla"}
                    </button>
                    <span className="rounded-xl bg-neutral-900/60 px-3 py-1 text-sm text-neutral-400 opacity-60">
                      Detay (Kilitli.)
                    </span>
                  </>
                ) : (
                  <>
                    {myPos ? (
                      <button
                        onClick={() => void quickLeave(m.id)}
                        disabled={joiningId === m.id}
                        className="rounded-xl bg-neutral-800 px-3 py-1 text-sm hover:bg-neutral-700 disabled:opacity-60"
                      >
                        Ayrıl
                      </button>
                    ) : (
                      <button
                        onClick={() => void quickJoin(m.id)}
                        disabled={joiningId === m.id}
                        className="rounded-xl bg-emerald-600 px-3 py-1 text-sm font-medium text-neutral-950 hover:bg-emerald-500 disabled:opacity-50"
                      >
                        {joiningId === m.id ? "Katılıyor…" : "Katıl"}
                      </button>
                    )}
                    <Link
                      href={`/match/${m.id}`}
                      className="rounded-xl bg-neutral-800 px-3 py-1 text-sm hover:bg-neutral-700"
                    >
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

"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, Repeat, ListCheck, Layers, Trophy, UserRound, Shield, LogIn, Footprints, Star as IconStar } from "lucide-react";
import { useMe } from "@/lib/useMe";
import Link from "next/link";
import { authHeader, clearToken, getToken, setToken } from "@/lib/auth";
import AvailabilityEditor from "../profil/AvailabilityEditor";
import { useRouter, useSearchParams } from "next/navigation";
import SeriesTab from "@/components/tabs/SeriesTab";
import FooterTabs from "@/components/FooterTabs";
import TeamsTab from "@/components/tabs/TeamsTab";





type AccessInfo = {
  owner: boolean;
  joined: boolean;
  canView: boolean;
  requestPending: boolean;
};

// MatchLite'a dokunmadan yerelde genişletiyoruz
type MatchLiteWithAccess = MatchLite & { access?: AccessInfo };


// API kökü + header helper
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const H = (): HeadersInit => (authHeader() as unknown as HeadersInit);

/* =================== Rating Pending Bell + Modal =================== */

/* =================== Renkli yıldızlar =================== */
function colorToneFromValue(value: number) {
  // 5 → mavi, 4–3 → yeşil, 2 → sarı, 1 → kırmızı
  if (value >= 5) return "text-sky-400";
  if (value >= 3) return "text-emerald-400";
  if (value === 2) return "text-amber-400";
  return "text-rose-500";
}

function RateStar({
  filled = false,
  tone,
  onClick,
  disabled = false,
}: {
  filled?: boolean;
  tone: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <span
      role="button"
      aria-hidden="true"
      onClick={disabled ? undefined : onClick}
      className={[
        "select-none text-lg",
        disabled ? "cursor-default opacity-40" : "cursor-pointer hover:scale-110 transition-transform",
        filled ? tone : "text-neutral-500/40",
      ].join(" ")}
    >
      ★
    </span>
  );
}

function TraitStars({
  value,
  set,
  disabled = false,
}: {
  value: number;
  set: (n: number) => void;
  disabled?: boolean;
}) {
  const tone = colorToneFromValue(value);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <RateStar
          key={n}
          filled={value >= n}
          tone={tone}
          onClick={() => set(n)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}


function ScorePills({
  value,
  set,
}: {
  value: number;
  set: (n: number) => void;
}) {
  const opts = Array.from({ length: 10 }, (_, i) => i + 1);
  return (
    <div
      role="radiogroup"
      aria-label="Oyun (1–10)"
      className="flex flex-wrap gap-1"
    >
      {opts.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          onClick={() => set(n)}
          className={
            "h-7 w-7 rounded-md text-xs ring-1 ring-white/10 " +
            (value === n
              ? "bg-emerald-600 text-neutral-950"
              : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700")
          }
        >
          {n}
        </button>
      ))}
    </div>
  );
}


/* ---------- yardımcı: trait label'ları ---------- */
function labelFor(
  k: "punctuality" | "respect" | "sportsmanship" | "swearing" | "aggression"
) {
  return (
    {
      punctuality: "Dakiklik",
      respect: "Saygı",
      sportsmanship: "Sportmenlik",
      swearing: "Küfür",
      aggression: "Agresiflik",
    } as const
  )[k];
}

/* =========================================================
   Maç Değerlendirme Modalı (davranış 1–5, mevki skoru 1–10)
   Beklenen BE endpoint: POST /ratings/:matchId/submit-bulk
   Payload:
   {
     ratings:    [{ rateeId, traits:{punctuality..} }],
     posRatings: [{ rateeId, pos, score }]   // score: 1..10
   }
   match.players -> [{ id, phone, pos? }]
   ========================================================= */
function RateMatchModal({
  open,
  onClose,
  match,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  match: any;            // { matchId, title, players: [{id,phone,pos?}] }
  onSaved?: () => void;
}) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  // kalan haklar (rateeId -> 0..3). Kayıt yoksa FE 3 varsayar.
  const [remaining, setRemaining] = React.useState<Record<string, number>>({});

  React.useEffect(() => {
    if (!open || !match?.matchId) return;
    const hdr = authHeader();
    fetch(`${API_URL}/ratings/${match.matchId}/remaining`, {
      headers: { ...(hdr as any) },
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((j) => setRemaining(j?.remaining ?? {}))
      .catch(() => setRemaining({}));
  }, [open, match?.matchId, API_URL]);

  const [rows, setRows] = React.useState<
    Array<{
      userId: string;
      phone?: string | null;
      pos?: string | null;
      include: boolean;
      traits: {
        punctuality: number;
        respect: number;
        sportsmanship: number;
        swearing: number;
        aggression: number;
      };
      posScore: number; // 1..10
    }>
  >([]);
  const [saving, setSaving] = React.useState(false);

  // Modal açıldığında satırları hazırla
  React.useEffect(() => {
    if (!open || !match) return;
    const list = Array.isArray(match?.players) ? match.players : [];
    setRows(
      list.map((p: any) => ({
        userId: String(p.id),
        phone: p.phone ?? null,
        pos: p.pos ?? null,
        include: true,
        traits: {
          punctuality: 3,
          respect: 3,
          sportsmanship: 3,
          swearing: 3,
          aggression: 3,
        },
        posScore: 7,
      }))
    );
  }, [open, match]);

  // Kaydet: kilitli oyuncuları gönderme + kalan hakları güncelle
  async function save() {
    try {
      setSaving(true);

      const selectable = rows.filter(
        (r) => r.include && (remaining[r.userId] ?? 3) > 0
      );
      if (selectable.length === 0) {
        alert("Kilitli/çıkarılmış oyuncular nedeniyle gönderilecek kayıt yok.");
        setSaving(false);
        return;
      }

      const items = selectable.map((r) => ({
        rateeId: r.userId,
        pos: r.pos ?? undefined,
        posScore: r.pos
          ? Math.max(1, Math.min(10, Math.round(Number(r.posScore))))
          : undefined,
        traits: {
          punctuality: r.traits.punctuality,
          respect: r.traits.respect,
          sports: r.traits.sportsmanship, // FE -> BE alias
          swearing: r.traits.swearing,
          aggression: r.traits.aggression,
        },
      }));

      const endpoint = `${API_URL}/ratings/${match.matchId}/submit`;
      const r = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(H() as any), // dosyada zaten const H = () => authHeader()
        },
        body: JSON.stringify({ items }),
      });

      const j = await r.json().catch(() => ({}));

      // BE'den gelen kalan hakları merge et
      if (j?.remaining && typeof j.remaining === "object") {
        setRemaining((prev) => ({ ...prev, ...j.remaining }));
      }

      if (!r.ok || j?.ok !== true) {
        if (r.status === 403 && (j?.message === "window_closed" || j?.error === "ForbiddenException")) {
          alert("Süre doldu. Değerlendirme penceresi maçtan sonra 24 saat.");
        } else if (r.status === 409 && j?.message === "rate_limit") {
          alert("Aynı oyuncu için en fazla 3 kez düzenleyebilirsin.");
        } else {
          alert(j?.message || `Kaydedilemedi (HTTP ${r.status})`);
        }
        setSaving(false);
        return;
      }

      onSaved?.();
      onClose();
      alert("Teşekkürler! Değerlendirmen kaydedildi.");
    } catch (e: any) {
      alert(e?.message || "Hata");
    } finally {
      setSaving(false);
    }
  }

  if (!open || !match) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-4xl rounded-2xl bg-neutral-900 p-4 ring-1 ring-white/10 rate-modal">
        <div className="mb-2 text-base font-semibold">
          Oyuncuları değerlendir — {match.title ?? "Maç"}
        </div>

        {/* toplu seçim */}
        <div className="mb-2 flex items-center justify-end gap-2">
          <button
            onClick={() =>
              setRows((rs) =>
                rs.map((r) => ({
                  ...r,
                  include: (remaining[r.userId] ?? 3) > 0, // kilitli olanlar seçilmesin
                }))
              )
            }
            className="rounded-md bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700"
          >
            Tümünü seç
          </button>
          <button
            onClick={() => setRows((rs) => rs.map((r) => ({ ...r, include: false })))}
            className="rounded-md bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700"
          >
            Hepsini kaldır
          </button>
        </div>

        <div className="max-h-[60vh] overflow-auto">
          {rows.map((row, idx) => {
            const rLeft = remaining[row.userId] ?? 3;
            const disabled = !row.include || rLeft <= 0;
            return (
              <div key={row.userId} className="rate-grid border-b border-white/5 py-3">
                {/* Sol üst: kimlik */}
                <div className="id flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={row.include}
                    onChange={(e) =>
                      setRows((rs) => {
                        const cp = [...rs];
                        cp[idx] = { ...cp[idx], include: e.target.checked };
                        return cp;
                      })
                    }
                    className="h-4 w-4 accent-emerald-500"
                  />
                  <span className={`truncate ${row.include ? "" : "opacity-40 line-through"}`}>
                    {row.phone ?? row.userId.slice(0, 6)}
                  </span>
                  {row.pos && (
                    <span className="rounded-md bg-neutral-800 px-2 py-0.5 text-xs">
                      {row.pos}
                    </span>
                  )}
                </div>

                {/* Kalan hak notu */}
                <div className="mt-1 text-xs text-neutral-400">
                  Bu oyuncu için değerlendirmeni <b>{rLeft}</b> düzenleme hakkın kaldı.
                  {rLeft <= 0 && <span className="text-red-400"> • Kilitli</span>}
                </div>

                {/* Traitler */}
                <div
                  className={`traits mt-2 flex flex-wrap items-center gap-x-8 gap-y-2 text-xs ${
                    disabled ? "pointer-events-none opacity-50" : ""
                  }`}
                >
                  {(
                    ["punctuality", "respect", "sportsmanship", "swearing", "aggression"] as const
                  ).map((k) => (
                    <div
                      key={k}
                      className="inline-flex items-center whitespace-nowrap basis-1/2 sm:basis-1/3 md:basis-1/5"
                    >
                      <span className="mr-3">{labelFor(k)}</span>
                      <div className="shrink-0">
                        <TraitStars
                          value={row.traits[k]}
                          set={(n: number) =>
                            setRows((rs) => {
                              const cp = [...rs];
                              cp[idx] = { ...cp[idx], traits: { ...cp[idx].traits, [k]: n } };
                              return cp;
                            })
                            
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Oyun (1–10) */}
                <div className={`pos mt-4 flex w-full flex-col items-center gap-1 ${disabled ? "pointer-events-none opacity-50" : ""}`}>
                  {row.pos ? (
                    <>
                      <span className="text-xs">Oyun (1–10)</span>
                      <ScorePills
                        value={row.posScore}
                        set={(n) =>
                          setRows((rs) => {
                            const cp = [...rs];
                            cp[idx] = { ...cp[idx], posScore: n };
                            return cp;
                          })
                        }
                      />
                      <span className="text-xs">{row.posScore}</span>
                    </>
                  ) : (
                    <span className="text-[11px] text-neutral-500">Pozisyon bilgisi yok</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Not + Butonlar */}
        <div className="modal-footer mt-3 flex items-center justify-between gap-3">
          <div className="text-[11px] text-neutral-400">
            Not: Değerlendirmeler anonimdir. 24 saat içinde en fazla 3 kez güncelleyebilirsin.
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
            >
              Vazgeç
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-neutral-950 disabled:opacity-50 hover:bg-emerald-500"
            >
              {saving ? "Kaydediliyor…" : "Kaydet"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   Üst bar’daki “Değerlendir (N)” zili
   Beklenen BE endpoint:
   GET /ratings/pending  -> { items:[{ matchId, title, players:[{id,phone,pos?}], ...}] }
   ========================================================= */
function PendingRatingsBell() {
  const [items, setItems] = React.useState<any[]>([]);
  const [open, setOpen] = React.useState(false);
  const [payload, setPayload] = React.useState<any | null>(null);
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

  const load = React.useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/ratings/pending`, {
        headers: { ...authHeader() },
        cache: "no-store",
      });
      const j = await r.json().catch(() => ({}));
      setItems(Array.isArray(j?.items) ? j.items : []);
    } catch {}
  }, [API_URL]);

  React.useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <>
      <button
        onClick={() => {
          if (items[0]) {
            setPayload(items[0]);
            setOpen(true);
          }
        }}
        className={`rounded-lg px-3 py-1.5 text-sm ${
          items.length
            ? "bg-amber-600/90 hover:bg-amber-600"
            : "bg-neutral-800 text-neutral-300"
        }`}
        title="Değerlendirme bekliyor"
      >
        Değerlendir ({items.length})
      </button>

      <RateMatchModal
        open={open}
        onClose={() => setOpen(false)}
        match={payload}
        onSaved={load}
      />
    </>
  );
}


/* ------------------ Üst Bar: Davetler (badge) ------------------ */
function NotificationsBell() {
  const [count, setCount] = React.useState(0);

  const load = React.useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/notifications?unread=1`, {
        headers: H(),
        cache: 'no-store',
      });
      const j = await r.json().catch(() => ({}));
      // { items:[...] } ya da { count: n } destekler
      const c = Array.isArray(j?.items) ? j.items.length : (Number(j?.count) || 0);
      setCount(c);
    } catch {}
  }, []);

  React.useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  return (
    <Link
      href="/notifications"
      className="relative rounded-lg bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
      title="Bildirimler"
    >
      Bildirimler
      {count > 0 && (
        <span className="absolute -right-2 -top-2 rounded-full bg-emerald-600 px-1.5 text-[10px] text-white">
          {count}
        </span>
      )}
    </Link>
  );
}

function InvitesBell() {
  const [count, setCount] = React.useState(0);

  const load = React.useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/matches/invites/inbox?status=PENDING`, {
        headers: H(),
        cache: "no-store",
      });
      if (!r.ok) return;
      const data = await r.json().catch(() => ({}));
      const n = Array.isArray(data?.items) ? data.items.length : 0;
      setCount(n);
    } catch {}
  }, []);

  React.useEffect(() => {
    load();
    const t = setInterval(load, 5000); // 5 sn’de bir tazele
    return () => clearInterval(t);
  }, [load]);

  return (
    <Link
      href="/invites"
      className="relative rounded-lg bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
      title="Davetler"
    >
      Davetler
      {count > 0 && (
        <span className="absolute -right-2 -top-2 rounded-full bg-emerald-600 px-1.5 text-[10px] text-white">
          {count}
        </span>
      )}
    </Link>
  );
}

/* ------------------ Üst Bar: Arkadaşlar (badge) ------------------ */
function FriendsBell() {
  const [count, setCount] = React.useState(0);

  const load = React.useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/friends/requests/incoming?status=PENDING`, {
        headers: H(),
        cache: "no-store",
      });
      if (!r.ok) return;
      const data = await r.json().catch(() => ({}));
      const n = Array.isArray(data?.items) ? data.items.length : 0;
      setCount(n);
    } catch {}
  }, []);

  React.useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <Link
      href="/friends"
      className="relative rounded-lg bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
      title="Arkadaşlar"
    >
      Arkadaşlar
      {count > 0 && (
        <span className="absolute -right-2 -top-2 rounded-full bg-emerald-600 px-1.5 text-[10px] text-white">
          {count}
        </span>
      )}
    </Link>
  );
}

/* ---------------------- Tipler ---------------------- */
type MatchLite = {
  id: string;
  title?: string | null;
  location?: string | null;
  level?: string | null;
  format?: string | null;
  price?: number | null;
  time?: string | null;
  createdAt?: string | null;

  // slotlar FE'de doluluk göstergesi için
  slots?: SlotLite[] | null;

  // erişim ve durum
  inviteOnly?: boolean | null;
  ownerId?: string | null;
  status?: 'DRAFT' | 'OPEN' | 'CLOSED' | null;
  closedAt?: string | null;

  // —— TAKIM MAÇI highlight için ek alanlar ——
  createdFrom?: string | null;     // 'TEAM_MATCH' gelirse takım maçı
  highlightUntil?: string | null;  // ISO string; future ise vurgu açık
  teamAId?: string | null;
  teamBId?: string | null;
};


type SlotLite = {
  pos: string;
  userId?: string | null;
  placeholder?: 'ADMIN' | 'GUEST' | null; // ← EKLENDİ
};


const LEVELS = ["Kolay", "Orta", "Zor"] as const;
const FORMATS = ["5v5", "6v6", "7v7", "8v8", "9v9", "10v10", "11v11"] as const;

/* ---------------------- Dizilişler ---------------------- */
type PositionKey =
  | "GK"
  | "LB"
  | "CB"
  | "RB"
  | "LWB"
  | "RWB"
  | "DM"
  | "CM"
  | "AM"
  | "LW"
  | "RW"
  | "ST"
  | "SB"
  | "STP";

type PitchSlot = { key: PositionKey; label: string; x: number; y: number };

const FORMATIONS: Record<string, PitchSlot[]> = {
  "4-2-3-1": [
    { key: "GK", label: "Kaleci", x: 6, y: 50 },
    { key: "LB", label: "Sol Bek", x: 20, y: 20 },
    { key: "CB", label: "Stoper", x: 20, y: 42 },
    { key: "STP", label: "Stoper", x: 20, y: 58 },
    { key: "RB", label: "Sağ Bek", x: 20, y: 80 },
    { key: "DM", label: "Ön Libero", x: 40, y: 38 },
    { key: "CM", label: "Merkez", x: 40, y: 62 },
    { key: "LW", label: "Sol Kanat", x: 60, y: 20 },
    { key: "AM", label: "10 Numara", x: 60, y: 50 },
    { key: "RW", label: "Sağ Kanat", x: 60, y: 80 },
    { key: "ST", label: "Santrafor", x: 84, y: 50 },
  ],
  "4-3-3": [
    { key: "GK", label: "Kaleci", x: 6, y: 50 },
    { key: "LB", label: "Sol Bek", x: 20, y: 20 },
    { key: "CB", label: "Stoper", x: 20, y: 42 },
    { key: "STP", label: "Stoper", x: 20, y: 58 },
    { key: "RB", label: "Sağ Bek", x: 20, y: 80 },
    { key: "DM", label: "Ön Libero", x: 40, y: 50 },
    { key: "CM", label: "Merkez", x: 52, y: 35 },
    { key: "AM", label: "İleri Orta", x: 52, y: 65 },
    { key: "LW", label: "Sol Kanat", x: 70, y: 20 },
    { key: "ST", label: "Santrafor", x: 84, y: 50 },
    { key: "RW", label: "Sağ Kanat", x: 70, y: 80 },
  ],
  "3-5-2": [
    { key: "GK", label: "Kaleci", x: 8, y: 50 },
    { key: "CB", label: "Stoper", x: 22, y: 32 },
    { key: "CB", label: "Stoper", x: 22, y: 50 },
    { key: "CB", label: "Stoper", x: 22, y: 68 },
    { key: "DM", label: "Ön Libero", x: 40, y: 42 },
    { key: "DM", label: "Ön Libero", x: 40, y: 58 },
    { key: "AM", label: "10 Numara", x: 58, y: 50 },
    { key: "LWB", label: "LMB", x: 50, y: 20 },
    { key: "RWB", label: "RMB", x: 50, y: 80 },
    { key: "ST", label: "Santrafor", x: 86, y: 40 },
    { key: "ST", label: "Santrafor", x: 86, y: 60 },
  ],
};

/* ====================== Sayfa ====================== */
export default function Page() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("token")) {
      setAuthed(true);
    }
  }, []);

  const [activeTab, setActiveTab] = useState<"matches" | "series" | "teams" | "profile" | "player">("matches");


  // URL'den ?tab=... oku ve state'i senkronla (matches|profile|player)
  const sp = useSearchParams();
  useEffect(() => {
    const t = sp.get("tab");
    if (t === "matches" || t === "series" || t === "teams" || t === "profile" || t === "player") {
      setActiveTab(t as any);
    } else {
      setActiveTab("matches");
    }
  }, [sp]);


  return (
    <div className="min-h-dvh bg-neutral-950 text-white">
      {!authed ? (
        <LoginScreen onSuccess={() => setAuthed(true)} />
      ) : (
        <MainShell activeTab={activeTab} onTab={setActiveTab} />
      )}
    </div>
  );
}

/* ---------------------- Login ---------------------- */

function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const STADIUMS = [
    "https://images.unsplash.com/photo-1530541930197-ff16ac917b0e?q=80&w=1600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1486286701208-1d58e9338013?q=80&w=1600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1522770179533-24471fcdba45?q=80&w=1600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1522771930-78848d9293e8?q=80&w=1600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?q=80&w=1600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1471295253337-3ceaaedca402?q=80&w=1600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1547347298-4074fc3086f0?q=80&w=1600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1486286701208-1d58e9338013?q=80&w=1600&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=1600&auto=format&fit=crop",
  ];

  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % STADIUMS.length), 4500);
    return () => clearInterval(id);
  }, []);

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");

  const normalizePhone = (s: string) => s.replace(/\D/g, "");
  const normalizeCode = (s: string) => s.replace(/\D/g, "").slice(0, 6);

  async function requestOtp() {
    try {
      const r = await fetch(`${API_URL}/auth/otp/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalizePhone(phone) }),
      });
      const data = await r.json();
      const shown = data?.devCode ?? data?.code;
      if (shown) alert("DEV OTP: " + shown); // local test
      if (!data?.ok) alert("OTP isteği başarısız");
    } catch {
      alert("OTP isteği başarısız");
    }
  }

  async function verifyOtp() {
    try {
      const r = await fetch(`${API_URL}/auth/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: normalizePhone(phone),
          code: normalizeCode(code),
        }),
      });
      const data = await r.json();

      if (!data?.ok || !data?.accessToken) {
        const msg =
          data?.reason === "OTP_expired"
            ? "Kodun süresi doldu"
            : data?.reason === "OTP_mismatch"
            ? "Kod hatalı"
            : "Giriş başarısız";
        alert(msg);
        return;
      }

      setToken(data.accessToken);
      onSuccess();
    } catch {
      alert("Giriş sırasında hata oluştu");
    }
  }

  return (
    <div className="relative min-h-dvh overflow-hidden">
      {/* Arkaplan slaytları */}
      <div className="absolute inset-0">
        {STADIUMS.map((src, i) => (
          <img
            key={i}
            src={src}
            alt="stadium"
            className={`absolute inset-0 size-full object-cover transition-opacity duration-1000 ${
              i === idx ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
        <div className="absolute inset-0 bg-black/70" />
      </div>

      {/* İçerik */}
      <div className="relative z-10 min-h-dvh flex flex-col items-center justify-center p-6">
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-3 text-3xl font-semibold">
            <Footprints className="size-8" />
            <span>MatchFinder</span>
          </div>
          <p className="mt-2 text-sm text-neutral-300">Bölge + Pozisyon + Seviye ile maça katıl</p>
        </div>

        <div className="w-full max-w-sm rounded-2xl bg-neutral-900/70 backdrop-blur p-5 shadow-xl ring-1 ring-white/10">
          <div className="space-y-3">
            <label className="block text-sm text-neutral-300">Telefon Numarası</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="5xx xxx xx xx"
              className="w-full rounded-xl bg-neutral-800 px-4 py-3 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-emerald-400"
              inputMode="tel"
            />

            <label className="block text-sm text-neutral-300">OTP Kodu</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="000000"
              className="w-full rounded-xl bg-neutral-800 px-4 py-3 tracking-widest outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-emerald-400"
              inputMode="numeric"
            />

            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={requestOtp}
                className="rounded-xl border border-white/10 px-4 py-3 hover:bg-white/5"
              >
                Kod Gönder
              </button>

              <button
                type="button"
                onClick={verifyOtp}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 font-medium text-neutral-950 hover:bg-emerald-400"
              >
                <LogIn className="size-5" /> Giriş Yap
              </button>
            </div>

            <p className="text-xs text-neutral-400">
              Giriş ile <a className="underline">KVKK Aydınlatma</a> ve{" "}
              <a className="underline">Kullanım Koşulları</a>nı kabul edersiniz.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------- Ana kabuk ---------------------- */

function MainShell({
  activeTab,
  onTab,
}: {
  activeTab: "matches" | "series" | "teams" | "profile" | "player";
  onTab: (t: any) => void;
}) {
  const router = useRouter();
  const onTabNav = (t: 'matches'|'series'|'teams'|'profile'|'player') => {
    onTab(t);
    router.replace(`/landing?tab=${t}`);
  };
  return (
    <div className="relative min-h-dvh pb-24">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-neutral-950/80 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-neutral-950/60">
        <div className="text-lg font-semibold">MatchFinder</div>
        <div className="flex items-center gap-2">
          <PendingRatingsBell />
          <NotificationsBell />
          <FriendsBell />
          <InvitesBell />
          <div className="text-xs text-neutral-400">MVP Demo</div>
        </div>
      </header>

      <main className="px-4 py-4">
        {activeTab === "matches" && <MatchesScreen />}
        {activeTab === "series"  && <SeriesTab />}
        {activeTab === "teams"   && <TeamsTab />}
        {activeTab === "profile" && <ProfileScreen />}
        {activeTab === "player" && <PlayerProfile />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-neutral-950/80 backdrop-blur supports-[backdrop-filter]:bg-neutral-950/60">
        <div className="mx-auto flex max-w-md items-stretch justify-around py-2">
          <TabButton
            icon={<CalendarDays className="size-5" />}
            label="Maçlar"
            active={activeTab === "matches"}
            onClick={() => onTabNav('matches')}
          />
          <TabButton
            icon={<Repeat className="size-5" />}
            label="Seriler"
            active={activeTab === "series"}
            onClick={() => onTabNav('series')}
          />
          <TabButton
            icon={<UserRound className="size-5" />}
            label="Profil"
            active={activeTab === "profile"}
            onClick={() => onTabNav('profile')}
          />
          <TabButton
            icon={<Shield className="size-5" />}
            label="Oyuncu"
            active={activeTab === "player"}
            onClick={() => onTabNav('player')}
          />
          <TabButton
            icon={<Layers className="size-5" />}   
            label="Takımlar"
            active={activeTab === "teams"}
            onClick={() => onTabNav('teams')}
          />
        </div>
      </nav>
    </div>
  );
}

function TabButton({ icon, label, active, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex min-w-[110px] flex-col items-center justify-center rounded-xl px-3 py-2 ${
        active ? "text-emerald-400" : "text-neutral-300 hover:text-white"
      }`}
    >
      {icon}
      <span className="mt-1 text-xs">{label}</span>
    </button>
  );
}


/* ------- küçük yardımcı UI bileşenleri (dosyanın tepesine koy) ------- */
function BadgeBase({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ${className}`}>
      {children}
    </span>
  );
}

function BadgeNeutral({ children }: { children: React.ReactNode }) {
  return <BadgeBase className="bg-white/10 ring-white/15">{children}</BadgeBase>;
}
function BadgeLock({ children = "Kilitli" }: { children?: React.ReactNode }) {
  return <BadgeBase className="bg-amber-500/15 text-amber-300 ring-amber-500/30">{children}</BadgeBase>;
}
function BadgeSeries({ children = "Seri" }: { children?: React.ReactNode }) {
  return <BadgeBase className="bg-indigo-500/15 text-indigo-300 ring-indigo-500/30">{children}</BadgeBase>;
}
function BadgeClosed({ children = "Kapalı" }: { children?: React.ReactNode }) {
  return <BadgeBase className="bg-rose-600/15 text-rose-300 ring-rose-500/30">{children}</BadgeBase>;
}


function StatPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-lg bg-neutral-800/80 px-2.5 py-1 text-xs">
      {children}
    </span>
  );
}


/* ------------------ Maçlar ekranı ------------------ */
function MatchesScreen() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  const { me } = useMe();
  const meId = me?.id ?? null;

  // Liste & UI
  const [items, setItems] = React.useState<MatchLiteWithAccess[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [joining, setJoining] = React.useState<string | null>(null);

  // Kilitli maça erişim isteği state
  const [requestingId, setRequestingId] = React.useState<string | null>(null);
  const [requested, setRequested] = React.useState<Record<string, boolean>>({});

  async function requestAccess(matchId: string, message?: string) {
    const hdr = authHeader();
    if (!hdr.Authorization) { alert("Giriş gerekli."); window.location.href = "/"; return; }
    try {
      setRequestingId(matchId);
      const res = await fetch(`${API_URL}/matches/${matchId}/request-access`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...hdr },
        body: JSON.stringify({ message: message ?? "" }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok === false) throw new Error(j?.message || `HTTP ${res.status}`);
      setRequested(prev => ({ ...prev, [matchId]: true }));
      alert("Erişim isteği gönderildi 👌");
    } catch (e: any) {
      alert(e?.message || "İstek gönderilemedi");
    } finally {
      setRequestingId(null);
    }
  }

  // Değerlendirme modal
  const [rateOpen, setRateOpen] = React.useState(false);
  const [ratePayload, setRatePayload] = React.useState<any | null>(null);

  // Filtreler
  const [level, setLevel] = React.useState<"" | "Kolay" | "Orta" | "Zor">("");
  const [format, setFormat] = React.useState<"" | "5v5" | "6v6" | "7v7" | "8v8" | "9v9" | "10v10" | "11v11">("");
  const [hidePast, setHidePast] = React.useState(true);

  // Kullanıcının ilk 3 tercihi
  const prefs = React.useMemo<string[]>(() => {
    const list = Array.isArray((me as any)?.topPositions)
      ? (me as any).topPositions
      : Array.isArray(me?.positions)
      ? me!.positions
      : [];
    return list.slice(0, 3);
  }, [me]);

  async function refresh() {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/matches`, { cache: "no-store", headers: H() });
      const data = await r.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    const needWatch = items.some(m => m.inviteOnly && !(m as any).access?.canView);
    if (!needWatch) return;
    const t = setInterval(() => { refresh(); }, 20000);
    return () => clearInterval(t);
  }, [items]);

  // Yardımcılar
  function missingOf(m: any): string[] {
    const slots: any[] = Array.isArray(m?.slots) ? m.slots : [];
    return slots.filter((s) => !s.userId && !s.placeholder).map((s) => s.pos);
  }
  function myPos(m: any): string | null {
    const slots: any[] = Array.isArray(m?.slots) ? m.slots : [];
    const s = slots.find((s) => s.userId === meId);
    return s?.pos || null;
  }
    // --- TAKIM MAÇI / HIGHLIGHT helper'ları ---
  const isTeamMatch = (m: any) =>
    (m?.createdFrom === 'TEAM_MATCH') || (!!(m as any)?.teamAId && !!(m as any)?.teamBId);

  const isHighlighted = (m: any) => {
    if (!isTeamMatch(m)) return false;
    const until = (m as any)?.highlightUntil ? Date.parse(String((m as any).highlightUntil)) : 0;
    return Number.isFinite(until) && until > Date.now();
  };

  function logout() { clearToken(); window.location.href = "/"; }

  // Hızlı katıl
  async function quickJoin(m: MatchLiteWithAccess) {
    const isOwner = m.ownerId === meId;
    const minePos = myPos(m);


    const canView = m.inviteOnly ? (Boolean(m.access?.canView) || isOwner || Boolean(minePos)) : true;
    if (!canView) {
      if (m.access?.requestPending || requested[m.id]) {
        alert("Erişim isteğin onay bekliyor. Onaylanınca otomatik açılacak.");
      } else {
        alert("Bu maç kilitli. Admin onayı/davet gerekli. Karttan 'İstek yolla'ya tıklayın.");
      }
      return;
    }

    if (minePos) { window.location.href = `/match/${m.id}`; return; }

    setJoining(m.id);
    try {
      const hdr = authHeader();
      if (!hdr.Authorization) { alert("Oturum gerekli. Lütfen giriş yapın."); window.location.href = "/"; return; }

      const chk = await fetch(`${API_URL}/users/me`, { headers: { ...hdr }, cache: "no-store" });
      if (chk.status === 401) { clearToken(); alert("Oturum gerekli veya süresi doldu. Lütfen tekrar giriş yapın."); window.location.href = "/"; return; }

      const rDet = await fetch(`${API_URL}/matches/${m.id}`, { cache: "no-store", headers: { ...hdr } });
      if (rDet.status === 403) { alert("Bu maç kilitli ve erişimin yok."); return; }
      const det = await rDet.json().catch(() => ({}));
      const slots: any[] = Array.isArray(det?.slots) ? det.slots : [];
      const missing: string[] = slots.filter((s: any) => !s.userId && !s.placeholder).map((s: any) => s.pos);

      if (missing.length === 0) { window.location.href = `/match/${m.id}?selectPosition=1`; return; }

      const chosenPos = (prefs ?? []).find((p) => missing.includes(p)) ?? missing[0];

      const r = await fetch(`${API_URL}/matches/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...hdr },
        body: JSON.stringify({ matchId: m.id, pos: chosenPos }),
      });

      if (r.status === 401) { clearToken(); alert("Oturum gerekli veya süresi doldu. Lütfen tekrar giriş yapın."); window.location.href = "/"; return; }
      if (r.status === 403) { alert("Erişim yok. Maç kilitli olabilir."); window.location.href = `/match/${m.id}`; return; }

      const data = await r.json().catch(() => ({}));
      if (!r.ok || data?.ok === false) {
        alert(data?.message || "Katılım başarısız.");
        window.location.href = `/match/${m.id}`;
        return;
      }
      window.location.href = `/match/${m.id}`;
    } catch (e: any) {
      alert(e?.message || "Katılım sırasında hata.");
      window.location.href = `/match/${m.id}`;
    } finally {
      setJoining(null);
    }
  }

  async function leave(m: MatchLite) {
    try {
      const hdr = authHeader();
      if (!hdr.Authorization) { alert("Oturum gerekli. Lütfen giriş yapın."); window.location.href = "/"; return; }
      const r = await fetch(`${API_URL}/matches/${m.id}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...hdr },
      });
      if (r.status === 401) { clearToken(); alert("Oturum gerekli veya süresi doldu. Lütfen tekrar giriş yapın."); window.location.href = "/"; return; }
      const data = await r.json().catch(() => ({}));
      if (!r.ok || data?.ok === false) throw new Error(data?.message || "Ayrılma başarısız");
      await refresh();
    } catch (e: any) {
      alert(e?.message || "Ayrılma başarısız");
    }
  }

  // ICS indir
  async function downloadIcs(matchId: string, title?: string | null) {
    try {
      const r = await fetch(`${API_URL}/matches/${matchId}/ics`, { headers: { ...H() }, cache: "no-store" });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.message || `HTTP ${r.status}`);
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `match-${matchId}.ics`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e?.message || "ICS indirilemedi");
    }
  }

  async function rsvp(matchId: string, status: 'GOING'|'NOT_GOING') {
    try {
      const r = await fetch(`${API_URL}/matches/${matchId}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json', ...H() },
        body: JSON.stringify({ status }),
      });
      const j = await r.json().catch(()=> ({}));
      if (!r.ok || j?.ok !== true) throw new Error(j?.message || `HTTP ${r.status}`);
      alert(status === 'GOING' ? 'Bu hafta geliyorum kaydedildi.' : 'Bu hafta gelmeyeceğin kaydedildi.');
    } catch (e:any) {
      alert(e?.message || 'RSVP hatası');
    }
  }

  async function cancelWeek(matchId: string) {
    if (!confirm('Bu haftaki maçı iptal etmek istediğine emin misin?')) return;
    try {
      const r = await fetch(`${API_URL}/matches/${matchId}/cancel-week`, { method: 'POST', headers: { ...H() } });
      const j = await r.json().catch(()=> ({}));
      if (!r.ok || j?.ok !== true) throw new Error(j?.message || `HTTP ${r.status}`);
      alert('Bu haftaki maç iptal edildi.');
      refresh();
    } catch (e:any) {
      alert(e?.message || 'İptal edilemedi');
    }
  }

  async function openRateFor(match: MatchLite) {
    try {
      const hdr = authHeader();
      const det = await fetch(`${API_URL}/matches/${match.id}`, { headers: { ...hdr }, cache: "no-store" }).then((r) => r.json());
      const slots: any[] = Array.isArray(det?.slots) ? det.slots : [];
      const uids: string[] = Array.from(new Set(slots.map((s: any) => s?.userId).filter((u: any): u is string => typeof u === "string" && !!u && u !== meId)));
      const posMap = new Map<string, string | null>();
      slots.forEach((s: any) => { if (s?.userId) posMap.set(String(s.userId), (s.pos ?? null) as any); });
      const players = uids.map((id) => ({ id, phone: null as string | null, pos: posMap.get(id) ?? null }));
      setRatePayload({ matchId: match.id, title: match.title, players });
      setRateOpen(true);
    } catch {
      alert("Oyuncular yüklenemedi.");
    }
  }

  // Filtrelenmiş liste
  const filtered = items.filter((m) => {
    if (hidePast && m.time) { try { if (new Date(m.time) < new Date()) return false; } catch {} }
    if (level && m.level !== level) return false;
    if (format && m.format !== format) return false;
    return true;
  });

    // Highlight'lar en üstte, sonra zamana göre (en yakın önce)
  const list = [...filtered].sort((a, b) => {
    const ah = isHighlighted(a), bh = isHighlighted(b);
    if (ah !== bh) return ah ? -1 : 1;
    const ta = a.time ? Date.parse(String(a.time)) : Number.POSITIVE_INFINITY;
    const tb = b.time ? Date.parse(String(b.time)) : Number.POSITIVE_INFINITY;
    return ta - tb;
  });


  return (
    <div className="mx-auto max-w-4xl p-4 pb-20">
      {/* Üst bar filtreler */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href="/matches/new" className="rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-medium text-neutral-950 hover:bg-emerald-500">
          Maç Oluştur
        </Link>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="text-xs opacity-75">Seviye</label>
          <select value={level} onChange={(e) => setLevel(e.target.value as any)}
                  className="rounded-lg border border-white/10 bg-neutral-900/60 px-2 py-1 text-sm">
            <option value="">Hepsi</option><option>Kolay</option><option>Orta</option><option>Zor</option>
          </select>

          <label className="ml-2 text-xs opacity-75">Format</label>
          <select value={format} onChange={(e) => setFormat(e.target.value as any)}
                  className="rounded-lg border border-white/10 bg-neutral-900/60 px-2 py-1 text-sm">
            <option value="">Hepsi</option>
            <option>5v5</option><option>6v6</option><option>7v7</option><option>8v8</option><option>9v9</option><option>10v10</option><option>11v11</option>
          </select>

          <label className="ml-2 flex items-center gap-1 text-xs opacity-75">
            <input type="checkbox" checked={hidePast} onChange={(e) => setHidePast(e.target.checked)} />
            Geçmişi gizle
          </label>

          <button onClick={refresh} className="rounded-xl bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700">Yenile</button>
          <Link href="/discover" className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700">Keşfet</Link>
          <button onClick={logout} className="rounded-xl bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700">Çıkış</button>
        </div>
      </div>

      {/* içerik */}
      {loading && <div className="text-sm text-neutral-400">Yükleniyor…</div>}
      {!loading && !filtered.length && <div className="text-sm text-neutral-400">Kayıt yok</div>}

      <div className="space-y-3">
        {list.map((m) => {
          const teamMatch   = isTeamMatch(m);
          const highlighted = isHighlighted(m);
          const isOwner = m.ownerId === meId;
          const isSeriesMember = Boolean((m as any).access?.seriesMember);
          const mine = myPos(m);
          const canView = m.inviteOnly ? (Boolean(m.access?.canView) || isOwner || Boolean(mine)) : true;
          const pending = Boolean(m.access?.requestPending) || !!requested[m.id];
          const miss = missingOf(m);
          const prefHit = prefs.find((p) => miss.includes(p));

          // Doluluk
          const slotsArr: any[] = Array.isArray((m as any)?.slots) ? (m as any).slots : [];
          const total = slotsArr.length || (typeof m.format === "string" ? (() => {
            const n = parseInt(String(m.format).split("v")[0], 10);
            return Number.isFinite(n) ? n * 2 : 0;
          })() : 0);
          const filled = slotsArr.filter((s) => s?.userId).length;
          const pct = total ? Math.round((filled / total) * 100) : 0;
          const isFull = total > 0 && filled >= total;

          // 24 saat penceresi
          const now = Date.now();
          const t = m.time ? new Date(m.time).getTime() : 0;
          const ended = t && t < now;
          const within24h = ended && now - t <= 24 * 3600 * 1000;

          // etkin durum (backend dönerse onu kullan)
          const eff = (m as any).statusEffective ?? m.status;

          return (
            <div
              key={m.id}
              className={
              "rounded-2xl border p-3 sm:p-4 transition " +
              (highlighted
                  ? "border-rose-400/70 ring-1 ring-rose-400/40 bg-rose-500/5 shadow-[0_0_1.2rem_rgba(244,63,94,0.25)]"
                  : "border-white/10 ring-1 ring-white/10 bg-neutral-900/60")
              }
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {/* Sol: başlık + meta */}
                <div className="min-w-0">
                  {(() => {
                    const title = (m.title || "Maç").trim();
                    const isTitleIlk = title.toLocaleLowerCase("tr-TR") === "ilk";
                    const showSeriesBadge = Boolean((m as any).seriesId) && !isTitleIlk;

                    return (
                      <div className="flex flex-wrap items-center gap-2">
                        {showSeriesBadge && <BadgeSeries />}           {/* “Seri” */}
                        {m.inviteOnly && <BadgeLock />}               {/* Amber renk */}
                        {eff === "DRAFT" && <BadgeNeutral>Taslak</BadgeNeutral>}
                        {eff === "CLOSED" && <BadgeClosed />}         {/* Kırmızımsı */}
                        {teamMatch && (
                          <BadgeBase className="bg-emerald-500/15 text-emerald-300 ring-emerald-500/30">
                            Takım maçı
                          </BadgeBase>
                        )}
                        {highlighted &&  (
                          <BadgeBase className="bg-amber-500/20 text-amber-200 ring-amber-500/30">
                            Yeni eşleşme
                          </BadgeBase>
                          )}
                        <h3 className="truncate text-base font-semibold leading-6">{title}</h3>
                      </div>
                    );
                  })()}

                  {/* Meta pill’ler + tarih */}
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-neutral-300">
                    <StatPill>{m.location || "—"}</StatPill>
                    <StatPill>{m.level || "—"}</StatPill>
                    <StatPill>{m.format || "—"}</StatPill>
                    {m.time ? (
                      <span className="opacity-80">
                        {new Date(m.time).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    ) : (
                      <span className="opacity-60">Tarih bekleniyor</span>
                    )}
                  </div>

                  {/* Doluluk barı */}
                  <div className="mt-2">
                    <div className="h-1.5 w-full sm:w-64 rounded-full bg-neutral-800">
                      <div className="h-1.5 rounded-full bg-white/70" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-neutral-400">
                      <span>{filled}/{total} ({pct}%)</span>
                      {isFull && (
                        <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-rose-300 ring-1 ring-rose-500/30">
                          Dolu
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Uygunluk / katılım bilgisi */}
                  <div className="mt-1 text-xs">
                    {mine ? (
                      <span className={`font-medium ${isHighlighted(m) ? "text-emerald-300" : "text-emerald-400"}`}>
                        Katıldın • Pozisyonun: {mine}
                      </span>
                    ) : miss.length ? (
                      prefHit ? (
                        <span className="text-emerald-400">Eksik: {miss.join(", ")}</span>
                      ) : (
                        <span className="text-amber-400">Tercih mevki yok • Detaydan seçebilirsiniz</span>
                      )
                    ) : (
                      <span className="text-neutral-400">Pozisyonlar dolu</span>
                    )}
                  </div>
                </div>

                {/* Sağ: aksiyonlar */}
                <div className="flex flex-wrap items-center gap-2">
                  {!canView ? (
                    <>
                      <button
                        onClick={() => requestAccess(m.id)}
                        disabled={pending || requestingId === m.id}
                        className="rounded-xl bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700 disabled:opacity-60"
                      >
                        {pending ? "İstek gönderildi" : (requestingId === m.id ? "Gönderiliyor…" : "İstek yolla")}
                      </button>
                      <span className="rounded-xl bg-neutral-900/60 px-3 py-1.5 text-sm text-neutral-400 opacity-60">
                        Detay (kilitli)
                      </span>
                    </>
                  ) : (
                    <>
                      {!mine ? (
                        <button
                          onClick={() => quickJoin(m)}
                          disabled={joining === m.id || isFull || eff !== 'OPEN'}
                          className="rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-medium text-neutral-950 hover:bg-emerald-500 disabled:opacity-50"
                        >
                          {eff !== 'OPEN' ? "Kapalı" : isFull ? "Dolu" : joining === m.id ? "Katılıyor…" : "Katıl"}
                        </button>
                      ) : (
                        <button
                          onClick={() => leave(m)}
                          className="rounded-xl bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
                        >
                          Ayrıl
                        </button>
                      )}

                      <a href={`/match/${m.id}`} className="rounded-xl bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700">
                        Detay
                      </a>
                      <button
                        onClick={() => downloadIcs(m.id, m.title)}
                        className="rounded-xl bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
                      >
                        Takvime ekle
                      </button>
                      
                      {/* Seri ise RSVP grubu */}
                      {Boolean((m as any).seriesId) && (isOwner || isSeriesMember) && (
                        <>
                          <button
                            onClick={() => rsvp(m.id, 'GOING')}
                            disabled={eff !== 'OPEN'}
                            className="rounded-xl bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700 disabled:opacity-50"
                            title="Bu hafta geliyorum"
                          >
                            Geliyorum
                          </button>

                          <button
                            onClick={() => rsvp(m.id, 'NOT_GOING')}
                            disabled={eff !== 'OPEN'}
                            className="rounded-xl bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700 disabled:opacity-50"
                            title="Bu hafta gelemeyeceğim"
                          >
                            Gelmeyeceğim
                          </button>

                          {isOwner && (
                            <button
                              onClick={() => cancelWeek(m.id)}
                              className="rounded-xl bg-rose-600 px-3 py-1.5 text-sm hover:bg-rose-500"
                              title="Bu haftaki maçı iptal et"
                            >
                              Bu haftayı iptal et
                            </button>
                          )}
                        </>
                      )}
                      
                      {/* Maç bitti + 24s penceredeyse ve owner/katılımcıysa */}
                      {within24h && (mine || isOwner) && (
                        <button
                          onClick={() => openRateFor(m)}
                          className="rounded-xl bg-amber-600 px-3 py-1.5 text-sm hover:bg-amber-500"
                        >
                          Değerlendir
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Değerlendirme Modalı */}
      <RateMatchModal
        open={rateOpen}
        onClose={() => setRateOpen(false)}
        match={ratePayload}
        onSaved={() => { setRateOpen(false); refresh(); }}
      />
    </div>
  );
}


/* ---------------------- Profil ekranı ---------------------- */

function ProfileScreen() {
  const { me, refresh } = useMe();

  const [foot, setFoot] = React.useState<"L" | "R" | "N">("N");
  const [generalLevel, setGeneralLevel] = React.useState(5);
  const [prefs, setPrefs] = React.useState<string[]>([]);
  const [positionLevels, setPositionLevels] = React.useState<Record<string, number>>({});

  useEffect(() => {
    if (!me) return;
    setFoot((me.dominantFoot as any) || "N");
    setGeneralLevel(me.level ?? 5);
    setPrefs(Array.isArray(me.positions) ? me.positions : []);
    setPositionLevels(me.positionLevels ?? {});
  }, [me]);

  async function save() {
    try {
      const hdr = authHeader();
      if (!hdr.Authorization) {
        alert("Giriş yapmalısın.");
        return;
      }

      const body = {
        dominantFoot: foot,
        level: generalLevel,
        positions: Array.from(new Set(prefs)).slice(0, 3),
        positionLevels,
      };

      const r = await fetch(`${API_URL}/users/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...hdr },
        body: JSON.stringify(body),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.message || `HTTP ${r.status}`);

      alert("Kaydedildi!");
      await refresh?.();
    } catch (e: any) {
      alert(e?.message || "Kaydetme hatası");
    }
  }

  const ALL_POSITIONS = [
    { key: "GK", label: "Kaleci" },
    { key: "LB", label: "Sol Bek" },
    { key: "CB", label: "Stoper" },
    { key: "RB", label: "Sağ Bek" },
    { key: "LWB", label: "Sol Kanat Bek" },
    { key: "RWB", label: "Sağ Kanat Bek" },
    { key: "DM", label: "Ön Libero" },
    { key: "CM", label: "Merkez" },
    { key: "AM", label: "10 Numara" },
    { key: "LW", label: "Sol Kanat" },
    { key: "RW", label: "Sağ Kanat" },
    { key: "ST", label: "Santrafor" },
  ];

  function togglePos(k: string) {
    setPrefs((prev) => {
      const has = prev.includes(k);
      const next = has ? prev.filter((x) => x !== k) : [...prev, k];
      if (next.length > 3) next.shift();
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-3xl p-4">
      <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
        <div className="text-lg font-semibold">Kişisel Bilgiler</div>

        {/* Baskın ayak */}
        <div className="mt-3 flex items-center gap-2">
          <span className="text-sm text-neutral-300">Baskın Ayak</span>
          {(["L", "R", "N"] as const).map((f) => (
            <button
              key={f}
              className={`rounded-xl px-3 py-1.5 text-sm ${
                foot === f ? "bg-emerald-600 text-neutral-950" : "bg-neutral-800"
              }`}
              onClick={() => setFoot(f)}
            >
              {f === "L" ? "Sol" : f === "R" ? "Sağ" : "Çift"}
            </button>
          ))}
        </div>

        {/* Genel seviye */}
        <div className="mt-4">
          <div className="mb-1 text-sm">Genel Seviye (1–10)</div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={10}
              value={generalLevel}
              onChange={(e) => setGeneralLevel(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="w-8 text-right">{generalLevel}</div>
          </div>
        </div>

        {/* Tercih pozisyonlar (max 3) */}
        <div className="mt-4">
          <div className="mb-1 text-sm">Tercih Pozisyonlarım (3)</div>
          <div className="flex flex-wrap gap-2">
            {ALL_POSITIONS.map((p) => {
              const active = prefs.includes(p.key);
              return (
                <button
                  key={p.key}
                  onClick={() => togglePos(p.key)}
                  className={`rounded-xl px-3 py-1.5 text-sm ${
                    active ? "bg-emerald-600 text-neutral-950" : "bg-neutral-800"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Pozisyona göre seviye slider'ları */}
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {prefs.map((p) => (
            <div key={p} className="rounded-xl bg-neutral-800 p-3">
              <div className="mb-1 text-sm">{ALL_POSITIONS.find((x) => x.key === p)?.label} – Seviye</div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={positionLevels[p] ?? 7}
                  onChange={(e) => setPositionLevels((prev) => ({ ...prev, [p]: parseInt(e.target.value) }))}
                  className="w-full"
                />
                <div className="w-8 text-right">{positionLevels[p] ?? 7}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Müsaitlik seçimi */}
        <div className="mt-4">
          <AvailabilityEditor />
        </div>
        <div className="mt-4">
          <button
            onClick={save}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-emerald-500"
          >
            Profili Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------- Oyuncu ekranı (GERÇEK VERİ) ---------------------- */

type BehaviorAvg = {
  punctuality: number;
  respect: number;
  sportsmanship: number;
  swearing: number;     // negatif
  aggression: number;   // negatif
};
type BehaviorResp = { avg: BehaviorAvg | null; si: number; samples: number };

/** SI rengi (sayı + bar) */
function siColor(si: number) {
  if (si >= 90) return { bar: "bg-sky-500", text: "text-sky-400" };        // mavi
  if (si >= 60) return { bar: "bg-emerald-500", text: "text-emerald-400" }; // yeşil
  if (si >= 40) return { bar: "bg-amber-500", text: "text-amber-400" };     // sarı
  return { bar: "bg-rose-500", text: "text-rose-400" };                     // kırmızı
}

/** Pozisyon etiketleri */
function traitPosLabel(k: string) {
  const map: Record<string, string> = {
    GK: "Kaleci", LB: "Sol Bek", CB: "Stoper", RB: "Sağ Bek",
    LWB: "Sol Kanat Bek", RWB: "Sağ Kanat Bek",
    DM: "Ön Libero", CM: "Merkez", AM: "10 Numara",
    LW: "Sol Kanat", RW: "Sağ Kanat", ST: "Santrafor", STP: "Stoper",
  };
  return map[k] || k;
}

/** Oy yokken gösterilecek başlangıç ortalaması */
const BASELINE_AVG: BehaviorAvg = {
  punctuality: 4, respect: 4, sportsmanship: 4, swearing: 2, aggression: 2,
};

/** Elindeki computeSI fonksiyonunu kullanarak avg -> SI */
function siFromAvg(avg: BehaviorAvg) {
  const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
  const norm  = (v: number) => (clamp(v, 1, 5) - 1) / 4; // 1..5 → 0..1
  const P = (norm(avg.punctuality) + norm(avg.respect) + norm(avg.sportsmanship)) / 3;
  const Nminus = (1 - norm(avg.swearing) + 1 - norm(avg.aggression)) / 2;
  return Math.round(100 * (0.6 * P + 0.4 * Nminus));
}

/** Yıldız satırı (sadece gösterim) */
function RatingStars({
  label, value, negative = false,
}: {
  label: string;
  value: number;      // 1..5
  negative?: boolean; // küfür/agresiflik true
}) {
  // renk: pozitiflerde değer yükseldikçe mavi/yeşil; negatiflerde değer yükseldikçe kırmızıya kayar
  const colorClass = (() => {
    const v = value;
    if (!negative) {
      if (v >= 4)   return "text-sky-400";
      if (v >= 2.5) return "text-emerald-400";
      if (v >= 1.5) return "text-amber-400";
      return "text-rose-400";
    } else {
      if (v >= 4)   return "text-rose-400";
      if (v >= 2.5) return "text-amber-400";
      if (v >= 1.5) return "text-emerald-400";
      return "text-sky-400";
    }
  })();

  const filled = Math.round(value); // 1..5

  return (
    <div className="mt-1 flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <svg
            key={n}
            viewBox="0 0 24 24"
            className={`size-4 ${n <= filled ? colorClass : "text-neutral-600"}`}
            fill="currentColor"
            aria-hidden={true}
          >
            <title>{value.toFixed(1)}</title>
            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>
          </svg>
        ))}
      </div>
    </div>
  );
}

function PlayerProfile() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  const { me, loading, error } = useMe();

  // Formasyon (me’de kayıtlı tercihi al)
  const [formation, setFormation] =
    React.useState<"4-2-3-1" | "4-3-3" | "3-5-2">((me?.preferredFormation as any) || "4-2-3-1");
  React.useEffect(() => {
    if (me?.preferredFormation) setFormation(me.preferredFormation as any);
  }, [me?.preferredFormation]);

  // Davranış verisi
  const [behavior, setBehavior] = React.useState<BehaviorResp | null>(null);
  const [bLoading, setBLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      if (!me?.id) return;
      setBLoading(true);
      try {
        const r = await fetch(`${API_URL}/users/${me.id}/behavior`, {
          headers: { ...authHeader() },
          cache: "no-store",
        });
        const j = (await r.json()) as BehaviorResp;
        setBehavior(j);
      } catch {
        // bağlantı hatasında da baseline’a düş
        setBehavior({ avg: null, si: siFromAvg(BASELINE_AVG), samples: 0 });
      } finally {
        setBLoading(false);
      }
    })();
  }, [me?.id, API_URL]);

    const [posAgg, setPosAgg] = React.useState<Record<string,{avg:number,samples:number}>>({});
    React.useEffect(()=>{
      if(!me?.id) return;
      fetch(`${API_URL}/users/${me.id}/positions`, { headers:{...authHeader()}, cache:'no-store' })
        .then(r=>r.json())
        .then(j=> setPosAgg(j?.byPos || {}))
        .catch(()=> setPosAgg({}));
    }, [me?.id]);

  /* ---- Hooks: koşulsuz en üstte çağır ---- */
  const [positionLevels, setPositionLevels] = React.useState<Record<string, number>>({});

  React.useEffect(() => {
    if (me?.positionLevels && typeof me.positionLevels === "object") {
      setPositionLevels(me.positionLevels as any);
    } else {
      setPositionLevels({});
    }
  }, [me?.positionLevels]);

  /* ---- Guard return'lar: hook'lardan SONRA ---- */
  if (loading) return <div className="mx-auto max-w-4xl p-4">Yükleniyor…</div>;
  if (error)   return <div className="mx-auto max-w-4xl p-4 text-red-400">✗ {error}</div>;
  if (!me)     return null;

  /* ---- Devam ---- */
  const prefs: string[] = Array.isArray(me.positions) ? me.positions : [];
  const levels: Record<string, number> =
    (positionLevels && Object.keys(positionLevels).length > 0)
      ? positionLevels
      : (me?.positionLevels && typeof me.positionLevels === "object"
          ? (me.positionLevels as any)
          : {});

  // sahadaki anahtarı profil anahtarına eşle (STP -> CB gibi)
  const mapToProfileKey = (k: string) => (k === 'STP' ? 'CB' : k);
  const perfOf = (rawKey: string) => {
    const key = mapToProfileKey(rawKey);
    const row = (posAgg as any)?.[key] || (posAgg as any)?.[rawKey]; // { avg, samples }
    if (row && typeof row.avg === "number") {
      const baseline = (levels as any)?.[key]; // self-rating
      if (typeof baseline === "number" && typeof row.samples === "number" && row.samples >= 1) {
        // (gerçekToplam + self) / (örnek + 1)
        const mixed = (row.avg * row.samples + baseline) / (row.samples + 1);
        return mixed;
      }
      return row.avg;
    }
    return undefined;
  };

  const skillOf = (rawKey: string) => {
    // 0) gerçek ortalama varsa onu bas
    const perf = perfOf(rawKey);
    if (typeof perf === 'number') return Math.max(1, Math.min(10, perf));

    // 1) profil stored seviye?
    const key = mapToProfileKey(rawKey);
    const stored = (levels as any)?.[key];
    if (typeof stored === 'number') return Math.max(1, Math.min(10, stored));

    // 2) tercih edilen pozisyon → genel seviye
    if (Array.isArray(prefs) && prefs.includes(key)) {
      const g = typeof me?.level === 'number' ? me.level : 6;
      return Math.max(1, Math.min(10, g));
    }
    // 3) diğerleri 5
    return 5;
  };

  const slots = FORMATIONS[formation];

  // Gösterilecek ortalama: gerçek varsa o, yoksa baseline
  const showAvg: BehaviorAvg = behavior?.avg ?? BASELINE_AVG;
  // SI: gerçek varsa behavior.si, yoksa showAvg'dan hesap
  const si = behavior?.avg ? (behavior?.si ?? 70) : siFromAvg(showAvg);
  const siC = siColor(si);

  // Uyarılar (yalnız gerçek veri varsa)
  const warnings =
    behavior?.avg &&
    (Object.entries(behavior.avg) as [keyof BehaviorAvg, number][])
      .filter(([, v]) => v < 2.5);

  return (
    <div className="mx-auto grid max-w-4xl gap-4">
      <section className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">Kuşbakışı Saha & Tercihler</h3>
          <div className="flex gap-2">
            {(["4-2-3-1", "4-3-3", "3-5-2"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFormation(f)}
                className={`rounded-lg px-3 py-1 text-sm ${
                  formation === f ? "bg-emerald-500 text-neutral-900" : "bg-neutral-800"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Saha */}
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-green-800">
            <Pitch />
            {slots.map((p) => (
              <PositionBadge
                key={`${formation}-${p.key}-${p.x}-${p.y}`}
                pos={p as any}
                prefIndex={prefs.indexOf(p.key as any)}
                skill={skillOf(p.key)}
                onClick={() => {}}
              />
            ))}
          </div>

          {/* Sağ panel: Tercihler + Davranış */}
          <div className="space-y-4">
            {/* Tercihler */}
            <div className="rounded-xl border border-white/10 p-3">
              <div className="text-sm text-neutral-300">Tercihlerim</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {prefs.length ? (
                  prefs.map((k: string, i: number) => (
                    <span
                      key={k}
                      className="rounded-full bg-emerald-500/20 px-3 py-1 text-sm text-emerald-300"
                    >
                      { i + 1 }. {traitPosLabel(k)} • {Number(skillOf(k)).toFixed(1)}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-neutral-400">Profilde pozisyon seçiniz.</span>
                )}
              </div>
            </div>

            {/* Davranış */}
            <div className="rounded-xl border border-white/10 p-3">
              <div className="mb-2 text-sm text-neutral-300">
                Davranış Değerlendirmeleri (anonim, 1–5)
              </div>

              {bLoading && <div className="text-xs text-neutral-400">Yükleniyor…</div>}

              {!bLoading && (
                <>
                  <RatingStars label="Dakiklik"   value={showAvg.punctuality} />
                  <RatingStars label="Saygı"       value={showAvg.respect} />
                  <RatingStars label="Sportmenlik" value={showAvg.sportsmanship} />
                  <RatingStars label="Küfür"       value={showAvg.swearing}    />
                  <RatingStars label="Agresiflik"  value={showAvg.aggression}  />

                  <div className="mt-3 flex items-center justify-between rounded-xl bg-neutral-800 p-3">
                    <div>
                      <div className="text-xs text-neutral-400">Sportmenlik Katsayısı</div>
                      <div className={`text-2xl font-semibold ${siC.text}`}>{si}</div>
                      <div className="text-[11px] text-neutral-400">
                        {behavior?.avg ? `Örnek sayısı: ${behavior?.samples ?? 0}` : "Topluluk başlangıcı"}
                      </div>
                    </div>
                    <div className="h-2 w-40 overflow-hidden rounded bg-neutral-900">
                      <div className={`h-full ${siC.bar}`} style={{ width: `${si}%` }} />
                    </div>
                  </div>

                  {warnings && warnings.length > 0 && (
                    <div className="mt-3 rounded-lg bg-yellow-500/10 p-2 text-[12px] text-amber-300">
                      <div className="font-medium">Uyarılar</div>
                      <ul className="list-disc pl-4">
                        {warnings.map(([k, v]) => (
                          <li key={k}>
                            {({ punctuality:"Dakiklik", respect:"Saygı", sportsmanship:"Sportmenlik", swearing:"Küfür", aggression:"Agresiflik" } as any)[k]}{" "}
                            ort. {v.toFixed(1)} — {v < 1.5 ? "kırmızı" : "sarı"}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
        <h3 className="mb-2 text-base font-semibold">Açıklama</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-300">
          <li>Diziliş seçimi sahadaki mevkileri günceller (3-5-2'de <b>LWB/RWB</b> görünür).</li>
          <li>Değerlendirmeler 24 saat içinde yapılır ve ağırlıklandırılır.</li>
        </ul>
      </section>
    </div>
  );
}

/* ---------------------- Yardımcı bileşenler ---------------------- */

function Pitch() {
  return (
    <div className="absolute inset-0">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.07),transparent_60%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.05),transparent_60%)]" />
      <div className="absolute inset-2 rounded-xl border-4 border-white/50" />
      <div className="absolute left-1/2 top-2 bottom-2 w-1 -translate-x-1/2 bg-white/50" />
      <div className="absolute left-1/2 top-1/2 size-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white/50" />
      <div className="absolute left-2 top-1/2 h-40 w-24 -translate-y-1/2 border-4 border-white/50" />
      <div className="absolute right-2 top-1/2 h-40 w-24 -translate-y-1/2 border-4 border-white/50" />
      <div className="absolute left-0 top-1/2 h-16 w-2 -translate-y-1/2 bg-white/70" />
      <div className="absolute right-0 top-1/2 h-16 w-2 -translate-y-1/2 bg-white/70" />
    </div>
  );
}

function PositionBadge({
  pos,
  prefIndex,
  skill,
  onClick,
}: {
  pos: { key: PositionKey; label: string; x: number; y: number };
  prefIndex: number;
  skill: number;
  onClick: () => void;
}) {
  const active = prefIndex !== -1;
  return (
    <button
      onClick={onClick}
      className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-xl px-2 py-1 text-xs shadow transition ${
        active ? "bg-emerald-500 text-neutral-950" : "bg-black/60 text-white"
      }`}
      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
      title={`${pos.label} • Seviye ${skill}`}
    >
      <span className="font-medium">{pos.key}</span> <span className="opacity-80">{skill}</span>
      {active && <span className="ml-1 rounded bg-neutral-900/30 px-1">{prefIndex + 1}</span>}
    </button>
  );
}

function TraitRow({
  label,
  value,
  onChange,
  negative = false,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  negative?: boolean;
}) {
  return (
    <div className="mt-2 flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`grid size-8 place-items-center rounded-md ${
              value >= n ? (negative ? "bg-red-500/70" : "bg-emerald-500/80") : "bg-neutral-800"
            }`}
          >
            <IconStar className="size-4" />
          </button>
        ))}
      </div>
    </div>
  );
}

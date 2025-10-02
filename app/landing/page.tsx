"use client";

import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, UserRound, Shield, LogIn, Star, Footprints } from "lucide-react";
import { useMe } from "@/lib/useMe";
import Link from "next/link"; // diğer importların yanına
import { useRouter } from "next/navigation";

// API kökü
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

type MatchLite = {
  id: string;
  title?: string | null;
  location?: string | null;
  level?: string | null;
  format?: string | null;
  price?: number | null;
  time?: string | null;
  createdAt?: string;
};

// --- slot tipi & eksik hesaplama helper'ı ---
type SlotLite = { pos: string; userId?: string | null };

function missingOf(m: any): string[] {
  return Array.isArray(m?.slots)
    ? (m.slots as SlotLite[]).filter((s) => !s.userId).map((s) => s.pos)
    : [];
}


const LEVELS = ["Kolay", "Orta", "Zor"] as const;
const FORMATS = ["5v5", "7v7", "8v8", "11v11"] as const

// Arkaplan görselleri (demo)
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

// Saha üstü etiketler (Oyuncu sekmesi için)
const POSITIONS = [
  { key: "GK", label: "Kaleci", x: 5, y: 50 },
  { key: "SB", label: "Sol Bek", x: 20, y: 20 },
  { key: "STP", label: "Stoper", x: 20, y: 50 },
  { key: "RB", label: "Sağ Bek", x: 20, y: 80 },
  { key: "DM", label: "Ön Libero", x: 40, y: 50 },
  { key: "LW", label: "Sol Kanat", x: 55, y: 20 },
  { key: "CM", label: "Merkez", x: 55, y: 50 },
  { key: "RW", label: "Sağ Kanat", x: 55, y: 80 },
  { key: "AM", label: "10 Numara", x: 72, y: 50 },
  { key: "ST", label: "Santrafor", x: 88, y: 50 },
] as const;

// Günler ve etiketleri
const DAYS = [
  { key: "mon", label: "Pzt" },
  { key: "tue", label: "Sal" },
  { key: "wed", label: "Çar" },
  { key: "thu", label: "Per" },
  { key: "fri", label: "Cum" },
  { key: "sat", label: "Cmt" },
  { key: "sun", label: "Paz" },
];
// Basit normalize: true ise "20:00-24:00" slotu
function normalizeAvailability(raw: any): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const d of DAYS) {
    const v = raw?.[d.key];
    if (Array.isArray(v)) out[d.key] = v;
    else if (v === true) out[d.key] = ["20:00-24:00"];
    else out[d.key] = Array.isArray(v) ? v : (typeof v === "string" && v ? [v] : []);
  }
  return out;
}

function AvailabilityPicker({
  value,
  onChange,
}: {
  value: Record<string, string[]>;
  onChange: (v: Record<string, string[]>) => void;
}) {
  const val = normalizeAvailability(value);

  function toggleDay(k: string) {
    const next = { ...val };
    next[k] = next[k]?.length ? [] : ["20:00-24:00"];
    onChange(next);
  }

  return (
    <div className="mt-4 rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
      <div className="mb-2 text-base font-semibold">Müsaitlik</div>
      <div className="grid gap-3 md:grid-cols-3">
        {DAYS.map((d) => {
          const active = !!val[d.key]?.length;
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => toggleDay(d.key)}
              className={`w-full rounded-xl px-4 py-3 text-sm ${
                active
                  ? "bg-emerald-600 text-neutral-950"
                  : "bg-neutral-800 hover:bg-neutral-700"
              }`}
            >
              {d.label} {active ? "20:00–24:00" : "—"}
            </button>
          );
        })}
      </div>
      <div className="mt-2 text-xs text-neutral-400">
        (MVP: her gün için tek slot; sonraki iterasyonda esnek saat aralıkları eklenecek)
      </div>
    </div>
  );
}
// Profil/oyuncu tipleri
// --- Dizilişler (saha yerleşimleri) ---
type PositionKey =
  | "GK" | "LB" | "CB" | "RB" | "LWB" | "RWB"
  | "DM" | "CM" | "AM" | "LW" | "RW" | "ST"
  | "SB" | "STP"; // mevcut kodda SB/STP de var

type PitchSlot = { key: PositionKey; label: string; x: number; y: number };

const FORMATIONS: Record<string, PitchSlot[]> = {
  "4-2-3-1": [
    { key: "GK",  label: "Kaleci",      x: 6,  y: 50 },
    { key: "LB",  label: "Sol Bek",     x: 20, y: 20 },
    { key: "CB",  label: "Stoper",      x: 20, y: 42 },
    { key: "STP", label: "Stoper",      x: 20, y: 58 },
    { key: "RB",  label: "Sağ Bek",     x: 20, y: 80 },
    { key: "DM",  label: "Ön Libero",   x: 40, y: 38 },
    { key: "CM",  label: "Merkez",      x: 40, y: 62 },
    { key: "LW",  label: "Sol Kanat",   x: 60, y: 20 },
    { key: "AM",  label: "10 Numara",   x: 60, y: 50 },
    { key: "RW",  label: "Sağ Kanat",   x: 60, y: 80 },
    { key: "ST",  label: "Santrafor",   x: 84, y: 50 },
  ],

  "4-3-3": [
    { key: "GK",  label: "Kaleci",      x: 6,  y: 50 },
    { key: "LB",  label: "Sol Bek",     x: 20, y: 20 },
    { key: "CB",  label: "Stoper",      x: 20, y: 42 },
    { key: "STP", label: "Stoper",      x: 20, y: 58 },
    { key: "RB",  label: "Sağ Bek",     x: 20, y: 80 },
    { key: "DM",  label: "Ön Libero",   x: 40, y: 50 },
    { key: "CM",  label: "Merkez",      x: 52, y: 35 },
    { key: "AM",  label: "İleri Orta",  x: 52, y: 65 },
    { key: "LW",  label: "Sol Kanat",   x: 70, y: 20 },
    { key: "ST",  label: "Santrafor",   x: 84, y: 50 },
    { key: "RW",  label: "Sağ Kanat",   x: 70, y: 80 },
  ],

"3-5-2": [
  // Kaleci
  { key: "GK",  label: "Kaleci", x: 8,  y: 50 },

  // 3 Stoper (LCB, CB, RCB)
  { key: "CB",  label: "Stoper", x: 22, y: 32 },
  { key: "CB",  label: "Stoper", x: 22, y: 50 },
  { key: "CB",  label: "Stoper", x: 22, y: 68 },

  // Çift ön libero (CDM)
  { key: "DM",  label: "Ön Libero", x: 40, y: 42 },
  { key: "DM",  label: "Ön Libero", x: 40, y: 58 },

  // Orta saha ortası (CAM)
  { key: "AM",  label: "10 Numara", x: 58, y: 50 },

  // Kanat orta sahalar (LM/RM -> LW/RW)
  { key: "LWB",  label: "LMB", x: 50, y: 20 },
  { key: "RWB",  label: "RMB", x: 50, y: 80 },

  // Çift forvet
  { key: "ST",  label: "Santrafor", x: 86, y: 40 },
  { key: "ST",  label: "Santrafor", x: 86, y: 60 },
],
};

type Traits = {
  punctual: number;
  respect: number;
  fairplay: number;
  swearing: number;   // negatif
  aggressive: number; // negatif
};

const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
function computeSI(t: Traits) {
  const norm = (v: number) => (clamp(v, 1, 5) - 1) / 4; // 1..5 -> 0..1
  const P = (norm(t.punctual) + norm(t.respect) + norm(t.fairplay)) / 3;
  const Nminus = (1 - norm(t.swearing) + 1 - norm(t.aggressive)) / 2;
  return Math.round(100 * (0.6 * P + 0.4 * Nminus));
}

export default function Page() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("token")) {
      setAuthed(true);
    }
  }, []);

  const [activeTab, setActiveTab] = useState<"matches" | "profile" | "player">("matches");

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

      if (!data?.ok) {
        const msg =
          data?.reason === "OTP_expired"
            ? "Kodun süresi doldu"
            : data?.reason === "OTP_mismatch"
            ? "Kod hatalı"
            : "Giriş başarısız";
        alert(msg);
        return;
      }

      if (data.accessToken) localStorage.setItem("token", data.accessToken);
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
          <p className="mt-2 text-sm text-neutral-300">
            Bölge + Pozisyon + Seviye ile maça katıl
          </p>
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
  activeTab: "matches" | "profile" | "player";
  onTab: (t: any) => void;
}) {
  return (
    <div className="relative min-h-dvh pb-24">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-neutral-950/80 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-neutral-950/60">
        <div className="text-lg font-semibold">MatchFinder</div>
        <div className="text-xs text-neutral-400">MVP Demo</div>
      </header>

      <main className="px-4 py-4">
        {activeTab === "matches" && <MatchesScreen />}
        {activeTab === "profile" && <ProfileScreen />}
        {activeTab === "player" && <PlayerProfile />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-neutral-950/80 backdrop-blur supports-[backdrop-filter]:bg-neutral-950/60">
        <div className="mx-auto flex max-w-md items-stretch justify-around py-2">
          <TabButton
            icon={<CalendarDays className="size-5" />}
            label="Maçlar"
            active={activeTab === "matches"}
            onClick={() => onTab("matches")}
          />
          <TabButton
            icon={<UserRound className="size-5" />}
            label="Profil"
            active={activeTab === "profile"}
            onClick={() => onTab("profile")}
          />
          <TabButton
            icon={<Shield className="size-5" />}
            label="Oyuncu"
            active={activeTab === "player"}
            onClick={() => onTab("player")}
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

function CreateMatchForm({ onCreated }: { onCreated: (m: MatchLite) => void }) {
  const [title, setTitle] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [level, setLevel] = React.useState<typeof LEVELS[number]>("Orta");
  const [format, setFormat] = React.useState<typeof FORMATS[number]>("7v7");
  const [price, setPrice] = React.useState<number | "">("");
  const [time, setTime] = React.useState<string>(""); // datetime-local
  const [busy, setBusy] = React.useState(false);

  async function submit() {
    if (!title.trim()) return alert("Başlık zorunlu");
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/matches`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          location: location.trim() || null,
          level,
          format,
          price: price === "" ? null : Number(price),
          time: time ? new Date(time).toISOString() : null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const created = (await res.json()) as MatchLite;
      onCreated(created);
      // formu sıfırla
      setTitle(""); setLocation(""); setLevel("Orta"); setFormat("7v7"); setPrice(""); setTime("");
    } catch (e: any) {
      alert(`Oluşturma hatası: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4 mb-6">
      <div className="mb-2 font-semibold">Yeni Maç</div>
      <div className="grid gap-2 md:grid-cols-2">
        <input className="rounded bg-neutral-800 px-3 py-2"
               placeholder="Başlık"
               value={title} onChange={e=>setTitle(e.target.value)} />
        <input className="rounded bg-neutral-800 px-3 py-2"
               placeholder="Konum"
               value={location} onChange={e=>setLocation(e.target.value)} />
        <select className="rounded bg-neutral-800 px-3 py-2"
                value={level} onChange={e=>setLevel(e.target.value as any)}>
          {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <select className="rounded bg-neutral-800 px-3 py-2"
                value={format} onChange={e=>setFormat(e.target.value as any)}>
          {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <input className="rounded bg-neutral-800 px-3 py-2"
               type="number" placeholder="Fiyat (₺)"
               value={price} onChange={e=>setPrice(e.target.value === "" ? "" : Number(e.target.value))} />
        <input className="rounded bg-neutral-800 px-3 py-2"
               type="datetime-local"
               value={time} onChange={e=>setTime(e.target.value)} />
      </div>
      <div className="mt-3">
        <button disabled={busy}
                onClick={submit}
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-emerald-400 disabled:opacity-50">
          {busy ? "Oluşturuluyor…" : "Oluştur"}
        </button>
      </div>
    </div>
  );
}

// ---- Maçlar listesi ----
function MatchesList() {
  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [toastMsg, setToastMsg] = React.useState<string | null>(null);

  function toast(s: string) {
    setToastMsg(s);
    setTimeout(() => setToastMsg(null), 1600);
  }

  async function fetchMatches() {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/matches`, { cache: "no-store" });
      const d = await r.json();
      setItems(Array.isArray(d) ? d : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    fetchMatches();
  }, []);

  async function quickJoin(matchId: string) {
    try {
      const r = await fetch(`${API_URL}/matches/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ matchId }), // pos YOK → backend tercihlerini dener
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.message || "Katılım olmadı");

      toast(`Katıldın: ${data.pos}`);
      // listeyi güncelle (eksikler ve buton durumu değişsin)
      fetchMatches();
    } catch (e: any) {
      alert(e?.message || "Katılım sırasında hata");
    }
  }

  if (loading) return <div className="text-sm text-neutral-400">Yükleniyor…</div>;
  if (!items.length) return <div className="text-sm text-neutral-400">Kayıt yok</div>;

  return (
    <div className="mx-auto max-w-3xl p-4">
      <h2 className="text-lg font-semibold">Bu Hafta Açık Katılım</h2>

      <div className="mt-4 space-y-3">
        {items.map((m) => {
          const missing = missingOf(m); // <— eksikleri slots’tan hesapla
          return (
            <div
              key={m.id}
              className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4"
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-base font-medium">
                    {m.title || "Maç"}
                  </div>
                  <div className="mt-1 text-sm text-neutral-300">
                    {m.location || "—"} · {m.level || "—"} · {m.format || "—"}{" "}
                    ·{" "}
                    {m.time
                      ? new Date(m.time).toLocaleString([], {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : ""}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-medium text-neutral-950 hover:bg-emerald-500 disabled:opacity-40"
                    onClick={() => quickJoin(m.id)}
                    disabled={missing.length === 0} // boş slot yoksa katılma
                  >
                    Katıl
                  </button>

                  <Link
                    href={`/match/${m.id}`}
                    prefetch={false}
                    className="rounded-xl bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
                  >
                    Detay
                  </Link>
                </div>
              </div>

              {/* Eksik pozisyon bilgisi */}
              <div className="mt-2 text-xs text-emerald-400">
                {missing.length ? (
                  <>Eksik: {missing.join(", ")}</>
                ) : (
                  <>Pozisyon seçilmemiş ya da dolu</>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* minik toast */}
      {toastMsg && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-neutral-950 shadow-lg">
          {toastMsg}
        </div>
      )}
    </div>
  );
}

// Maç Ekranı
// ---- Maçlar sekmesi: liste + filtre + hızlı katıl/ayrıl ----
function MatchesScreen() {
  // API kökü ve token yardımcıları dosyada zaten var:
  // const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  // function getToken() { ... }

  // JWT'den kendi id'm
  const meId: string | null = (() => {
    try {
      const t = getToken();
      if (!t) return null;
      const p = JSON.parse(atob(t.split(".")[1] || ""));
      return p?.id || p?.sub || p?.userId || null;
    } catch { return null; }
  })();

  const [items, setItems] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [joining, setJoining] = React.useState<string | null>(null);
  const [showCreate, setShowCreate] = React.useState(false);

  // filtreler
  const [level, setLevel]   = React.useState<string>("Hepsi");
  const [format, setFormat] = React.useState<string>("Hepsi");
  const [hidePast, setHidePast] = React.useState(true);

  // kullanıcının tercihleri (ilk 3)
  const [prefs, setPrefs] = React.useState<string[]>([]);

  async function refresh() {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/matches`, { cache: "no-store" });
      const data = await r.json();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadPrefs() {
    try {
      const token = getToken();
      if (!token) return;
      const r = await fetch(`${API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (Array.isArray(d?.positions)) {
        setPrefs(d.positions.map(String).slice(0, 3));
      }
    } catch {}
  }

  React.useEffect(() => { refresh(); loadPrefs(); }, []);

  // eksik ve benim pozisyonum
  function missingOf(m: any): string[] {
    const slots: any[] = Array.isArray(m.slots) ? m.slots : [];
    return slots.filter((s) => !s.userId).map((s) => s.pos);
  }
  function myPos(m: any): string | null {
    const slots: any[] = Array.isArray(m.slots) ? m.slots : [];
    const s = slots.find((s) => s.userId === meId);
    return s?.pos || null;
  }

  // hızlı katıl: sadece tercihlerden boş varsa katılsın
  async function joinQuick(m: any) {
    const token = getToken();
    if (!token) { alert("Lütfen önce giriş yap."); return; }

    setJoining(m.id);
    try {
      const r = await fetch(`${API_URL}/matches/join`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ matchId: m.id, strict: true }), // kritik: tercih dışına düşmesin
      });
      const data = await r.json();

      if (r.status === 401) { alert("Yetkisiz (Unauthorized)"); return; }
      if (r.status === 409 && data?.message === "no preferred open slot") {
        alert("Tercih mevki yok.");
        return;
      }
      if (!r.ok || !data?.ok) throw new Error(data?.message || "Katılım başarısız");

      refresh();
    } catch (e: any) {
      alert(e?.message || "Katılım başarısız");
    } finally {
      setJoining(null);
    }
  }

  async function leave(m: any) {
    const token = getToken();
    if (!token) { alert("Lütfen önce giriş yap."); return; }

    try {
      const r = await fetch(`${API_URL}/matches/leave`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ matchId: m.id }),
      });
      const data = await r.json();
      if (!r.ok || !data?.ok) throw new Error(data?.message || "Ayrılma başarısız");
      refresh();
    } catch (e: any) {
      alert(e?.message || "Ayrılma başarısız");
    }
  }

  // admin kısa yollar
  async function backfillSlots() {
    try {
      const r = await fetch(`${API_URL}/matches/backfill-slots`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.message || "Backfill başarısız");
      alert(`Düzeltildi: ${d.updated}`); refresh();
    } catch (e: any) { alert(e?.message || "Backfill hata"); }
  }
  async function deleteOld() {
    try {
      const r = await fetch(`${API_URL}/matches/delete-old`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.message || "Silme başarısız");
      alert(`Silindi: ${d.deleted}`); refresh();
    } catch (e: any) { alert(e?.message || "Silme hata"); }
  }

  // filtrelenmiş liste
  const filtered = items.filter((m) => {
    if (hidePast && m.time) { try { if (new Date(m.time) < new Date()) return false; } catch {} }
    if (level  !== "Hepsi" && m.level  !== level)  return false;
    if (format !== "Hepsi" && m.format !== format) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-4xl p-4">
      {/* Üst bar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-neutral-950 hover:bg-emerald-500"
        >
          Maç Oluştur
        </button>
        <button onClick={refresh} className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700">Yenile</button>
        <button onClick={backfillSlots} className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700">Slot Düzelt (Admin)</button>
        <button onClick={deleteOld} className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700">Eski Maçları Sil (Admin)</button>

        <div className="ml-auto flex items-center gap-2 text-sm">
          <span>Seviye</span>
          <select value={level} onChange={(e)=>setLevel(e.target.value)} className="rounded bg-neutral-800 px-2 py-1">
            <option>Hepsi</option><option>Kolay</option><option>Orta</option><option>Zor</option>
          </select>
          <span>Format</span>
          <select value={format} onChange={(e)=>setFormat(e.target.value)} className="rounded bg-neutral-800 px-2 py-1">
            <option>Hepsi</option><option>5v5</option><option>7v7</option><option>8v8</option><option>11v11</option>
          </select>
          <label className="inline-flex items-center gap-1">
            <input type="checkbox" checked={hidePast} onChange={(e)=>setHidePast(e.target.checked)} />
            Geçmişi Gizle
          </label>
        </div>
      </div>

      {/* Maç oluştur formu (dosyada CreateMatchForm varsa göster) */}
      {showCreate && typeof CreateMatchForm === "function" && (
        <CreateMatchForm onCreated={() => { setShowCreate(false); refresh(); }} />
      )}

      {loading && <div className="text-sm text-neutral-400">Yükleniyor…</div>}
      {!loading && !filtered.length && <div className="text-sm text-neutral-400">Kayıt yok</div>}

      <div className="space-y-3">
        {filtered.map((m) => {
          const mine = myPos(m);
          const miss = missingOf(m);
          const prefHit = prefs.find((p) => miss.includes(p)); // tercihlerden boş var mı?

          return (
            <div key={m.id} className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold">{m.title || "Maç"}</div>
                  <div className="mt-1 text-xs text-neutral-300">
                    {m.location || "—"} • {m.level || "—"} • {m.format || "—"}
                    {m.time && <> • {new Date(m.time).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</>}
                  </div>
                  <div className="mt-1 text-xs">
                    {mine ? (
                      <span className="text-emerald-400">Katıldın • Pozisyonun: {mine}</span>
                    ) : miss.length ? (
                      prefHit ? (
                        <span className="text-emerald-400">Eksik: {miss.join(", ")}</span>
                      ) : (
                        <span className="text-amber-400">Tercih mevki yok</span>
                      )
                    ) : (
                      <span className="text-neutral-400">Pozisyonu: dolu</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!mine ? (
                    <button
                      onClick={() => joinQuick(m)}
                      disabled={joining === m.id || miss.length === 0 || !prefHit}
                      className="rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-medium text-neutral-950 hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {joining === m.id ? "Katılıyor…" : "Katıl"}
                    </button>
                  ) : (
                    <button
                      onClick={() => leave(m)}
                      className="rounded-xl bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
                    >
                      Ayrıl
                    </button>
                  )}

                  <a
                    href={`/match/${m.id}`}
                    className="rounded-xl bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
                  >
                    Detay
                  </a>
                </div>
              </div>
            </div>
          );
        })}
      </div>
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
  const [availability, setAvailability] = React.useState<Record<string, string[]>>({});

  // me geldiğinde forma doldur
  useEffect(() => {
    if (!me) return;
    setFoot((me.dominantFoot as any) || "N");
    setGeneralLevel(me.level ?? 5);
    setPrefs(Array.isArray(me.positions) ? me.positions : []);
    setPositionLevels(me.positionLevels ?? {});
    setAvailability(me.availability ?? {});
  }, [me]);

  async function save() {
    try {
      const r = await fetch(`${API_URL}/users/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
        body: JSON.stringify({
          dominantFoot: foot,
          level: generalLevel,
          positions: prefs,
          positionLevels,
          availability, // <-- YENİ
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      alert("Kaydedildi!");
      refresh?.();
    } catch (e: any) {
      alert("Kaydetme başarısız: " + e?.message);
    }
  }

  // Basit pozisyon seçimleri (mevcut kodundaki kısım)
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
      // max 3 tercih
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

        {/* Pozisyona göre seviye slider'ları (ilk 3 tercih için) */}
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {prefs.map((p) => (
            <div key={p} className="rounded-xl bg-neutral-800 p-3">
              <div className="mb-1 text-sm">
                {ALL_POSITIONS.find((x) => x.key === p)?.label} – Seviye
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={positionLevels[p] ?? 7}
                  onChange={(e) =>
                    setPositionLevels((prev) => ({ ...prev, [p]: parseInt(e.target.value) }))
                  }
                  className="w-full"
                />
                <div className="w-8 text-right">{positionLevels[p] ?? 7}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Müsaitlik seçimi */}
        <AvailabilityPicker value={availability} onChange={setAvailability} />

        <div className="mt-4">
          <button
            onClick={save}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-emerald-500"
          >
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}


/* ---------------------- Oyuncu ekranı ---------------------- */

function PlayerProfile() {
  const { me, loading, error, save } = useMe();

  const labelOf = (k: string) =>
    ({ GK:"Kaleci", LB:"Sol Bek", CB:"Stoper", RB:"Sağ Bek", LWB:"Sol Kanat Bek",
       RWB:"Sağ Kanat Bek", DM:"Ön Libero", CM:"Merkez", AM:"10 Numara",
       LW:"Sol Kanat", RW:"Sağ Kanat", ST:"Santrafor", STP:"Stoper" } as Record<string,string>)[k] || k;

  const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

  // 1) Hook'lar her zaman aynı sırada çağrılsın
  const [traits, setTraits] = React.useState({ punctual:4, respect:4, fairplay:4, swearing:2, aggressive:2 });
  const si = React.useMemo(() => computeSI(traits), [traits]);

  // Formasyon state'i en başta (her render'da) tanımlansın
  const [formation, setFormation] =
    React.useState<"4-2-3-1" | "4-3-3" | "3-5-2">( (me?.preferredFormation as any) || "4-2-3-1" );

  // Profilden pozisyonlar geldikçe formasyonu akıllıca öner
  React.useEffect(() => {
    const current = (me?.preferredFormation as any) || "4-2-3-1";
    setFormation(current);
  }, [me?.preferredFormation]);

  React.useEffect(() => {
    const arr: string[] = Array.isArray(me?.positions) ? me!.positions : [];
    const hasWingBack = arr.some((p) => p === "LWB" || p === "RWB");
    if (hasWingBack && formation !== "3-5-2") {
      setFormation("3-5-2");
    }
    // wingback yoksa kullanıcı seçimine karışmıyoruz
  }, [me?.positions]); // formation'a bağımlı yapma ki kullanıcı seçimini bozmayalım

  // 2) Erken return'ler bundan SONRA gelsin
  if (loading) return <div className="mx-auto max-w-4xl p-4">Yükleniyor…</div>;
  if (error)   return <div className="mx-auto max-w-4xl p-4 text-red-400">❌ {error}</div>;
  if (!me)     return null;

  const prefs: string[] = Array.isArray(me.positions) ? me.positions : [];
  const levels: Record<string, number> =
    me.positionLevels && typeof me.positionLevels === "object" ? me.positionLevels : {};
  const skillOf = (k: string) => clamp(levels[k] ?? 6, 1, 10);

  const slots = FORMATIONS[formation];

  return (
    <div className="mx-auto grid max-w-4xl gap-4">
      <section className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold">Kuşbakışı Saha & Tercihler</h3>
          <div className="flex gap-2">
            {(["4-2-3-1", "4-3-3", "3-5-2"] as const).map((f) => (
              <button
                key={f}
                onClick={async () => {
                  setFormation(f);
                  try {
                  } catch {
                  }
                }}
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

          {/* Sağ panel */}
          <div className="space-y-4">
            <div className="rounded-xl border border-white/10 p-3">
              <div className="text-sm text-neutral-300">Tercihlerim</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {prefs.length ? (
                  prefs.map((k: string, i: number) => (
                    <span key={k} className="rounded-full bg-emerald-500/20 px-3 py-1 text-sm text-emerald-300">
                      {i + 1}. {labelOf(k)} • {skillOf(k)}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-neutral-400">Profilde pozisyon seçiniz.</span>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 p-3">
              <div className="mb-2 text-sm text-neutral-300">Davranış Değerlendirmeleri (anonim, 1–5)</div>
              <TraitRow label="Dakiklik"   value={traits.punctual}  onChange={(v)=>setTraits({ ...traits, punctual:v })}/>
              <TraitRow label="Saygı"       value={traits.respect}   onChange={(v)=>setTraits({ ...traits, respect:v })}/>
              <TraitRow label="Sportmenlik" value={traits.fairplay}  onChange={(v)=>setTraits({ ...traits, fairplay:v })}/>
              <TraitRow label="Küfür"       value={traits.swearing}  onChange={(v)=>setTraits({ ...traits, swearing:v })} negative/>
              <TraitRow label="Agresiflik"  value={traits.aggressive}onChange={(v)=>setTraits({ ...traits, aggressive:v })} negative/>
              <div className="mt-3 flex items-center justify-between rounded-xl bg-neutral-800 p-3">
                <div>
                  <div className="text-xs text-neutral-400">Sportmenlik Katsayısı</div>
                  <div className="text-2xl font-semibold text-emerald-400">{si}</div>
                </div>
                <div className="h-2 w-40 overflow-hidden rounded bg-neutral-900">
                  <div className="h-full bg-emerald-500" style={{ width: `${si}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
        <h3 className="mb-2 text-base font-semibold">Açıklama</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-300">
          <li>Diziliş seçimi sahadaki mevkileri günceller (3-5-2'de <b>LWB/RWB</b> görünür).</li>
          <li>Tercihler rozetleri profilden gelir; seviyeler aynı şekilde yansır.</li>
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
      <span className="font-medium">{pos.key}</span>{" "}
      <span className="opacity-80">{skill}</span>
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
            <Star className="size-4" />
          </button>
        ))}
      </div>
    </div>
  );
}

function togglePref(prefs: PositionKey[], setPrefs: (v: PositionKey[]) => void, key: PositionKey) {
  if (prefs.includes(key)) {
    setPrefs(prefs.filter((k) => k !== key));
  } else {
    const next = [...prefs, key];
    if (next.length > 3) next.shift();
    setPrefs(next);
  }
}

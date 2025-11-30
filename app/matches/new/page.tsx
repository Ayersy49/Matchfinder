"use client";

import React from "react";
import { useRouter } from "next/navigation";
import PitchSelector from "@/components/PitchSelector";
import { MapPin, Star, CheckCircle } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function getToken() {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("token") ||
    localStorage.getItem("access_token") ||
    localStorage.getItem("jwt")
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

// Pitch tipi
type Pitch = {
  id: string;
  name: string;
  city: string;
  district?: string | null;
  address?: string | null;
  lat: number;
  lng: number;
  phone?: string | null;
  verificationLevel: number;
};

type CustomLocation = {
  lat: number;
  lng: number;
  label: string;
};

export default function NewMatchPage() {
  const r = useRouter();

  // ---- STATE ----
  const [inviteOnly, setInviteOnly] = React.useState<boolean>(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [title, setTitle] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [time, setTime] = React.useState(""); // datetime-local
  const [level, setLevel] = React.useState<"Kolay" | "Orta" | "Zor" | "">("");
  const [format, setFormat] = React.useState<
    "5v5" | "6v6" | "7v7" | "8v8" | "9v9" | "10v10" | "11v11" | ""
  >("");
  const [price, setPrice] = React.useState<number | "">("");

  // ---- PITCH STATES ----
  const [pitchSelectorOpen, setPitchSelectorOpen] = React.useState(false);
  const [selectedPitch, setSelectedPitch] = React.useState<Pitch | null>(null);
  const [customLocation, setCustomLocation] = React.useState<CustomLocation | null>(null);

  // Pitch seçildiğinde location alanını da güncelle
  const handlePitchSelect = (pitch: Pitch | null, custom?: CustomLocation) => {
    if (pitch) {
      setSelectedPitch(pitch);
      setCustomLocation(null);
      // location string olarak da güncelle (eski uyumluluk için)
      setLocation(`${pitch.name}, ${pitch.city}`);
    } else if (custom) {
      setCustomLocation(custom);
      setSelectedPitch(null);
      setLocation(custom.label);
    } else {
      setSelectedPitch(null);
      setCustomLocation(null);
    }
    setPitchSelectorOpen(false);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title || !time || !format) {
      setError("Başlık, tarih-saat ve format zorunludur.");
      return;
    }

    const body: any = {
      title,
      location: location || null,
      time: time ? new Date(time).toISOString() : null,
      level: level || null,
      format,
      price: price === "" ? null : Number(price),
      inviteOnly,
    };

    // Pitch bilgilerini ekle
    if (selectedPitch) {
      body.pitchId = selectedPitch.id;
    } else if (customLocation) {
      body.customLat = customLocation.lat;
      body.customLng = customLocation.lng;
      body.customLabel = customLocation.label;
    }

    try {
      setSubmitting(true);
      const res = await fetch(`${API_URL}/matches`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
        },
        body: JSON.stringify(body),
      });

      const data = await safeJson<{ id: string }>(res);
      if (!res.ok) throw new Error((data as any)?.message || `HTTP ${res.status}`);

      const newId = data?.id;
      if (newId) r.push(`/match/${newId}`);
      else setError("Oluşturuldu ancak id alınamadı.");
    } catch (e: any) {
      setError(e?.message || "Kayıt hatası");
    } finally {
      setSubmitting(false);
    }
  }

  // Verification badge
  const renderVerificationBadge = (level: number) => {
    if (level >= 3) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">
          <Star className="size-3" /> İşletme Sahası
        </span>
      );
    }
    if (level >= 2) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-300">
          <CheckCircle className="size-3" /> Topluluk Onaylı
        </span>
      );
    }
    return null;
  };

  return (
    <div className="mx-auto max-w-xl p-4">
      <h1 className="mb-3 text-2xl font-semibold">Maç Oluştur</h1>

      {error && (
        <div className="mb-3 rounded-xl border border-red-900 bg-red-950/30 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={submit} className="space-y-3 rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm">
            <span>Başlık*</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-xl bg-neutral-800 px-3 py-2 outline-none"
              placeholder="Örn. Perşembe Akşamı Kadıköy"
              required
            />
          </label>

          {/* ============ SAHA SEÇİCİ ============ */}
          <div className="grid gap-1 text-sm">
            <span>Saha / Konum</span>
            <button
              type="button"
              onClick={() => setPitchSelectorOpen(true)}
              className="flex items-center justify-between rounded-xl bg-neutral-800 px-3 py-2 text-left hover:bg-neutral-700 transition"
            >
              {selectedPitch ? (
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-emerald-400" />
                  <div>
                    <div className="font-medium">{selectedPitch.name}</div>
                    <div className="text-xs text-neutral-400">
                      {selectedPitch.district ? `${selectedPitch.district}, ` : ''}{selectedPitch.city}
                    </div>
                  </div>
                  {renderVerificationBadge(selectedPitch.verificationLevel)}
                </div>
              ) : customLocation ? (
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-amber-400" />
                  <div>
                    <div className="font-medium">{customLocation.label}</div>
                    <div className="text-xs text-amber-400/70">Özel Konum</div>
                  </div>
                </div>
              ) : (
                <span className="text-neutral-400">Saha seç veya konum gir...</span>
              )}
              <span className="text-neutral-500">▼</span>
            </button>

            {/* Seçilen sahayı temizle */}
            {(selectedPitch || customLocation) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedPitch(null);
                  setCustomLocation(null);
                  setLocation("");
                }}
                className="text-xs text-neutral-400 hover:text-white"
              >
                ✕ Seçimi temizle
              </button>
            )}
          </div>

          <label className="grid gap-1 text-sm">
            <span>Tarih & Saat*</span>
            <input
              type="datetime-local"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="rounded-xl bg-neutral-800 px-3 py-2 outline-none"
              required
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-sm">
              <span>Seviye</span>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as any)}
                className="rounded-xl bg-neutral-800 px-3 py-2 outline-none"
              >
                <option value="">Seç</option>
                <option value="Kolay">Kolay</option>
                <option value="Orta">Orta</option>
                <option value="Zor">Zor</option>
              </select>
            </label>

            <label className="grid gap-1 text-sm">
              <span>Format*</span>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as any)}
                className="rounded-xl bg-neutral-800 px-3 py-2 outline-none"
                required
              >
                <option value="">Seç</option>
                <option value="5v5">5v5</option>
                <option value="6v6">6v6</option>
                <option value="7v7">7v7</option>
                <option value="8v8">8v8</option>
                <option value="9v9">9v9</option>
                <option value="10v10">10v10</option>
                <option value="11v11">11v11</option>
              </select>
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={inviteOnly}
              onChange={(e) => setInviteOnly(e.target.checked)}
            />
            <span>Kilitli Maç (Sadece Davetle Katılım)</span>
          </label>

          <label className="grid gap-1 text-sm">
            <span>Kişi Başı Ücret (₺)</span>
            <input
              type="number"
              min={0}
              step={10}
              value={price}
              onChange={(e) => setPrice(e.target.value === "" ? "" : Number(e.target.value))}
              className="rounded-xl bg-neutral-800 px-3 py-2 outline-none"
              placeholder="Örn. 150"
            />
          </label>
        </div>

        <div className="flex items-center justify-between pt-2">
          <a href="/landing" className="rounded-xl px-3 py-2 text-sm hover:underline">
            ← Ana ekrana dön
          </a>
          <button
            disabled={submitting}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-emerald-500 disabled:opacity-60"
          >
            {submitting ? "Kaydediliyor…" : "Oluştur"}
          </button>
        </div>
      </form>

      {/* ============ PITCH SELECTOR MODAL ============ */}
      <PitchSelector
        open={pitchSelectorOpen}
        onClose={() => setPitchSelectorOpen(false)}
        onSelect={handlePitchSelect}
      />
    </div>
  );
}

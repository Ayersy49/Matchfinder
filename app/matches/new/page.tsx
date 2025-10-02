"use client";

import React from "react";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
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

export default function NewMatchPage() {
  const r = useRouter();
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [title, setTitle] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [time, setTime] = React.useState(""); // datetime-local
  const [level, setLevel] = React.useState<"Kolay" | "Orta" | "Zor" | "">("");
  const [format, setFormat] = React.useState<"5v5" | "7v7" | "8v8" | "11v11" | "">("");
  const [price, setPrice] = React.useState<number | "">("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!title || !time || !format) {
      setError("Başlık, tarih-saat ve format zorunludur.");
      return;
    }

    const body = {
      title,
      location: location || null,
      time: time ? new Date(time).toISOString() : null,
      level: level || null,
      format,
      price: price === "" ? null : Number(price),
    };

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
      if (!res.ok) {
        throw new Error((data as any)?.message || `HTTP ${res.status}`);
      }
      const newId = data?.id;
      if (newId) {
        r.push(`/match/${newId}`);
      } else {
        setError("Oluşturuldu ancak id alınamadı.");
      }
    } catch (e: any) {
      setError(e?.message || "Kayıt hatası");
    } finally {
      setSubmitting(false);
    }
  }

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

          <label className="grid gap-1 text-sm">
            <span>Konum</span>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="rounded-xl bg-neutral-800 px-3 py-2 outline-none"
              placeholder="Saha / İlçe"
            />
          </label>

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
                <option value="7v7">7v7</option>
                <option value="8v8">8v8</option>
                <option value="11v11">11v11</option>
              </select>
            </label>
          </div>

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
          <a
            href="/matches"
            className="rounded-xl px-3 py-2 text-sm hover:underline"
          >
            ← Listeye dön
          </a>
          <button
            disabled={submitting}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-emerald-500 disabled:opacity-60"
          >
            {submitting ? "Kaydediliyor…" : "Oluştur"}
          </button>
        </div>
      </form>
    </div>
  );
}

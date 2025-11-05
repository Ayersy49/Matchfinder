"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import FooterTabs from "@/components/FooterTabs";
import { authHeader } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const H = (): HeadersInit => (authHeader() as unknown as HeadersInit);

type SeriesDetail = {
  id: string;
  title: string | null;
  location: string | null;
  format: "5v5" | "6v6" | "7v7" | "8v8" | "9v9" | "10v10" | "11v11";
  price: number | null;
  dayOfWeek: number;
  timeHHmm: string;
  startDate: string;
  inviteOnly: boolean;
  reservesPerTeam: number | null;
  upcomingMatches: Array<{ id: string; time: string }>;
};

const DAY_OPTIONS = [
  { label: "Pazartesi", value: 1 },
  { label: "Salı", value: 2 },
  { label: "Çarşamba", value: 3 },
  { label: "Perşembe", value: 4 },
  { label: "Cuma", value: 5 },
  { label: "Cumartesi", value: 6 },
  { label: "Pazar", value: 7 },
];

export default function SeriesDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const seriesId = params?.id;

  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);
  const [detail, setDetail] = React.useState<SeriesDetail | null>(null);
  const [weeks, setWeeks] = React.useState(6);
  const [publishListed, setPublishListed] = React.useState(false);

  const [form, setForm] = React.useState({
    title: "",
    location: "",
    format: "7v7" as SeriesDetail["format"],
    price: "" as number | "",
    dayOfWeek: 6,
    timeHHmm: "22:00",
    startDate: new Date().toISOString().slice(0, 10),
    inviteOnly: true,
    reservesPerTeam: "" as number | "",
  });

  const load = React.useCallback(async () => {
    if (!seriesId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/series/${seriesId}`, {
        headers: { ...H() },
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.id) {
        throw new Error(data?.message || `Seri alınamadı (HTTP ${res.status})`);
      }
      const normalized: SeriesDetail = {
        id: String(data.id),
        title: data.title ?? null,
        location: data.location ?? null,
        format: data.format,
        price: data.price ?? null,
        dayOfWeek: data.dayOfWeek,
        timeHHmm: data.timeHHmm,
        startDate: data.startDate ?? new Date().toISOString().slice(0, 10),
        inviteOnly: Boolean(data.inviteOnly),
        reservesPerTeam: data.reservesPerTeam ?? null,
        upcomingMatches: Array.isArray(data.upcomingMatches)
          ? data.upcomingMatches.map((m: any) => ({
              id: String(m.id),
              time: m.time,
            }))
          : [],
      };
      setDetail(normalized);
      setForm({
        title: normalized.title ?? "",
        location: normalized.location ?? "",
        format: normalized.format,
        price: normalized.price ?? "",
        dayOfWeek: normalized.dayOfWeek,
        timeHHmm: normalized.timeHHmm,
        startDate: normalized.startDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
        inviteOnly: normalized.inviteOnly,
        reservesPerTeam: normalized.reservesPerTeam ?? "",
      });
    } catch (error: any) {
      alert(error?.message || "Seri getirilemedi");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [seriesId]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function saveSeries() {
    if (!detail) return;
    try {
      setSaving(true);
      const payload = {
        title: form.title.trim() || null,
        location: form.location.trim() || null,
        format: form.format,
        price: form.price === "" ? null : Number(form.price),
        dayOfWeek: form.dayOfWeek,
        timeHHmm: form.timeHHmm,
        startDate: form.startDate,
        inviteOnly: form.inviteOnly,
        reservesPerTeam: form.reservesPerTeam === "" ? null : Number(form.reservesPerTeam),
      };
      const res = await fetch(`${API_URL}/series/${detail.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...H() },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok !== true) {
        throw new Error(data?.message || `Seri güncellenemedi (HTTP ${res.status})`);
      }
      alert("Seri güncellendi");
      await load();
    } catch (error: any) {
      alert(error?.message || "Seri güncellenemedi");
    } finally {
      setSaving(false);
    }
  }

  async function generateWeeks() {
    if (!detail) return;
    try {
      setGenerating(true);
      const qs = new URLSearchParams({
        weeks: String(Math.max(1, Math.min(52, weeks))),
        listed: publishListed ? "1" : "0",
      });
      const res = await fetch(`${API_URL}/series/${detail.id}/generate?${qs.toString()}`, {
        method: "POST",
        headers: { ...H() },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok !== true) {
        throw new Error(data?.message || `Haftalar oluşturulamadı (HTTP ${res.status})`);
      }
      alert(`Haftalar oluşturuldu (${data.created ?? "?"} maç eklendi).`);
      await load();
    } catch (error: any) {
      alert(error?.message || "Haftalar oluşturulamadı");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <>
      <div className="mx-auto max-w-2xl p-4 pb-24 text-white space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push("/series")}
            className="rounded-xl bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
          >
            ← Listeye Dön
          </button>
          <h1 className="text-lg font-semibold">Seri Detayı</h1>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4 text-sm text-neutral-300">
            Seri yükleniyor…
          </div>
        ) : !detail ? (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-950/40 p-4 text-sm">
            Seri bulunamadı.
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  Başlık
                  <input
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    className="mt-1 w-full rounded-lg bg-neutral-800 px-3 py-2 outline-none ring-1 ring-white/10"
                  />
                </label>

                <label className="text-sm">
                  Lokasyon
                  <input
                    value={form.location}
                    onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                    className="mt-1 w-full rounded-lg bg-neutral-800 px-3 py-2 outline-none ring-1 ring-white/10"
                  />
                </label>

                <label className="text-sm">
                  Format
                  <select
                    value={form.format}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, format: e.target.value as SeriesDetail["format"] }))
                    }
                    className="mt-1 w-full rounded-lg bg-neutral-800 px-3 py-2 outline-none ring-1 ring-white/10"
                  >
                    {["5v5", "6v6", "7v7", "8v8", "9v9", "10v10", "11v11"].map((fmt) => (
                      <option key={fmt} value={fmt}>
                        {fmt}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm">
                  Ücret (₺)
                  <input
                    value={form.price}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        price: e.target.value === "" ? "" : Number(e.target.value),
                      }))
                    }
                    inputMode="numeric"
                    className="mt-1 w-full rounded-lg bg-neutral-800 px-3 py-2 outline-none ring-1 ring-white/10"
                  />
                </label>

                <label className="text-sm">
                  Hafta Günü
                  <select
                    value={form.dayOfWeek}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, dayOfWeek: Number(e.target.value) }))
                    }
                    className="mt-1 w-full rounded-lg bg-neutral-800 px-3 py-2 outline-none ring-1 ring-white/10"
                  >
                    {DAY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm">
                  Saat (HH:mm)
                  <input
                    value={form.timeHHmm}
                    onChange={(e) => setForm((prev) => ({ ...prev, timeHHmm: e.target.value }))}
                    className="mt-1 w-full rounded-lg bg-neutral-800 px-3 py-2 outline-none ring-1 ring-white/10"
                  />
                </label>

                <label className="text-sm">
                  Başlangıç
                  <input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
                    className="mt-1 w-full rounded-lg bg-neutral-800 px-3 py-2 outline-none ring-1 ring-white/10"
                  />
                </label>

                <label className="text-sm">
                  Takım başı SUB
                  <input
                    type="number"
                    min={0}
                    max={4}
                    value={form.reservesPerTeam}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        reservesPerTeam: e.target.value === "" ? "" : Number(e.target.value),
                      }))
                    }
                    className="mt-1 w-full rounded-lg bg-neutral-800 px-3 py-2 outline-none ring-1 ring-white/10"
                  />
                </label>

                <label className="text-sm flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.inviteOnly}
                    onChange={(e) => setForm((prev) => ({ ...prev, inviteOnly: e.target.checked }))}
                  />
                  Kilitli seri
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                <button
                  onClick={saveSeries}
                  disabled={saving}
                  className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-emerald-500 disabled:opacity-60"
                >
                  {saving ? "Kaydediliyor…" : "Seriyi Kaydet"}
                </button>

                <div className="ml-auto flex items-center gap-2">
                  <label className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={publishListed}
                      onChange={(e) => setPublishListed(e.target.checked)}
                    />
                    Üretilen maçları yayınla
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={52}
                    value={weeks}
                    onChange={(e) => setWeeks(Number(e.target.value || 1))}
                    className="w-20 rounded-lg border border-white/10 bg-neutral-900/60 px-2 py-1 text-sm"
                  />
                  <button
                    onClick={generateWeeks}
                    disabled={generating}
                    className="rounded-xl bg-neutral-800 px-3 py-2 text-sm hover:bg-neutral-700 disabled:opacity-50"
                  >
                    {generating ? "Üretiliyor…" : "Haftaları Oluştur"}
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
              <h2 className="text-sm font-semibold">Yaklaşan maçlar</h2>
              {!detail.upcomingMatches.length ? (
                <div className="mt-2 text-xs text-neutral-400">Henüz maç oluşturulmamış.</div>
              ) : (
                <ul className="mt-2 space-y-2 text-xs text-neutral-300">
                  {detail.upcomingMatches.map((match) => {
                    const date = match.time ? new Date(match.time) : null;
                    return (
                      <li key={match.id} className="flex items-center justify-between gap-2">
                        <span>{date ? date.toLocaleString() : "—"}</span>
                        <button
                          onClick={() => router.push(`/match/${match.id}`)}
                          className="rounded-xl bg-neutral-800 px-2 py-1 hover:bg-neutral-700"
                        >
                          Maç Detayı
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
      <FooterTabs />
    </>
  );
}
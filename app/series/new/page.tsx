/* app/series/new/page.tsx */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import FooterTabs from "@/components/FooterTabs";
import { authHeader } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
const H = (): HeadersInit => (authHeader() as unknown as HeadersInit);

export default function SeriesNewPage() {
  const router = useRouter();

  // form alanları (2. görseldeki gibi)
  const [title, setTitle] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [format, setFormat] = React.useState<"5v5"|"6v6"|"7v7"|"8v8"|"9v9"|"10v10"|"11v11">("7v7");
  const [price, setPrice] = React.useState<number | "">("");
  const [dayOfWeek, setDayOfWeek] = React.useState<number>(6); // 1=Pzt..7=Paz
  const [timeHHmm, setTimeHHmm] = React.useState("23:00");
  const [startDate, setStartDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [inviteOnly, setInviteOnly] = React.useState(true);
  const [reservesPerTeam, setReservesPerTeam] = React.useState<number | "">("");
  const [creating, setCreating] = React.useState(false);
  const [createdId, setCreatedId] = React.useState<string | null>(null);

  // senin istediğin iki kontrol:
  const [weeks, setWeeks] = React.useState<number>(6);
  const [publishToList, setPublishToList] = React.useState<boolean>(false); // “Genel listede yayınla”

  const DAYS = [
    { label: "Pazartesi", value: 1 },
    { label: "Salı", value: 2 },
    { label: "Çarşamba", value: 3 },
    { label: "Perşembe", value: 4 },
    { label: "Cuma", value: 5 },
    { label: "Cumartesi", value: 6 },
    { label: "Pazar", value: 7 },
  ];

  async function createSeries() {
    try {
      setCreating(true);
      const body = {
        title,
        location: location || null,
        format,
        price: price === "" ? null : Number(price),
        dayOfWeek,
        timeHHmm,
        tz: "Europe/Istanbul",
        startDate,             // “Bitiş” YOK — hafta sayısından türeteceğiz
        endDate: null,         // backend uyumluluğu için açıkça null gönderiyoruz
        inviteOnly,
        reservesPerTeam: reservesPerTeam === "" ? null : Number(reservesPerTeam),
      };

      const r = await fetch(`${API_URL}/series`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(H() as any) },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.message || `HTTP ${r.status}`);

      setCreatedId(String(j.id));
      alert("Seri oluşturuldu. Şimdi haftaları üretebilirsin.");
    } catch (e: any) {
      alert(e?.message || "Seri oluşturulamadı");
    } finally {
      setCreating(false);
    }
  }

  async function generateWeeks() {
    if (!createdId) {
      alert("Önce seriyi oluştur.");
      return;
    }
    try {
      const r = await fetch(
        `${API_URL}/series/${createdId}/generate?weeks=${weeks}&listed=${publishToList ? 1 : 0}`,
        { method: "POST", headers: { ...(H() as any) } }
      );
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.message || `HTTP ${r.status}`);
      alert(`Haftalar üretildi: ${j.created} maç eklendi.`);
      router.push("/series");
    } catch (e: any) {
      alert(e?.message || "Üretim başarısız");
    }
  }

  return (
    <>
      <div className="mx-auto max-w-2xl p-4 pb-24 text-white">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-xl font-semibold">Yeni Seri</h1>
          <button
            onClick={() => router.push("/series")}
            className="rounded-xl bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
          >
            ← Geri
          </button>
        </div>

        <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4 space-y-3">
          {/* ——— Form ——— */}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              Başlık
              <input value={title} onChange={(e)=>setTitle(e.target.value)}
                     className="mt-1 w-full rounded-lg bg-neutral-800 px-3 py-2 outline-none ring-1 ring-white/10"/>
            </label>

            <label className="text-sm">
              Lokasyon
              <input value={location} onChange={(e)=>setLocation(e.target.value)}
                     className="mt-1 w-full rounded-lg bg-neutral-800 px-3 py-2 outline-none ring-1 ring-white/10"/>
            </label>

            <label className="text-sm">
              Format
              <select value={format} onChange={(e)=>setFormat(e.target.value as any)}
                      className="mt-1 w-full rounded-lg bg-neutral-800 px-3 py-2 outline-none ring-1 ring-white/10">
                {["5v5","6v6","7v7","8v8","9v9","10v10","11v11"].map(f=>(
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              Ücret (₺)
              <input value={price}
                     onChange={(e)=>setPrice(e.target.value==="" ? "" : Number(e.target.value))}
                     inputMode="numeric"
                     className="mt-1 w-full rounded-lg bg-neutral-800 px-3 py-2 outline-none ring-1 ring-white/10"/>
            </label>

            <label className="text-sm">
              Hafta Günü
              <select value={dayOfWeek} onChange={(e)=>setDayOfWeek(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg bg-neutral-800 px-3 py-2 outline-none ring-1 ring-white/10">
                {DAYS.map(d=> <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </label>

            <label className="text-sm">
              Saat (HH:mm)
              <input value={timeHHmm} onChange={(e)=>setTimeHHmm(e.target.value)}
                     placeholder="21:00"
                     className="mt-1 w-full rounded-lg bg-neutral-800 px-3 py-2 outline-none ring-1 ring-white/10"/>
            </label>

            <label className="text-sm">
              Başlangıç
              <input type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)}
                     className="mt-1 w-full rounded-lg bg-neutral-800 px-3 py-2 outline-none ring-1 ring-white/10"/>
            </label>

            {/* BİTİŞ YOK */}

            <label className="text-sm">
              Takım başı SUB (ops.)
              <input type="number" min={0} max={4}
                     value={reservesPerTeam}
                     onChange={(e)=>setReservesPerTeam(e.target.value===""? "" : Number(e.target.value))}
                     className="mt-1 w-full rounded-lg bg-neutral-800 px-3 py-2 outline-none ring-1 ring-white/10"/>
            </label>

            <label className="text-sm flex items-center gap-2">
              <input type="checkbox" checked={inviteOnly} onChange={(e)=>setInviteOnly(e.target.checked)}/>
              Kilitli (sadece üyeler görsün)
            </label>

            <label className="text-sm flex items-center gap-2">
              <input type="checkbox" checked={publishToList} onChange={(e)=>setPublishToList(e.target.checked)}/>
              <span>Genel listede yayınla (paylaşımlı)</span>
            </label>
          </div>

          {/* Aksiyonlar */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              onClick={createSeries}
              disabled={creating}
              className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-emerald-500 disabled:opacity-60"
            >
              {creating ? "Oluşturuluyor…" : "Seri Oluştur"}
            </button>

            <button
              onClick={generateWeeks}
              disabled={!createdId}
              className="rounded-xl bg-neutral-800 px-3 py-2 text-sm hover:bg-neutral-700 disabled:opacity-50"
              title={createdId ? "" : "Önce seriyi oluştur"}
            >
              Haftaları üret ({weeks})
            </button>

            <input
              type="number" min={1} max={52}
              value={weeks}
              onChange={(e)=>setWeeks(Math.max(1, Math.min(52, Number(e.target.value || 1))))}
              className="w-20 rounded-lg border border-white/10 bg-neutral-900/60 px-2 py-1 text-sm"
              title="Kaç hafta üretilecek"
            />
          </div>

          {createdId && (
            <div className="text-xs text-neutral-400">
              Seri ID: <code className="select-all">{createdId}</code>
            </div>
          )}

          <div className="text-[11px] text-neutral-400 pt-1">
            Not: Üretilen maçlar “Maçlar” listesinde görünür. “Genel listede yayınla” açık ise
            herkese; kapalı ise sadece seri sahibi/üyeler (ve erişim verilenler) görür.
          </div>
        </div>
      </div>

      <FooterTabs active="series" />
    </>
  );
}

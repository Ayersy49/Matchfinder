'use client';

import * as React from 'react';
import { authHeader } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

type MetricKey = 'punctuality' | 'respect' | 'fairplay' | 'profanity' | 'aggression';
type MetricRow = { key: MetricKey; label: string; negative?: boolean };

const ROWS: MetricRow[] = [
  { key: 'punctuality', label: 'Dakiklik' },
  { key: 'respect',     label: 'Saygı' },
  { key: 'fairplay',    label: 'Sportmenlik' },
  { key: 'profanity',   label: 'Küfür',       negative: true },  // düşük iyi
  { key: 'aggression',  label: 'Agresiflik',  negative: true },  // düşük iyi
];

// 1..5 → renk (tek yıldız rengi)
function starTone(v: number, negative?: boolean) {
  const x = v || 0;
  // not: "negative" satırlarda puan yüksek = kötü; görselde yine kırmızıya kayacak
  if (x <= 1.5) return negative ? 'text-sky-300' : 'text-rose-300';
  if (x <= 2.5) return negative ? 'text-emerald-300' : 'text-amber-300';
  if (x <= 4.0) return negative ? 'text-amber-300' : 'text-emerald-300';
  return negative ? 'text-rose-300' : 'text-sky-300';
}

// 5 metrik → 0..100 (negatiflerde ters çevirip ağırlıklı ortalama)
function toScore100(values: Record<MetricKey, number>, weights?: Partial<Record<MetricKey, number>>) {
  const W: Record<MetricKey, number> = {
    punctuality: 0.2,
    respect:     0.2,
    fairplay:    0.3,
    profanity:   0.15,
    aggression:  0.15,
    ...weights,
  };
  let acc = 0;
  let ws  = 0;
  for (const r of ROWS) {
    const raw = values[r.key] || 0;                 // 1..5
    const pos = r.negative ? (6 - raw) : raw;       // 1..5, yüksek iyi
    const norm = Math.max(0, Math.min(pos / 5, 1)); // 0..1
    acc += norm * (W[r.key] ?? 0);
    ws  += (W[r.key] ?? 0);
  }
  const pct = ws ? (acc / ws) * 100 : 0;
  return Math.round(pct);
}

function barTone(score: number) {
  if (score >= 90) return 'bg-sky-600';
  if (score >= 60) return 'bg-emerald-600';
  if (score >= 40) return 'bg-amber-600';
  return 'bg-rose-600';
}

export default function BehaviorRatings({
  targetUserId,
  defaultValues,
  matchId,
}: {
  /** Kimi değerlendiriyoruz? (kendi sayfanda myId verirsin) */
  targetUserId: string;
  /** İstersen mevcut ortalamayı/öneriyi başlangıca bas (1..5). */
  defaultValues?: Partial<Record<MetricKey, number>>;
  /** Maç sonrası rating ise matchId ile gönder (tek oy/24h kuralları backend’de). */
  matchId?: string;
}) {
  const [vals, setVals] = React.useState<Record<MetricKey, number>>({
    punctuality: defaultValues?.punctuality ?? 0,
    respect:     defaultValues?.respect ?? 0,
    fairplay:    defaultValues?.fairplay ?? 0,
    profanity:   defaultValues?.profanity ?? 0,
    aggression:  defaultValues?.aggression ?? 0,
  });

  const score = toScore100(vals);

  async function save() {
    try {
      const r = await fetch(`${API_URL}/ratings/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({
          targetUserId,
          matchId: matchId ?? null,
          metrics: vals, // {punctuality:1..5,...}
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.ok === false) throw new Error(j?.message || `HTTP ${r.status}`);
      alert('Değerlendirmen kaydedildi. Teşekkürler!');
    } catch (e: any) {
      // API henüz hazır değilse bile kullanıcıyı bloklamayalım
      alert(e?.message || 'Kaydedilemedi. (API hazır mı?)');
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
      <div className="mb-2 text-sm font-semibold">Davranış Değerlendirmeleri (anonim, 1–5)</div>

      <div className="space-y-3">
        {ROWS.map((r) => (
          <div key={r.key} className="flex items-center justify-between gap-3">
            <div className="text-sm text-neutral-200">{r.label}</div>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => {
                const active = vals[r.key] >= n;
                const tone = starTone(vals[r.key], r.negative);
                return (
                  <button
                    key={n}
                    onClick={() => setVals((v) => ({ ...v, [r.key]: n }))}
                    className={`h-7 w-7 rounded-md ring-1 ring-white/10 ${active ? 'bg-neutral-800' : 'bg-neutral-900'} hover:bg-neutral-800`}
                    title={`${n} yıldız`}
                  >
                    <span className={`block text-center text-sm leading-7 ${tone}`}>★</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl bg-neutral-800 p-3">
        <div className="mb-1 text-xs text-neutral-300">Sportmenlik Katsayısı</div>
        <div className="flex items-center gap-3">
          <div className="w-10 text-lg font-semibold text-neutral-100">{score}</div>
          <div className="h-2 flex-1 rounded bg-neutral-700">
            <div className={`h-2 rounded ${barTone(score)}`} style={{ width: `${score}%` }} />
          </div>
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          onClick={save}
          className="rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-medium text-neutral-950 hover:bg-emerald-500"
        >
          Kaydet
        </button>
      </div>
    </div>
  );
}

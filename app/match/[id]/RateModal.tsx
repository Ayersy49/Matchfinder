"use client";
import React from "react";

type Slot = { userId?: string|null; pos?: string; placeholder?: 'ADMIN'|'GUEST'|null; team?: 'A'|'B' };
type Player = { id: string; phone?: string|null };
type TraitKeys = 'punctuality'|'respect'|'sports'|'swearing'|'aggression';

export default function RateModal({
  open, onClose, matchId, meId,
  slots, players, matchTimeISO, API_URL, token
}: {
  open: boolean;
  onClose: () => void;
  matchId: string;
  meId: string;
  slots: Slot[];
  players: Player[];
  matchTimeISO?: string|null;
  API_URL: string;
  token: string;
}) {
  if (!open) return null;

  const now = Date.now();
  const locked = (() => {
    if (!matchTimeISO) return false;
    const t = new Date(matchTimeISO).getTime();
    return now > t + 24*60*60*1000;
  })();

  // match participants (no placeholders)
  const mapPlayed = new Map<string, string>();
  slots.forEach(s => {
    if (s.userId && !s.placeholder) mapPlayed.set(s.userId, (s.pos||'').toUpperCase());
  });

  const others = players.filter(p => p.id !== meId && mapPlayed.has(p.id));

  const [vals, setVals] = React.useState(() =>
    others.map(p => ({
      rateeId: p.id,
      pos: mapPlayed.get(p.id)!,
      posScore: 7,
      traits: { punctuality:3, respect:3, sports:3, swearing:3, aggression:3 }
    }))
  );

  const setTrait = (i: number, k: TraitKeys, v: number) => {
    setVals(prev => {
      const next = [...prev];
      next[i] = { ...next[i], traits: { ...next[i].traits, [k]: v } };
      return next;
    });
  };
  const setPosScore = (i: number, v: number) => {
    setVals(prev => { const next=[...prev]; next[i] = { ...next[i], posScore: v }; return next; });
  };

  async function submit() {
    if (locked) { alert("Değerlendirme penceresi kapandı (24s)."); return; }
    try {
      const r = await fetch(`${API_URL}/ratings/${matchId}/submit`, {
        method: "POST",
        headers: { "Content-Type":"application/json", Authorization:`Bearer ${token}` },
        body: JSON.stringify({ items: vals }),
      });
      const j = await r.json().catch(()=> ({}));
      if (r.status === 403 && j?.message === 'window_closed') { alert("Pencere kapandı."); return; }
      if (!r.ok || j?.ok !== true) throw new Error(j?.message || `HTTP ${r.status}`);
      onClose();
      alert("Teşekkürler! Değerlendirmen kaydedildi.");
    } catch (e:any) {
      alert(e?.message || "Gönderim hatası");
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
      <div className="w-full max-w-3xl rounded-lg bg-neutral-900 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Değerlendir</h3>
          <button onClick={onClose} className="text-sm opacity-80 hover:opacity-100">Kapat</button>
        </div>

        {locked ? (
          <div className="mb-3 text-amber-400 text-sm">
            Bu maç için değerlendirme penceresi kapandı (24 saat).
          </div>
        ) : null}

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {others.map((p, i) => (
            <div key={p.id} className="rounded border border-white/10 p-3">
              <div className="mb-2 text-sm opacity-80">
                Oyuncu: <b>{p.phone ?? p.id.slice(0,6)+'…'}</b> — Pozisyon: <b>{vals[i].pos}</b>
              </div>

              <div className="grid grid-cols-5 gap-3">
                {(['punctuality','respect','sports','swearing','aggression'] as TraitKeys[]).map(k => (
                  <label key={k} className="text-xs flex flex-col gap-1">
                    <span className="capitalize">{k}</span>
                    <input type="range" min={1} max={5} value={(vals[i].traits as any)[k]}
                      onChange={e => setTrait(i, k, Number(e.target.value))} />
                    <span className="opacity-70">{(vals[i].traits as any)[k]}</span>
                  </label>
                ))}
              </div>

              <div className="mt-3">
                <label className="text-xs flex flex-col gap-1">
                  <span>Pozisyon puanı (1–10)</span>
                  <input type="range" min={1} max={10} value={vals[i].posScore}
                    onChange={e => setPosScore(i, Number(e.target.value))} />
                  <span className="opacity-70">{vals[i].posScore}</span>
                </label>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded px-3 py-2 bg-neutral-700" onClick={onClose}>Vazgeç</button>
          <button className="rounded px-3 py-2 bg-emerald-600" onClick={submit} disabled={locked}>Gönder</button>
        </div>
      </div>
    </div>
  );
}

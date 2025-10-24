/* app/profil/page.tsx */
'use client';

import * as React from 'react';
import { useMe } from '@/lib/useMe';
import AvailabilityEditor from './AvailabilityEditor';
import FooterTabs from '@/components/FooterTabs';
import { authHeader } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';


type PosCode = 'GK' | 'LB' | 'CB' | 'RB' | 'LWB' | 'RWB' | 'DM' | 'CM' | 'AM' | 'LW' | 'RW' | 'ST';
const POS: { code: PosCode; label: string }[] = [
  { code: 'GK',  label: 'Kaleci' },
  { code: 'LB',  label: 'Sol Bek' },
  { code: 'CB',  label: 'Stoper' },
  { code: 'RB',  label: 'Sağ Bek' },
  { code: 'DM',  label: 'Ön Libero' },
  { code: 'CM',  label: 'Merkez' },
  { code: 'AM',  label: '10 Numara' },
  { code: 'LW',  label: 'Sol Kanat' },
  { code: 'RW',  label: 'Sağ Kanat' },
  { code: 'ST',  label: 'Santrafor' },
  { code: 'LWB', label: 'Sol Kanat Bek' },
  { code: 'RWB', label: 'Sağ Kanat Bek' },
];
const FEET = ['Sol', 'Sağ', 'Çift'] as const;
type Foot = typeof FEET[number];

export default function ProfilPage() {
  const { me, loading, error } = useMe();

  // Hook'lar her zaman en üstte:
  const [level, setLevel] = React.useState<number>(5);
  const [dominantFoot, setDominantFoot] = React.useState<Foot>('Sağ');
  const [positions, setPositions] = React.useState<PosCode[]>([]);
  const [posLevels, setPosLevels] = React.useState<Record<string, number>>({});
  const [lockedPositions, setLockedPositions] = React.useState<Set<string>>(new Set());


  // me geldiğinde formu doldur
  React.useEffect(() => {
    if (!me) return;
    setLevel(Number(me.level ?? 5));
    const footMapRev: Record<'L'|'R'|'B'|'N', Foot> = { L: 'Sol', R: 'Sağ', B: 'Çift', N: 'Sağ' };
    setDominantFoot(footMapRev[(me.dominantFoot as 'L'|'R'|'B'|'N') ?? 'N']);
    setPositions(Array.isArray(me.positions) ? (me.positions as PosCode[]).slice(0, 3) : []);
    // server'dan gelen me.positionLevels (UPPERCASE key'lerle geldi)
    if (me.positionLevels && typeof me.positionLevels === 'object') {
      setPosLevels(me.positionLevels as Record<string, number>);
    }

    // dış değerlendirme almış (kilitli) mevkiler
    setLockedPositions(new Set((me.posLocked || []).map((p: string) => p.toUpperCase())));
  }, [me]);

  function togglePos(code: PosCode) {
    setPositions((prev) => {
      if (prev.includes(code)) return prev.filter((p) => p !== code);
      const next = [...prev, code];
      if (next.length > 3) next.shift();
      return next;
    });
  }

  async function saveProfile() {
    try {
      // dominantFoot map
      const footMap: Record<Foot, 'L'|'R'|'B'> = { 'Sol': 'L', 'Sağ': 'R', 'Çift': 'B' };

      // yalnızca seçili ilk 3 mevkiyi gönder; diğerleri optional
      const send: any = {
        level,
        dominantFoot: footMap[dominantFoot],
        positions,               // ['LW','RW','ST'] gibi
        positionLevels: posLevels, // backend kilitli mevkileri zaten yok sayıyor
      };

      const r = await fetch(`${API_URL}/users/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(authHeader() as any) },
        body: JSON.stringify(send),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.message || `HTTP ${r.status}`);
      alert('Kaydedildi.');
    } catch (e: any) {
      alert(e?.message || 'Kaydetme hatası');
    }
  }

  if (loading) return <div className="p-4">Yükleniyor…</div>;
  if (error)   return <div className="p-4">❌ {error}</div>;

  if (!me) {
    return (
      <div className="p-4 pb-20">
        Giriş yapmanız gerekiyor.
        <FooterTabs active="profile" />
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-4xl p-4 pb-20 text-white">
        {/* Kişisel Bilgiler */}
        <section className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Kişisel Bilgiler</h2>
            <button
              onClick={saveProfile}
              className="rounded-xl bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
            >
              Kaydet
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Baskın ayak */}
            <div>
              <div className="mb-1 text-sm text-neutral-300">Baskın Ayak</div>
              <div className="flex gap-2">
                {FEET.map((f) => (
                  <button
                    key={f}
                    onClick={() => setDominantFoot(f)}
                    className={`rounded-xl px-3 py-1.5 text-sm ${
                      dominantFoot === f
                        ? 'bg-emerald-600 text-neutral-950'
                        : 'bg-neutral-800 hover:bg-neutral-700'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Seviye */}
            <div>
              <div className="mb-1 flex items-center justify-between text-sm text-neutral-300">
                <span>Genel Seviye (1–10)</span>
                <span className="ml-2 rounded bg-neutral-800 px-2 py-0.5 text-xs">{level}</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                value={level}
                onChange={(e) => setLevel(Number(e.target.value))}
                className="w-full"
              />
            </div>
          </div>

          {/* Pozisyonlar */}
          <div className="mt-4">
            <div className="mb-1 text-sm text-neutral-300">Tercih Pozisyonlarım (3)</div>
            <div className="flex flex-wrap gap-2">
              {POS.map((p) => {
                const on = positions.includes(p.code);
                return (
                  <button
                    key={p.code}
                    onClick={() => togglePos(p.code)}
                    className={`rounded-2xl px-3 py-1.5 text-sm ${
                      on ? 'bg-emerald-500 text-neutral-950' : 'bg-neutral-800 hover:bg-neutral-700'
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Pozisyon seviyeleri (yalnızca seçili ilk 3 mevki için) */}
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {positions.slice(0,3).map((P) => {
              const posDef = POS.find(x => x.code === P);
              const label = posDef ? posDef.label : P;
              const isLocked = lockedPositions.has(P);
              const val = Number(posLevels[P] ?? level); // değer yoksa genel seviyeyi göster
              return (
                <div key={P} className="rounded-xl border border-white/10 p-3">
                  <div className="mb-1 flex items-center justify-between text-sm text-neutral-300">
                    <span>{label}</span>
                    <span className={`ml-2 rounded px-2 py-0.5 text-xs ${isLocked ? 'bg-neutral-700' : 'bg-neutral-800'}`}>
                      {isLocked ? 'Kilitli' : val}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={val}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setPosLevels(prev => ({ ...prev, [P]: n }));
                    }}
                    disabled={isLocked}
                    title={isLocked ? 'Bu mevki dış değerlendirme aldığı için kilitli' : undefined}
                    className={`w-full ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                  />
                </div>
              );
            })}
          </div>
        </section>

        {/* Müsaitlik */}
        <section className="mt-4 rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Müsaitlik</h2>
            <button className="rounded-xl bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700">
              Kaydet
            </button>
          </div>
          <AvailabilityEditor />
        </section>
      </div>

      <FooterTabs active="profile" />
    </>
  );
}

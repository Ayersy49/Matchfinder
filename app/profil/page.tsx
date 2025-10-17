'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, UserRound, Shield, LogIn, Star, Footprints } from 'lucide-react';
import AvailabilityEditor from './AvailabilityEditor';

/* =========================
   Arkaplan görselleri (demo)
   ========================= */
const STADIUMS = [
  'https://images.unsplash.com/photo-1530541930197-ff16ac917b0e?q=80&w=1600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1486286701208-1d58e9338013?q=80&w=1600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?q=80&w=1600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1522770179533-24471fcdba45?q=80&w=1600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1522771930-78848d9293e8?q=80&w=1600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?q=80&w=1600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1471295253337-3ceaaedca402?q=80&w=1600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1547347298-4074fc3086f0?q=80&w=1600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1486286701208-1d58e9338013?q=80&w=1600&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=1600&auto=format&fit=crop',
];

/* =========================
   Oyuncu sahası (demo)
   ========================= */
const POSITIONS = [
  { key: 'GK', label: 'Kaleci', x: 5, y: 50 },
  { key: 'SB', label: 'Sol Bek', x: 20, y: 20 },
  { key: 'STP', label: 'Stoper', x: 20, y: 50 },
  { key: 'RB', label: 'Sağ Bek', x: 20, y: 80 },
  { key: 'DM', label: 'DM', x: 40, y: 50 },
  { key: 'LW', label: 'Sol Kanat', x: 55, y: 20 },
  { key: 'CM', label: 'CM', x: 55, y: 50 },
  { key: 'RW', label: 'Sağ Kanat', x: 55, y: 80 },
  { key: 'AM', label: 'AM', x: 72, y: 50 },
  { key: 'ST', label: 'Santrafor', x: 88, y: 50 },
] as const;

type PositionKey = (typeof POSITIONS)[number]['key'];

type Traits = {
  punctual: number;
  respect: number;
  fairplay: number;
  swearing: number;
  aggressive: number;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function computeSI(t: Traits) {
  const norm = (v: number) => (clamp(v, 1, 5) - 1) / 4;
  const P = (norm(t.punctual) + norm(t.respect) + norm(t.fairplay)) / 3;
  const Nminus = (1 - norm(t.swearing) + 1 - norm(t.aggressive)) / 2;
  return Math.round(100 * (0.6 * P + 0.4 * Nminus));
}

/* =========================
   Ana sayfa
   ========================= */
export default function Page() {
  const [authed, setAuthed] = useState(false);
  const [activeTab, setActiveTab] = useState<'matches' | 'profile' | 'player'>('matches');

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

/* =========================
   Login (OTP demo)
   ========================= */
function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % STADIUMS.length), 4500);
    return () => clearInterval(id);
  }, []);

  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const normalizePhone = (s: string) => s.replace(/\D/g, '');
  const normalizeCode = (s: string) => s.replace(/\D/g, '').slice(0, 6);

  async function requestOtp() {
    try {
      const r = await fetch('http://localhost:4000/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalizePhone(phone) }),
      });
      const data = await r.json().catch(() => ({}));
      if ((data as any).devCode) alert('DEV OTP: ' + (data as any).devCode);
    } catch {
      alert('OTP isteği başarısız');
    }
  }

  async function verifyOtp() {
    try {
      const r = await fetch('http://localhost:4000/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: normalizePhone(phone),
          code: normalizeCode(code),
        }),
      });
      const data = await r.json().catch(() => ({}));
      if ((data as any).ok && (data as any).accessToken) {
        localStorage.setItem('token', (data as any).accessToken);
        onSuccess();
      } else {
        alert('Kod hatalı veya süresi doldu');
      }
    } catch {
      alert('Giriş sırasında hata oluştu');
    }
  }

  return (
    <div className="relative min-h-dvh overflow-hidden">
      {/* arkaplan */}
      <div className="absolute inset-0">
        {STADIUMS.map((src, i) => (
          <img
            key={i}
            src={src}
            alt="stadium"
            className={`absolute inset-0 size-full object-cover transition-opacity duration-1000 ${
              i === idx ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ))}
        <div className="absolute inset-0 bg-black/70" />
      </div>

      {/* içerik */}
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
              Giriş ile <a className="underline">KVKK Aydınlatma</a> ve{' '}
              <a className="underline">Kullanım Koşulları</a>nı kabul edersiniz.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =========================
   Uygulama iskeleti + alt bar
   ========================= */
function MainShell({
  activeTab,
  onTab,
}: {
  activeTab: 'matches' | 'profile' | 'player';
  onTab: (t: any) => void;
}) {
  const router = useRouter();

  return (
    <div className="relative min-h-dvh pb-24">
      <header className="sticky top-0 z-20 flex items-center justify-between bg-neutral-950/80 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-neutral-950/60">
        <div className="text-lg font-semibold">MatchFinder</div>
        <div className="text-xs text-neutral-400">MVP Demo</div>
      </header>

      <main className="px-4 py-4">
        {activeTab === 'matches' && <MatchesList />}
        {/* Profil sekmesi artık ayrı sayfaya gider; burada içerik yok */}
        {activeTab === 'player' && <PlayerProfile />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-neutral-950/80 backdrop-blur supports-[backdrop-filter]:bg-neutral-950/60">
        <div className="mx-auto flex max-w-md items-stretch justify-around py-2">
          <TabButton
            icon={<CalendarDays className="size-5" />}
            label="Maçlar"
            active={activeTab === 'matches'}
            onClick={() => onTab('matches')}
          />
          <TabButton
            icon={<UserRound className="size-5" />}
            label="Profil"
            active={false}
            onClick={() => router.push('/profil')}
          />
          <TabButton
            icon={<Shield className="size-5" />}
            label="Oyuncu"
            active={activeTab === 'player'}
            onClick={() => onTab('player')}
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
        active ? 'text-emerald-400' : 'text-neutral-300 hover:text-white'
      }`}
    >
      {icon}
      <span className="mt-1 text-xs">{label}</span>
    </button>
  );
}

/* =========================
   Maç listesi (mock)
   ========================= */
function MatchesList() {
  const matches = [
    { id: 1, title: 'Beşiktaş - Halısaha', when: 'Çar 21:00', need: 'LW, RB', dist: '3.2 km', level: '6–8' },
    { id: 2, title: 'Kadıköy - Çetin Emeç', when: 'Per 20:30', need: 'ST, DM', dist: '5.0 km', level: '5–7' },
    { id: 3, title: 'Mecidiyeköy - Likör', when: 'Cum 22:15', need: 'GK', dist: '4.1 km', level: '7–9' },
  ];
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <h2 className="mb-2 text-lg font-semibold">Bu Hafta Açık Katılım</h2>
      {matches.map((m) => (
        <div key={m.id} className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">{m.title}</div>
              <div className="text-xs text-neutral-400">
                {m.when} • {m.dist} • Seviye {m.level}
              </div>
            </div>
            <div className="text-xs text-emerald-400">Eksik: {m.need}</div>
          </div>
          <div className="mt-3 flex gap-2">
            <button className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-emerald-400">
              Katıl
            </button>
            <button className="rounded-2xl border border-white/10 px-3 py-2 text-sm hover:bg-white/5">Detay</button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* =========================
   Oyuncu ekranı (demo)
   ========================= */
function PlayerProfile() {
  const [prefs, setPrefs] = useState<PositionKey[]>(['LW', 'CM', 'RB']);
  const [skills, setSkills] = useState<Record<PositionKey, number>>({
    GK: 5,
    SB: 6,
    STP: 6,
    RB: 7,
    DM: 6,
    LW: 8,
    CM: 7,
    RW: 6,
    AM: 7,
    ST: 6,
  });
  const [traits, setTraits] = useState<Traits>({
    punctual: 4,
    respect: 4,
    fairplay: 4,
    swearing: 2,
    aggressive: 2,
  });

  const si = useMemo(() => computeSI(traits), [traits]);

  return (
    <div className="mx-auto grid max-w-4xl gap-4">
      <section className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
        <h3 className="mb-3 text-base font-semibold">Kuşbakışı Saha & Tercihler</h3>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-green-800">
            <Pitch />
            {POSITIONS.map((p) => (
              <PositionBadge
                key={p.key}
                pos={p}
                prefIndex={prefs.indexOf(p.key)}
                skill={skills[p.key]}
                onClick={() => togglePref(prefs, setPrefs, p.key)}
              />
            ))}
          </div>
          <div className="space-y-4">
            {/* ... (mevcut içerik) ... */}
          </div>
        </div>
      </section>

      {/* ---------- MÜSAİTLİKLER (Availability) ---------- */}
      <section className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
        <h3 className="mb-3 text-base font-semibold">Müsaitliklerim</h3>
        <p className="mb-3 text-sm text-neutral-300">
          Gün ve saat aralıklarını ekleyin. (Aynı güne birden fazla aralık ekleyebilirsiniz.)
        </p>

        {/* Asıl editor */}
        <AvailabilityEditor />

        {/* İsteğe bağlı açıklama */}
        <div className="mt-4">
          <h4 className="mb-1 text-sm font-semibold">Açıklama</h4>
          <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-300">
            <li>Her gün için birden fazla saat aralığı ekleyebilirsiniz.</li>
            <li>Kaydet’e bastığınızda bilgileriniz sunucuya yazılır.</li>
          </ul>
        </div>
      </section>
    </div>
  );
}

/* =========================
   Yardımcı bileşenler
   ========================= */
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
        active ? 'bg-emerald-500 text-neutral-950' : 'bg-black/60 text-white'
      }`}
      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
      title={`${pos.label} • Seviye ${skill}`}
    >
      <span className="font-medium">{pos.key}</span>{' '}
      <span className="opacity-80">{skill}</span>
      {active && <span className="ml-1 rounded bg-neutral-900/30 px-1">{prefIndex + 1}</span>}
    </button>
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

// app/discover/page.tsx
'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function getToken() {
  try {
    return (
      localStorage.getItem('token') ||
      localStorage.getItem('access_token') ||
      localStorage.getItem('jwt') ||
      ''
    );
  } catch {
    return '';
  }
}

type Player = {
  id: string;
  phone: string | null;
  level: number | null;
  positions: string[] | null;
  lat: number | null;
  lng: number | null;
  distanceKm: number;
};

export default function DiscoverPage() {
  // URL’den matchId oku (opsiyonel)
  const params = useSearchParams();
  const presetMatchId = params.get('matchId') ?? undefined;

  const [lat, setLat] = React.useState<number | null>(null);
  const [lng, setLng] = React.useState<number | null>(null);
  const [radius, setRadius] = React.useState(10);
  const [loading, setLoading] = React.useState(false);
  const [items, setItems] = React.useState<Player[]>([]);
  const [discoverable, setDiscoverable] = React.useState(true);
  const [level, setLevel] = React.useState<number | ''>('');   // 1..10 veya boş
  const POSITIONS = ['GK','LB','CB','RB','DM','CM','AM','LW','RW','ST'] as const;
  const [selectedPositions, setSelectedPositions] = React.useState<string[]>([]);

  async function toggleDiscoverable() {
    try {
      const r = await fetch(`${API_URL}/me/discoverable`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ value: !discoverable }), // <-- burada !discoverable
      });
      if (!r.ok) {
        const t = await r.text().catch(() => '');
        console.error('discoverable error', r.status, t);
        throw new Error();
      }
      setDiscoverable(v => !v); // lokal state’i çevir
    } catch {
      alert('Keşifte görünürlük güncellenemedi.');
    }
  }
  // Konumu al ve sunucuya yaz
  React.useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const la = pos.coords.latitude;
        const ln = pos.coords.longitude;
        setLat(la);
        setLng(ln);
        try {
          await fetch(`${API_URL}/me/location`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${getToken()}`,
            },
            body: JSON.stringify({ lat: la, lng: ln }),
          });
          await fetch(`${API_URL}/me/discoverable`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${getToken()}`,
            },
            body: JSON.stringify({ value: true }),
          });
          setDiscoverable(true);
        } catch {}
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (lat != null && lng != null) {
        qs.set('lat', String(lat));
        qs.set('lng', String(lng));
      }
      qs.set('radiusKm', String(radius));
      if (level !== '') qs.set('level', String(level));
      if (selectedPositions.length) qs.set('positions', selectedPositions.join(','));
  
      const r = await fetch(`${API_URL}/players/discover?${qs}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
        cache: 'no-store',
      });
      const data = await r.json();
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      console.error(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [lat, lng, radius]);

  React.useEffect(() => {
    load();
  }, [load]);

  // Davet: URL’de matchId varsa prompt sormaz
  async function inviteToMatch(userId: string) {
    const matchId =
      presetMatchId ??
      window.prompt("Hangi maçın id’sine davet edeceksin? (Match detail üstündeki ID)");
    if (!matchId) return;

    const note = window.prompt('Not (opsiyonel)');
    try {
      const r = await fetch(`${API_URL}/matches/${matchId}/invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ toUserId: userId, message: note || undefined }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data?.ok) throw new Error(data?.message || 'Davet gönderilemedi');
      alert('Davet gönderildi');
    } catch (e: any) {
      alert(e?.message || 'Davet gönderilemedi');
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      {/* Üst bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/landing"
            className="inline-flex items-center gap-2 rounded-lg bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
          >
            ← Ana menü
          </Link>
          <h1 className="text-xl font-semibold">Yakındaki oyuncular</h1>
          {presetMatchId && (
            <span className="text-xs text-neutral-400">
              (Davetler <span className="font-mono">{presetMatchId}</span> için)
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-400">Keşifte görün</span>
            <button
              onClick={toggleDiscoverable}
              className={`rounded-md px-2 py-1 text-xs ring-1 ${
                discoverable
                  ? 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/30'
                  : 'bg-neutral-800 text-neutral-300 ring-white/10'
              }`}
            >
              {discoverable ? 'Açık' : 'Kapalı'}
            </button>
          </div>

          <label className="text-sm opacity-80">Yarıçap</label>
          <select
            value={radius}
            onChange={e => setRadius(Number(e.target.value))}
            className="rounded-md border border-white/10 bg-neutral-800 px-2 py-1 text-sm"
          >
            <option value={5}>5 km</option>
            <option value={10}>10 km</option>
            <option value={20}>20 km</option>
            <option value={30}>30 km</option>
            <option value={50}>50 km</option>
          </select>

          <button
            onClick={load}
            className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
          >
            Yenile
          </button>
        </div>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="text-sm text-neutral-400">Yükleniyor…</div>
      ) : items.length === 0 ? (
        <div className="text-sm text-neutral-400">Yakında uygun oyuncu bulunamadı.</div>
      ) : (
        <div className="space-y-2">
          {items.map(p => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-neutral-900 p-3"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium">
                  Oyuncu <span className="opacity-70">#{p.id.slice(0, 6)}</span>
                </div>
                <div className="mt-0.5 text-xs text-neutral-300">
                  Seviye: {p.level ?? '—'}
                  {Array.isArray(p.positions) && p.positions.length ? (
                    <> • Pozisyon: {p.positions.join(', ')}</>
                  ) : null}
                  <> • Mesafe: {p.distanceKm.toFixed(1)} km</>
                </div>
              </div>

              <button
                onClick={() => inviteToMatch(p.id)}
                className="text-xs text-emerald-300 hover:underline"
              >
                Davet et
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

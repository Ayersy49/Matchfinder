// app/discover/page.tsx
'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { authHeader } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const DISCOVER_ENDPOINT = '/users/discover';
const LS_DISCOVER = 'mf:discoverable';

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
  const params = useSearchParams();
  const presetMatchId = params.get('matchId') ?? undefined;

  const [lat, setLat] = React.useState<number | null>(null);
  const [lng, setLng] = React.useState<number | null>(null);
  const [radius, setRadius] = React.useState<number>(30); // 5 yerine 30
  const [loading, setLoading] = React.useState(false);
  const [items, setItems] = React.useState<Player[]>([]);
  const [discoverable, setDiscoverable] = React.useState<boolean>(true);

  // --- discoverable'ı kalıcı yap: önce localStorage, sonra sunucu ile eşitle ---
  React.useEffect(() => {
    // 1) localStorage
    try {
      const raw = localStorage.getItem(LS_DISCOVER);
      if (raw === 'true' || raw === 'false') setDiscoverable(raw === 'true');
    } catch {}

    // 2) sunucudan da varsa oku (me objesi discoverable döndürmüyorsa bu blok sessizce geçer)
    (async () => {
      try {
        const r = await fetch(`${API_URL}/users/me`, { headers: { ...authHeader() }, cache: 'no-store' });
        if (!r.ok) return;
        const me = await r.json().catch(() => ({}));
        if (typeof me?.discoverable === 'boolean') {
          setDiscoverable(me.discoverable);
          try { localStorage.setItem(LS_DISCOVER, String(me.discoverable)); } catch {}
        }
        if (typeof me?.lat === 'number') setLat(me.lat);
        if (typeof me?.lng === 'number') setLng(me.lng);
      } catch {}
    })();
  }, []);

  // --- konumu al ve sadece konumu güncelle (discoverable'a dokunma) ---
  React.useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const la = pos.coords.latitude;
        const ln = pos.coords.longitude;
        setLat(la);
        setLng(ln);

        try {
          await fetch(`${API_URL}/users/me/location`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...authHeader() },
            body: JSON.stringify({ lat: la, lng: ln }),
          });
        } catch {}
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  // --- Keşifte görünürlük toggle ---
  async function toggleDiscoverable() {
    const next = !discoverable;
    try {
      const r = await fetch(`${API_URL}/users/me/discoverable`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ value: next }),
      });
      if (!r.ok) {
        const t = await r.text().catch(() => '');
        console.error('discoverable error', r.status, t);
        throw new Error();
      }
      setDiscoverable(next);
      try { localStorage.setItem(LS_DISCOVER, String(next)); } catch {}
    } catch {
      alert('Keşifte görünürlük güncellenemedi.');
    }
  }

  // --- Listeyi yükle ---
  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      // lat/lng yoksa göndermiyoruz; backend me.lat/lng ile fallback yapabilir
      if (lat != null && lng != null) {
        qs.set('lat', String(lat));
        qs.set('lng', String(lng));
      }
      qs.set('radiusKm', String(radius));

      const r = await fetch(`${API_URL}${DISCOVER_ENDPOINT}?${qs.toString()}`, {
        headers: { ...authHeader() },
        cache: 'no-store',
      });
      if (!r.ok) {
        const t = await r.text().catch(() => '');
        console.error('discover fetch error', r.status, t);
        setItems([]);
        return;
      }
      const data = await r.json().catch(() => ({}));
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

  // --- Maça davet ---
  async function inviteToMatch(userId: string) {
    const matchId =
      presetMatchId ?? window.prompt("Hangi maçın id’sine davet edeceksin? (Match detail üstündeki ID)");
    if (!matchId) return;

    const note = window.prompt('Not (opsiyonel)');
    try {
      const r = await fetch(`${API_URL}/matches/${matchId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
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
    <div className="mx-auto max-w-4xl space-y-4 p-4 text-white">
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
            onChange={(e) => setRadius(Number(e.target.value))}
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
          {items.map((p) => (
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

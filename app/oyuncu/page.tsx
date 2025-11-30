"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import FooterTabs from "@/components/FooterTabs";


const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function getToken(): string {
  try {
    return (
      localStorage.getItem("token") ||
      localStorage.getItem("access_token") ||
      localStorage.getItem("jwt") ||
      ""
    );
  } catch {
    return "";
  }
}
function authHeader(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

type AvItem = { dow: number; start: string; end: string };

export default function FriendPublicProfilePage() {
  // ⬇️ params'ı props’tan almak yerine hook ile alıyoruz
  const params = useParams<{ id: string }>();
  const id = React.useMemo(() => {
    const v = (params as any)?.id;
    return Array.isArray(v) ? v[0] : v || "";
  }, [params]);

  const [data, setData] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`${API_URL}/users/${id}/public-profile`, {
          headers: { ...authHeader() },
          cache: "no-store",
        });
        if (!r.ok) throw new Error(String(r.status));
        const json = await r.json().catch(() => ({}));
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError("Profil yüklenemedi.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  function coerceAvail(av: any): AvItem[] {
    if (!av) return [];
    if (Array.isArray(av)) {
      return av
        .map((x: any) => ({
          dow: Number(x?.dow),
          start: String(x?.start || "").slice(0, 5),
          end: String(x?.end || "").slice(0, 5),
        }))
        .filter((x) => x.dow >= 1 && x.dow <= 7 && x.start && x.end && x.start < x.end)
        .sort((a, b) => (a.dow - b.dow) || (a.start < b.start ? -1 : 1));
    }
    const map: Record<string, number> = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7 };
    const arr: AvItem[] = [];
    for (const k in map) {
      const d = av[k];
      if (d?.enabled) arr.push({ dow: map[k], start: d.start?.slice(0, 5), end: d.end?.slice(0, 5) });
    }
    return arr
      .filter((x) => x.start && x.end && x.start < x.end)
      .sort((a, b) => (a.dow - b.dow) || (a.start < b.start ? -1 : 1));
  }

  const user = data?.user;
  const isFriend = Boolean(data?.isFriend);
  const avail = coerceAvail(data?.availability);

  return (
    <div className="px-4 py-4">
      <div className="mb-3 flex items-center gap-2">
        <Link href="/friends" className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700">
          ← Arkadaşlar
        </Link>
        <Link href="/landing" className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700">
          Ana menü
        </Link>
      </div>

      <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
        {loading ? (
          <div className="text-neutral-300">Yükleniyor…</div>
        ) : error ? (
          <div className="text-rose-300">{error}</div>
        ) : !user ? (
          <div className="text-neutral-300">Kullanıcı bulunamadı.</div>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-lg font-semibold">Oyuncu</div>
                <div className="text-sm text-neutral-400">ID: {user.id}</div>
              </div>
              <div className="rounded-md bg-neutral-800 px-3 py-1 text-sm">
                Seviye: <span className="font-semibold">{user.level ?? "-"}</span>
              </div>
            </div>

            <div className="mb-4">
              <div className="mb-1 text-sm font-medium">Tercih Pozisyonları</div>
              <div className="flex flex-wrap gap-2">
                {(Array.isArray(user.positions) ? user.positions : []).map((p: string) => (
                  <span key={p} className="rounded-full bg-neutral-800 px-3 py-1 text-xs">
                    {p}
                  </span>
                ))}
              </div>
            </div>

            {user.positionLevels && Object.keys(user.positionLevels).length > 0 && (
              <div className="mb-6">
                <div className="mb-1 text-sm font-medium">Pozisyon Seviyeleri</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.entries(user.positionLevels).map(([pos, val]: any) => (
                    <div key={pos} className="rounded-lg border border-white/10 bg-neutral-900 p-2 text-sm">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-medium">{pos}</span>
                        <span className="text-neutral-300">{val}</span>
                      </div>
                      <div className="h-1 w-full rounded bg-neutral-800">
                        <div className="h-1 rounded bg-white/70" style={{ width: `${(Number(val) ?? 0) * 10}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {user.preferredFormation && (
              <div className="mb-6 text-sm">
                Tercih Diziliş: <span className="font-semibold">{user.preferredFormation}</span>
              </div>
            )}

            <div>
              <div className="mb-2 text-sm font-semibold">Müsaitlik</div>
              {!isFriend ? (
                <div className="text-xs text-neutral-400">Yalnızca arkadaşlar görebilir.</div>
              ) : avail.length === 0 ? (
                <div className="text-xs text-neutral-400">Aralık yok.</div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {Array.from({ length: 7 }, (_, i) => i + 1).map((d) => {
                    const list = avail.filter((x) => x.dow === d);
                    return (
                      <div key={d} className="rounded-lg border border-white/10 bg-neutral-900 p-2">
                        <div className="mb-1 text-sm font-medium">{["Pzt","Sal","Çar","Per","Cum","Cmt","Paz"][d-1]}</div>
                        <div className="text-xs text-neutral-300">
                          {list.length === 0 ? "—" : list.map((x) => `${x.start}–${x.end}`).join(", ")}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Saha Kaşifi */}
            <PitchExplorerPanel userId={id} />

            {/* Son 5 Maç W/L/D */}
            <MatchHistoryPanel userId={id} />
          </>
        )}
      </div>
    </div>
  );
}

/* ===================== SON 5 MAÇ W/L/D PANELİ ===================== */
function MatchHistoryPanel({ userId }: { userId: string }) {
  const [matches, setMatches] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    
    (async () => {
      try {
        const r = await fetch(`${API_URL}/users/${userId}/match-history?limit=5`, {
          headers: authHeader(),
        });
        if (r.ok) {
          const data = await r.json();
          if (!cancelled) setMatches(data.matches || []);
        }
      } catch (e) {
        console.error('Failed to fetch match history:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    
    return () => { cancelled = true; };
  }, [userId]);

  if (loading) {
    return (
      <div className="mt-6">
        <div className="mb-2 text-sm font-semibold">Son Maçlar</div>
        <div className="text-xs text-neutral-400">Yükleniyor...</div>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="mt-6">
        <div className="mb-2 text-sm font-semibold">Son Maçlar</div>
        <div className="text-xs text-neutral-400">Henüz tamamlanmış maç yok.</div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="mb-3 text-sm font-semibold">Son Maçlar</div>
      
      {/* Chess.com tarzı W/L/D bar */}
      <div className="flex items-center gap-1 mb-3">
        {matches.map((m, i) => (
          <div
            key={m.matchId}
            className="relative group"
            title={`${m.opponentName} - ${m.result === 'W' ? 'Kazandı' : m.result === 'L' ? 'Kaybetti' : 'Berabere'}`}
          >
            {/* W/L/D kutusu */}
            <div
              className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold transition
                ${m.result === 'W' ? 'bg-emerald-600 text-white' : ''}
                ${m.result === 'L' ? 'bg-red-600 text-white' : ''}
                ${m.result === 'D' ? 'bg-neutral-500 text-white' : ''}
              `}
            >
              {m.result === 'W' ? '1' : m.result === 'L' ? '0' : '½'}
            </div>
            
            {/* Takım/Seri maçı göstergesi */}
            <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border border-neutral-900
              ${m.type === 'TEAM' ? 'bg-rose-500' : 'bg-indigo-500'}
            `} />
          </div>
        ))}
      </div>

      {/* Özet istatistik */}
      <div className="flex items-center gap-4 text-xs">
        <span className="text-emerald-400">
          {matches.filter(m => m.result === 'W').length}W
        </span>
        <span className="text-neutral-400">
          {matches.filter(m => m.result === 'D').length}D
        </span>
        <span className="text-red-400">
          {matches.filter(m => m.result === 'L').length}L
        </span>
      </div>

      {/* Açıklama */}
      <div className="mt-2 text-[10px] text-neutral-500">
        <span className="inline-block w-2 h-2 rounded-full bg-rose-500 mr-1" /> Takım Maçı
        <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 ml-3 mr-1" /> Seri Maçı
      </div>
    </div>
  );
}

/* ===================== SAHA KAŞİFİ PANELİ ===================== */
function PitchExplorerPanel({ userId }: { userId: string }) {
  const [data, setData] = React.useState<{
    xp: number;
    level: number;
    title: string;
    visitCount: number;
    uniquePitches: number;
  } | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    (async () => {
      try {
        const r = await fetch(`${API_URL}/users/${userId}/pitch-explorer`, {
          headers: authHeader(),
        });
        if (r.ok) {
          const json = await r.json();
          if (!cancelled) setData(json);
        }
      } catch (e) {
        console.error('Failed to fetch pitch explorer:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [userId]);

  if (loading) {
    return (
      <div className="mt-6">
        <div className="mb-2 text-sm font-semibold">Saha Kaşifi</div>
        <div className="text-xs text-neutral-400">Yükleniyor...</div>
      </div>
    );
  }

  if (!data || data.xp === 0) {
    return (
      <div className="mt-6">
        <div className="mb-2 text-sm font-semibold">🗺️ Saha Kaşifi</div>
        <div className="text-xs text-neutral-400">Henüz saha kaşifliği başlamadı.</div>
      </div>
    );
  }

  // Level renkleri
  const levelColors = [
    'text-neutral-400',   // 0 - Aday
    'text-emerald-400',   // 1 - Mahalle
    'text-blue-400',      // 2 - Şehir
    'text-purple-400',    // 3 - Bölge
    'text-amber-400',     // 4 - Ülke
  ];

  // Level ikonları
  const levelIcons = ['🌱', '🏘️', '🏙️', '🗺️', '🌍'];

  // XP bar hesaplama (her level 100 XP)
  const xpForNextLevel = (data.level + 1) * 100;
  const xpProgress = Math.min(100, (data.xp / xpForNextLevel) * 100);

  return (
    <div className="mt-6">
      <div className="mb-3 text-sm font-semibold">🗺️ Saha Kaşifi</div>
      
      <div className="rounded-xl border border-white/10 bg-neutral-900 p-4">
        {/* Başlık ve seviye */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{levelIcons[data.level] || '🗺️'}</span>
            <div>
              <div className={`font-semibold ${levelColors[data.level] || 'text-white'}`}>
                {data.title}
              </div>
              <div className="text-xs text-neutral-400">Seviye {data.level}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-emerald-400">{data.xp} XP</div>
            <div className="text-xs text-neutral-400">Toplam</div>
          </div>
        </div>

        {/* XP Progress bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-neutral-400 mb-1">
            <span>Sonraki Seviye</span>
            <span>{data.xp} / {xpForNextLevel}</span>
          </div>
          <div className="h-2 w-full rounded bg-neutral-800 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 transition-all duration-500"
              style={{ width: `${xpProgress}%` }}
            />
          </div>
        </div>

        {/* İstatistikler */}
        <div className="grid grid-cols-2 gap-3 text-center">
          <div className="rounded-lg bg-neutral-800 p-2">
            <div className="text-lg font-bold text-white">{data.visitCount}</div>
            <div className="text-xs text-neutral-400">Toplam Ziyaret</div>
          </div>
          <div className="rounded-lg bg-neutral-800 p-2">
            <div className="text-lg font-bold text-white">{data.uniquePitches}</div>
            <div className="text-xs text-neutral-400">Farklı Saha</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// app/match/[id]/MatchDetailClient.tsx
'use client';

import * as React from 'react';
import MatchProposalsSection from "./MatchProposalsSection";
import Link from 'next/link';
import { authHeader, clearToken, myId } from '@/lib/auth';
import InviteFriendsClient from './InviteFriendsClient';
import {
  Shield,
  UserPlus,
  ThumbsUp,
  ThumbsDown,
  Check,
  Clock,
  Trash2,
  RefreshCw,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/* ===================== Tipler ===================== */
type Team = 'A' | 'B';

function labelPos(p: string) {
  return p === 'SUB' ? 'Yedek' : p;
}
function canAdmin(m: MatchDetail | null, meId?: string | null) {
  return !!m && !!meId && m.ownerId === meId;
}
function isFree(s: Slot) {
  return !s.userId && !s.placeholder;
}

type Slot = {
  team: Team;
  pos: string;
  userId?: string | null;
  placeholder?: 'ADMIN' | 'GUEST';
  guestOfUserId?: string | null;
};

type TimeProposal = {
  id: string;
  by: string; // userId
  time: string | null;
  createdAt: string;
  votesUp: number;
  votesDown: number;
  myVote: 'UP' | 'DOWN' | null;
};

type MatchDetail = {
  id: string;
  ownerId: string;
  title: string | null;
  location: string | null;
  level: string | null;
  format: string | null;
  price: number | null;
  time: string | null;
  slots: Slot[];
  inviteOnly?: boolean | null;
  createdFrom?: 'TEAM_MATCH' | string | null;
  access?:
    | {
        owner?: boolean;
        joined?: boolean;
        canView?: boolean;
        requestPending?: boolean;
        canEdit?: boolean; // BE’den gelen bayrak
      }
    | null;
};

type ChatItem = {
  id: string;
  userId: string;
  text: string;
  deleted: boolean;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
};

/** Önerilen oyuncu tipi */
type Recommended = {
  id: string;
  phone?: string | null;
  level?: number | null;
  positions?: string[] | null;
  distanceKm?: number | null;
  ratingScore?: number | null; // 0..100
  risk?: 'RED' | 'YELLOW' | 'GREEN' | null;
  invited?: boolean;
};

/* ===================== Yardımcılar ===================== */
function handle401(status: number) {
  if (status === 401) {
    clearToken?.();
    alert('Oturum gerekli veya süresi doldu. Lütfen tekrar giriş yapın.');
    window.location.href = '/';
    return true;
  }
  return false;
}
function maskPhone(p?: string | null) {
  const s = (p || '').replace(/\D/g, '');
  if (s.length < 7) return '—';
  return s.slice(0, 3) + ' *** ' + s.slice(-2);
}
function badgeForScore(score?: number | null) {
  if (score == null) return { cls: 'bg-neutral-700 text-neutral-200', label: '—' };
  if (score >= 90) return { cls: 'bg-sky-700/70 text-sky-100', label: 'Mavi' };
  if (score >= 60) return { cls: 'bg-emerald-700/70 text-emerald-100', label: 'Yeşil' };
  if (score >= 40) return { cls: 'bg-amber-700/70 text-amber-100', label: 'Sarı' };
  return { cls: 'bg-rose-700/70 text-rose-100', label: 'Kırmızı' };
}
function fmtDate(s?: string | null) {
  if (!s) return '—';
  const d = new Date(s);
  return d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
}

/* ======================= Mini Davet Paneli ======================= */
function InviteMini({ matchId, onOpenInvite }: { matchId: string; onOpenInvite: () => void }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
      <div className="mb-2 text-sm font-medium">Arkadaş çağır</div>
      <div className="mb-3 text-xs text-neutral-300">
        Yakındaki oyuncuları keşfet ve bu maça davet et ya da arkadaşlarından seç.
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onOpenInvite}
          className="rounded-xl bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
        >
          Arkadaşlarından seç
        </button>
        <Link
          href={`/discover?matchId=${matchId}`}
          className="rounded-xl bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
        >
          Keşfet ile davet et
        </Link>
        <Link
          href="/invites"
          className="rounded-xl bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
        >
          Davet kutusu
        </Link>
      </div>
    </div>
  );
}

/* ======================= Saat & Tarih Önerileri ======================= */
function TimeProposalsPanel({
  matchId,
  isOwner,
  onApplied,
}: {
  matchId: string;
  isOwner: boolean;
  onApplied?: () => void; // maça saat uygulandığında üst komponent refresh etsin
}) {
  const me = myId();
  const [items, setItems] = React.useState<TimeProposal[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [acting, setActing] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API_URL}/matches/${matchId}/time-proposals`, {
        headers: { ...authHeader() },
        cache: 'no-store',
      });
      if (handle401(r.status)) return;

      if (!r.ok) {
        if (r.status === 403) {
          setItems([]);
          setError('Bu maç kilitli; yetkin yok (katılımcı/davetli değilsin).');
          setLoading(false);
          return;
        }
      }
      const j = await r.json().catch(() => ({}));
      const arr: any[] = Array.isArray(j?.items) ? j.items : [];
      const mapped: TimeProposal[] = arr.map((p: any) => ({
        id: String(p.id),
        by: String(p.by ?? p.userId ?? ''),
        time: p.time ?? null,
        createdAt: p.createdAt ?? new Date().toISOString(),
        votesUp: Number(p.votesUp ?? 0),
        votesDown: Number(p.votesDown ?? 0),
        myVote: p.myVote ?? null,
      }));
      setItems(mapped);
    } catch (e: any) {
      setError(e?.message || 'Öneriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  React.useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  async function vote(id: string, v: 'UP' | 'DOWN') {
    try {
      setActing(id);
      // optimistic
      setItems((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          const prevVote = p.myVote;
          let up = p.votesUp;
          let down = p.votesDown;
          if (prevVote === 'UP') up--;
          if (prevVote === 'DOWN') down--;
          if (v === 'UP') up++;
          if (v === 'DOWN') down++;
          return { ...p, myVote: v, votesUp: Math.max(0, up), votesDown: Math.max(0, down) };
        }),
      );

      const r = await fetch(`${API_URL}/matches/${matchId}/time-proposals/${id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ value: v }),
      });
      if (handle401(r.status)) return;
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.ok === false) throw new Error(j?.message || `HTTP ${r.status}`);
      // gerçek değerleri tazele
      load();
    } catch (e: any) {
      alert(e?.message || 'Oy gönderilemedi');
      load();
    } finally {
      setActing(null);
    }
  }

  async function applyTime(id: string) {
    if (!isOwner) return;
    try {
      setActing(id);
      const r = await fetch(`${API_URL}/matches/${matchId}/time-proposals/${id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
      });
      if (handle401(r.status)) return;
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.ok === false) throw new Error(j?.message || `HTTP ${r.status}`);
      onApplied?.();
      await load();
    } catch (e: any) {
      alert(e?.message || 'Saat uygulanamadı');
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Clock className="size-4" />
          <span>Saat & Tarih Önerileri</span>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1 rounded bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700"
          title="Yenile"
        >
          <RefreshCw className="size-3.5" />
          Yenile
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-neutral-400">Yükleniyor…</div>
      ) : error ? (
        <div className="text-sm text-rose-400">{error}</div>
      ) : !items.length ? (
        <div className="text-sm text-neutral-400">Henüz öneri yok.</div>
      ) : (
        <div className="space-y-2">
          {items.map((p) => {
            const mine = p.by === me;
            return (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0f141b] px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="text-sm text-neutral-100">{fmtDate(p.time)}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-neutral-400">
                    <span>Öneren: {mine ? 'Siz' : 'Oyuncu'}</span>
                    <span>•</span>
                    <span>{fmtDate(p.createdAt)}</span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    disabled={acting === p.id}
                    onClick={() => vote(p.id, 'UP')}
                    className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs ring-1 ring-white/15 ${
                      p.myVote === 'UP'
                        ? 'bg-emerald-600/90 text-neutral-900'
                        : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'
                    }`}
                    title="Evet (bu saat uygun)"
                  >
                    <ThumbsUp className="size-3.5" />
                    {p.votesUp}
                  </button>
                  <button
                    disabled={acting === p.id}
                    onClick={() => vote(p.id, 'DOWN')}
                    className={`inline-flex items-center gap-1 rounded px-2 py-1 text-xs ring-1 ring-white/15 ${
                      p.myVote === 'DOWN'
                        ? 'bg-rose-600/90 text-neutral-900'
                        : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'
                    }`}
                    title="Hayır (uygun değil)"
                  >
                    <ThumbsDown className="size-3.5" />
                    {p.votesDown}
                  </button>

                  {isOwner && (
                    <button
                      disabled={acting === p.id}
                      onClick={() => applyTime(p.id)}
                      className="inline-flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-xs text-neutral-950 hover:bg-blue-500 disabled:opacity-60"
                      title="Maçı bu saate ayarla"
                    >
                      <Check className="size-3.5" />
                      Uygula
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ======================= Sohbet Paneli ======================= */
function MatchChat({ matchId }: { matchId: string }) {
  const me = myId();
  const [items, setItems] = React.useState<ChatItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [sending, setSending] = React.useState(false);
  const [input, setInput] = React.useState('');
  const [editId, setEditId] = React.useState<string | null>(null);
  const [editText, setEditText] = React.useState('');
  const endRef = React.useRef<HTMLDivElement | null>(null);

  const fetchMessages = React.useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/matches/${matchId}/messages?limit=50`, {  
        headers: { ...authHeader() },
        cache: 'no-store',
      });
      if (handle401(r.status)) return;
      const data = await r.json();
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  React.useEffect(() => {
    fetchMessages();
    const t = setInterval(fetchMessages, 4000);
    return () => clearInterval(t);
  }, [fetchMessages]);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [items]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);

    const optimisticId = `local-${Date.now()}`;
    const optimistic: ChatItem = {
      id: optimisticId,
      userId: me || 'me',
      text,
      deleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      editedAt: null,
    };
    setItems((prev) => [...prev, optimistic]);
    setInput('');

    try {
      const r = await fetch(`${API_URL}/matches/${matchId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ text }),
      });
      if (handle401(r.status)) return;
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data?.ok) throw new Error(data?.message || 'Mesaj gönderilemedi');
      fetchMessages();
    } catch (e: any) {
      alert(e?.message || 'Mesaj gönderilemedi');
      setItems((prev) => prev.filter((m) => m.id !== optimisticId));
    } finally {
      setSending(false);
    }
  }

  async function saveEditMessage() {
    const msgId = editId;
    const text = editText.trim();
    if (!msgId || !text) return;

    setItems((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, text, editedAt: new Date().toISOString() } : m)),
    );

    try {
      const r = await fetch(`${API_URL}/matches/${matchId}/messages/${msgId}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ text }),
      });
      if (handle401(r.status)) return;
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data?.ok) throw new Error(data?.message || 'Düzenleme başarısız');
      setEditId(null);
      setEditText('');
      fetchMessages();
    } catch (e: any) {
      alert(e?.message || 'Düzenleme başarısız');
      fetchMessages();
    }
  }

  async function remove(msgId: string) {
    setItems((prev) => prev.map((m) => (m.id === msgId ? { ...m, deleted: true, text: '' } : m)));

    try {
      const r = await fetch(`${API_URL}/matches/${matchId}/messages/${msgId}/delete`, {
        method: 'POST',
        headers: { ...authHeader() },
      });
      if (handle401(r.status)) return;
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data?.ok) throw new Error(data?.message || 'Silme başarısız');
      fetchMessages();
    } catch (e: any) {
      alert(e?.message || 'Silme başarısız');
      fetchMessages();
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-900/60">
      <div className="border-b border-white/10 p-3 text-sm font-medium">Sohbet</div>

      <div className="h-72 space-y-3 overflow-auto p-3">
        {loading ? (
          <div className="text-sm text-neutral-400">Yükleniyor…</div>
        ) : !items.length ? (
          <div className="text-sm text-neutral-400">Henüz mesaj yok.</div>
        ) : (
          items.map((m) => {
            const isMine = m.userId === myId();

            if (editId === m.id && !m.deleted) {
              return (
                <div key={m.id} className="flex justify-start">
                  <div className="w-full max-w-xl rounded-2xl bg-[#10151c] px-3 py-2 text-left shadow-sm ring-1 ring-white/10">
                    <div className="mb-1 flex items-center gap-2">
                      <span
                        className={`text-xs font-medium ${
                          isMine ? 'text-emerald-300' : 'text-zinc-300'
                        }`}
                      >
                        {isMine ? 'Siz' : 'Oyuncu'}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {new Date(m.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        className="flex-1 rounded-lg bg-[#0f141b] px-2 py-1 text-sm outline-none ring-1 ring-white/10"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEditMessage();
                          if (e.key === 'Escape') {
                            setEditId(null);
                            setEditText('');
                          }
                        }}
                        autoFocus
                      />
                      <button
                        onClick={saveEditMessage}
                        className="rounded bg-emerald-600/90 px-2 py-1 text-xs hover:bg-emerald-600"
                      >
                        Kaydet
                      </button>
                      <button
                        onClick={() => {
                          setEditId(null);
                          setEditText('');
                        }}
                        className="rounded bg-neutral-800/80 px-2 py-1 text-xs hover:bg-neutral-800"
                      >
                        Vazgeç
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div key={m.id} className="flex justify-start">
                <div className="w-full max-w-xl rounded-2xl bg-[#10151c] px-3 py-2 text-left shadow-sm ring-1 ring-white/10">
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      className={`text-xs font-medium ${
                        isMine ? 'text-emerald-300' : 'text-zinc-300'
                      }`}
                    >
                      {isMine ? 'Siz' : 'Oyuncu'}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {new Date(m.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {m.deleted ? (
                    <div className="text-xs italic text-neutral-400">(silinmiş)</div>
                  ) : (
                    <>
                      <div className="text-sm text-zinc-100">{m.text}</div>
                      {isMine && (
                        <div className="mt-1 flex items-center gap-3">
                          <button
                            onClick={() => {
                              setEditId(m.id);
                              setEditText(m.text);
                            }}
                            className="text-[11px] text-blue-300 hover:underline"
                          >
                            Düzenle
                          </button>
                          <button
                            onClick={() => remove(m.id)}
                            className="text-[11px] text-rose-300 hover:underline"
                          >
                            Sil
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <div className="flex gap-2 border-t border-white/10 p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send();
          }}
          className="flex-1 rounded-lg border border-white/10 bg-transparent px-3 py-2"
          placeholder="Mesaj yaz…"
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          className="rounded-lg bg-emerald-600 px-3 py-2 text-white disabled:opacity-50"
        >
          Gönder
        </button>
      </div>
    </div>
  );
}

/* ======================= ÖNERİLEN DAVETLER ======================= */
function RecommendedPanel({
  matchId,
  needPos,
  team,
}: {
  matchId: string;
  needPos: string;
  team: 'A' | 'B' | 'ANY';
}) {
  const [items, setItems] = React.useState<Recommended[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [inviting, setInviting] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (needPos && needPos !== 'ANY') qs.set('pos', needPos);
      if (team && team !== 'ANY') qs.set('team', team);
      const r = await fetch(
        `${API_URL}/matches/${matchId}/recommend-invites?${qs.toString()}`,
        {
          headers: { ...authHeader() },
          cache: 'no-store',
        },
      );
      if (r.status === 403) {
        setItems([]);
        setLoading(false);
        return;
      }

      if (handle401(r.status)) return;
      const data = await r.json().catch(() => ({}));
      const arr: any[] = Array.isArray(data?.items) ? data.items : [];
      const mapped: Recommended[] = arr.map((x) => ({
        id: String(x.id),
        phone: x.phone ?? x.phoneMasked ?? null,
        level: typeof x.level === 'number' ? x.level : null,
        positions: Array.isArray(x.positions) ? x.positions : null,
        distanceKm: typeof x.distanceKm === 'number' ? x.distanceKm : null,
        ratingScore: typeof x.score === 'number' ? x.score : null,
        risk: null,
        invited: Boolean(x.invited),
      }));
      setItems(mapped);
    } catch (e: any) {
      setError(e?.message || 'Öneriler alınamadı');
    } finally {
      setLoading(false);
    }
  }, [matchId, needPos, team]);

  React.useEffect(() => {
    load();
  }, [load]);

  async function invite(userId: string) {
    if (inviting) return;
    setInviting(userId);
    // optimistic
    setItems((prev) => prev.map((it) => (it.id === userId ? { ...it, invited: true } : it)));
    try {
      const r = await fetch(`${API_URL}/matches/${matchId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ toUserId: userId }),
      });
      if (handle401(r.status)) return;
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.ok === false) throw new Error(j?.message || 'Davet gönderilemedi');
    } catch (e: any) {
      alert(e?.message || 'Davet gönderilemedi');
      setItems((prev) => prev.map((it) => (it.id === userId ? { ...it, invited: false } : it)));
    } finally {
      setInviting(null);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
      <div className="mb-2 text-sm font-semibold">Önerilen davetler</div>

      {loading ? (
        <div className="text-sm text-neutral-400">Yükleniyor…</div>
      ) : error ? (
        <div className="text-sm text-rose-400">{error}</div>
      ) : !items.length ? (
        <div className="text-sm text-neutral-400">Uygun öneri yok.</div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => {
            const badge = badgeForScore(p.ratingScore);
            return (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0f141b] px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <div className={`rounded px-1.5 py-0.5 text-[10px] ${badge.cls}`}>
                      {badge.label}
                    </div>
                    {typeof p.level === 'number' && (
                      <div className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-200">
                        Seviye {p.level}
                      </div>
                    )}
                    {p.distanceKm != null && (
                      <div className="text-[10px] text-neutral-400">
                        {p.distanceKm.toFixed(1)} km
                      </div>
                    )}
                  </div>
                  <div className="truncate text-sm text-neutral-100">{maskPhone(p.phone)}</div>
                  {p.positions && p.positions.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {p.positions.slice(0, 4).map((x) => (
                        <span
                          key={x}
                          className="rounded border border-white/10 px-1.5 py-0.5 text-[11px] text-neutral-300"
                        >
                          {x}
                        </span>
                      ))}
                      {p.positions.length > 4 && (
                        <span className="text-[11px] text-neutral-400">
                          +{p.positions.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <button
                  disabled={p.invited || inviting === p.id}
                  onClick={() => invite(p.id)}
                  className={`shrink-0 rounded-lg px-2 py-1 text-xs ${
                    p.invited
                      ? 'bg-neutral-800 text-neutral-300'
                      : 'bg-emerald-600 text-neutral-900 hover:bg-emerald-500'
                  } disabled:opacity-60`}
                >
                  {p.invited ? 'Gönderildi' : inviting === p.id ? 'Gönderiliyor…' : 'Davet et'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ======================= GELEN ERİŞİM İSTEKLERİ (Owner) ======================= */
function AccessRequestsPanel({ matchId }: { matchId: string }) {
  const [items, setItems] = React.useState<
    Array<{
      id: string;
      userId: string;
      phone: string | null;
      level: number | null;
      positions: string[];
      message: string | null;
      createdAt: string;
    }>
  >([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [acting, setActing] = React.useState<string | null>(null);

  const load = React.useCallback(
    async () => {
      setLoading(true);
      setErr(null);
      try {
        const r = await fetch(`${API_URL}/matches/${matchId}/requests`, {
          headers: { ...authHeader() },
          cache: 'no-store',
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || j?.ok === false) throw new Error(j?.message || `HTTP ${r.status}`);
        const arr = Array.isArray(j?.items) ? j.items : [];
        setItems(arr);
      } catch (e: any) {
        setErr(e?.message || 'İstekler alınamadı');
      } finally {
        setLoading(false);
      }
    },
    [matchId],
  );

  React.useEffect(() => {
    load();
  }, [load]);

  async function respond(reqId: string, action: 'APPROVE' | 'DECLINE') {
    if (acting) return;
    setActing(reqId);
    try {
      const r = await fetch(`${API_URL}/matches/${matchId}/requests/${reqId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ action }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.ok === false) throw new Error(j?.message || `HTTP ${r.status}`);
      setItems((prev) => prev.filter((x) => x.id !== reqId));
    } catch (e: any) {
      alert(e?.message || 'İşlem başarısız');
    } finally {
      setActing(null);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-semibold">Gelen erişim istekleri</div>
        <button
          onClick={load}
          className="rounded bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700"
        >
          Yenile
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-neutral-400">Yükleniyor…</div>
      ) : err ? (
        <div className="text-sm text-rose-400">{err}</div>
      ) : !items.length ? (
        <div className="text-sm text-neutral-400">Bekleyen istek yok.</div>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <div
              key={it.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0f141b] px-3 py-2"
            >
              <div className="min-w-0">
                <div className="text-sm text-neutral-100">{maskPhone(it.phone)}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-neutral-400">
                  {typeof it.level === 'number' ? <span>Seviye {it.level}</span> : null}
                  {Array.isArray(it.positions) && it.positions.length ? (
                    <span className="flex flex-wrap gap-1">
                      {it.positions.slice(0, 3).map((p) => (
                        <span
                          key={p}
                          className="rounded border border-white/10 px-1.5 py-0.5"
                        >
                          {p}
                        </span>
                      ))}
                      {it.positions.length > 3 ? (
                        <span>+{it.positions.length - 3}</span>
                      ) : null}
                    </span>
                  ) : null}
                  {it.message ? (
                    <span className="max-w-[280px] truncate text-neutral-300">“{it.message}”</span>
                  ) : null}
                </div>
                <div className="text-[10px] text-neutral-500">
                  {new Date(it.createdAt).toLocaleString([], {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  disabled={acting === it.id}
                  onClick={() => respond(it.id, 'APPROVE')}
                  className="rounded bg-emerald-600 px-2 py-1 text-xs text-neutral-950 hover:bg-emerald-500 disabled:opacity-60"
                >
                  Onayla
                </button>
                <button
                  disabled={acting === it.id}
                  onClick={() => respond(it.id, 'DECLINE')}
                  className="rounded bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700 disabled:opacity-60"
                >
                  Reddet
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ==================== DETAY SAYFASI ==================== */
export default function MatchDetailClient({ id }: { id: string }) {
  const me = myId();
  const currentUserId = myId(); // Mevcut kullanıcı ID'si
  const [m, setM] = React.useState<MatchDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [locking, setLocking] = React.useState(false);

  const [suggestOpen, setSuggestOpen] = React.useState(false);
  const [suggestWhen, setSuggestWhen] = React.useState('');
  const [suggestSending, setSuggestSending] = React.useState(false);

  // Düzenleme modal state’i
  const [editOpen, setEditOpen] = React.useState(false);
  const [savingEdit, setSavingEdit] = React.useState(false);
  const [editForm, setEditForm] = React.useState({
    title: '',
    location: '',
    level: '',
    format: '',
    price: '' as number | '',
    time: '',
  });

  // Davet modal state
  const [inviteOpen, setInviteOpen] = React.useState(false);

  const refresh = React.useCallback(
    async () => {
      setLoading(true);
      try {
        const r = await fetch(`${API_URL}/matches/${id}`, {
          headers: { ...authHeader() },
          cache: 'no-store',
        });
        if (r.status === 403) {
          alert('Bu maç kilitli. Detayı sadece katılımcılar veya davetliler görebilir.');
          window.location.href = '/landing';
          return;
        }
        const data = await r.json();
        const slots: Slot[] = Array.isArray(data?.slots) ? data.slots : [];
        setM({ ...data, slots });
      } catch (e) {
        console.error(e);
        setM(null);
      } finally {
        setLoading(false);
      }
    },
    [id],
  );

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  // 🔥 DEBUG: BURAYI EKLE
  React.useEffect(() => {
    if (m) {
      console.log('🔥 MATCH DATA:', m);
      console.log('🔥 SLOTS:', m.slots);
      console.log('🔥 SLOTS LENGTH:', m.slots?.length);
      console.log('🔥 createdFrom:', m.createdFrom);
      console.log('🔥 TEAM A SLOTS:', teamA);
      console.log('🔥 TEAM B SLOTS:', teamB);
    }
  }, [m]);

  // --- Kilit toggle ---
  async function toggleLock() {
    if (!m) return;
    try {
      setLocking(true);
      const res = await fetch(`${API_URL}/matches/${m.id}/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ inviteOnly: !m.inviteOnly }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j?.message || 'Kilit güncellenemedi');
      await refresh();
    } catch (e: any) {
      alert(e?.message || 'Kilit değiştirilemedi');
    } finally {
      setLocking(false);
    }
  }

  // Modal açılınca mevcut değerleri forma doldur
  React.useEffect(() => {
    if (!editOpen || !m) return;
    setEditForm({
      title: m.title ?? '',
      location: m.location ?? '',
      level: m.level ?? '',
      format: m.format ?? '',
      price: (m.price ?? '') as any,
      time: m.time ? new Date(m.time).toISOString().slice(0, 16) : '',
    });
  }, [editOpen, m]);

  const isOwner = !!m && me === m.ownerId;
  const canEdit = !!m?.access?.canEdit;

  const mySlot = m?.slots?.find((s) => s.userId === me) || null;
  const teamA = (m?.slots || []).filter((s) => s.team === 'A');
  const teamB = (m?.slots || []).filter((s) => s.team === 'B');

  // Doluluk / Yedek uygunluğu
  const coreA = teamA.filter((s) => s.pos !== 'SUB');
  const coreB = teamB.filter((s) => s.pos !== 'SUB');
  const isFullA = coreA.length > 0 && coreA.every((s) => !isFree(s));
  const isFullB = coreB.length > 0 && coreB.every((s) => !isFree(s));
  const canSubA = teamA.some((s) => s.pos === 'SUB' && isFree(s));
  const canSubB = teamB.some((s) => s.pos === 'SUB' && isFree(s));

  // İhtiyaç pozisyonu (öneriler için)
  function calcNeeds(slots: Slot[], team?: Team) {
    const list = slots.filter((s) => s.pos !== 'SUB' && (!team || s.team === team));
    const map = new Map<string, number>();
    for (const s of list) {
      if (isFree(s)) map.set(s.pos, (map.get(s.pos) || 0) + 1);
    }
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([pos]) => pos);
  }
  const needA = calcNeeds(m?.slots || [], 'A');
  const needB = calcNeeds(m?.slots || [], 'B');
  const defaultNeed = (needA[0] || needB[0] || 'ANY') as string;
  const [focusPos, setFocusPos] = React.useState<string>(defaultNeed);
  const [focusTeam, setFocusTeam] = React.useState<'A' | 'B' | 'ANY'>(
    needA.length ? 'A' : needB.length ? 'B' : 'ANY',
  );

  React.useEffect(() => {
    setFocusPos(defaultNeed);
    setFocusTeam(needA.length ? 'A' : needB.length ? 'B' : 'ANY');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m?.id, m?.slots?.length]);

  /** Takıma pozisyonsuz katıl */
  async function joinTeam(team: Team) {
    try {
      setBusy(true);
      const r = await fetch(`${API_URL}/matches/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ matchId: id, team }),
      });
      if (handle401(r.status)) return;
      if (r.status === 403) {
        alert('Bu maç kilitli. Davet gerekiyor.');
        return;
      }

      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (r.status === 409 && data?.message === 'no preferred open slot') {
          alert('Tercih ettiğin pozisyonlar bu takımda dolu. Aşağıdan boş bir pozisyon seçebilirsin.');
          return;
        }
        throw new Error(data?.message || 'Katılım başarısız');
      }
      await refresh();
    } catch (e: any) {
      alert(e?.message || 'Katılım başarısız');
    } finally {
      setBusy(false);
    }
  }

  /** Belirli bir zaman öner */
  async function sendTimeSuggestion() {
    if (!m || !suggestWhen) return;
    try {
      setSuggestSending(true);
      const r = await fetch(`${API_URL}/matches/${m.id}/propose-time`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ time: new Date(suggestWhen).toISOString() }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.ok === false) throw new Error(j?.message || `HTTP ${r.status}`);
      setSuggestOpen(false);
      setSuggestWhen('');
      // Öneri gönderildi – TimeProposalsPanel kendini poll ediyor ama yine de kullanıcı hissi için:
      // (Eğer aşağıdaki panel refetch istiyorsan bir event gönderebilirdik; poll yeterli.)
    } catch (e: any) {
      alert(e?.message || 'Öneri gönderilemedi');
    } finally {
      setSuggestSending(false);
    }
  }

  /** Belirli bir pozisyona, belirtilen takımda katıl. */
  async function joinSpecific(team: Team, pos: string) {
    try {
      setBusy(true);
      const r = await fetch(`${API_URL}/matches/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ matchId: id, pos, team }),
      });
      if (handle401(r.status)) return;
      if (r.status === 403) {
        alert('Bu maç kilitli. Davet gerekiyor.');
        return;
      }

      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.message || 'Katılım başarısız');
      await refresh();
    } catch (e: any) {
      alert(e?.message || 'Katılım başarısız');
    } finally {
      setBusy(false);
    }
  }

  /** Yedek olarak katıl */
  async function joinAsSub(team: Team) {
    try {
      setBusy(true);
      const r = await fetch(`${API_URL}/matches/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ matchId: id, team, pos: 'SUB' }),
      });
      if (handle401(r.status)) return;
      if (r.status === 403) {
        alert('Bu maç kilitli. Davet gerekiyor.');
        return;
      }

      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.ok !== true) throw new Error(j?.message || 'Katılım başarısız');
      await refresh();
    } catch (e: any) {
      alert(e?.message || 'Katılım başarısız');
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    try {
      setBusy(true);
      const r = await fetch(`${API_URL}/matches/${id}/leave`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
      });
      if (handle401(r.status)) return;

      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data?.ok) throw new Error(data?.message || 'Ayrılma başarısız');
      await refresh();
    } catch (e: any) {
      alert(e?.message || 'Ayrılma başarısız');
    } finally {
      setBusy(false);
    }
  }

  async function reserve(team: Team, pos: string, type: 'ADMIN' | 'GUEST') {
    try {
      setBusy(true);
      const r = await fetch(`${API_URL}/matches/${m!.id}/reserve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ team, pos, type }),
      });
      if (handle401(r.status)) return;
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.ok !== true) throw new Error(j?.message || 'Rezervasyon başarısız');
      await refresh();
    } catch (e: any) {
      alert(e?.message || 'Rezervasyon başarısız');
    } finally {
      setBusy(false);
    }
  }
  async function unreserve(team: Team, pos: string) {
    try {
      setBusy(true);
      const r = await fetch(`${API_URL}/matches/${m!.id}/reserve/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ team, pos }),
      });
      if (handle401(r.status)) return;
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j?.ok !== true) throw new Error(j?.message || 'Rezerv kaldırma başarısız');
      await refresh();
    } catch (e: any) {
      alert(e?.message || 'Rezerv kaldırma başarısız');
    } finally {
      setBusy(false);
    }
  }

  // Maçı düzenle – SADECE owner
  async function saveMatchEdit() {
    if (!m) return;
    try {
      setSavingEdit(true);

      let body: any;
      if (isOwner) {
        body = {
          title: editForm.title || null,
          location: editForm.location || null,
          level: editForm.level || null,
          format: editForm.format || null,
          price: editForm.price === '' ? null : Number(editForm.price),
          time: editForm.time ? new Date(editForm.time).toISOString() : null,
        };
      } else {
        // TAKIM ADMINI: sadece konum + zaman
        body = {
          location: editForm.location || null,
          time: editForm.time ? new Date(editForm.time).toISOString() : null,
        };
      }

      const r = await fetch(`${API_URL}/matches/${m.id}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify(body),
      });

      if (r.status === 409) {
        const d = await r.json().catch(() => ({}));
        if (d?.message === 'format_locked') {
          alert('Bu maçta katılım var. Format değiştirilemez.');
          return;
        }
      }

      const data = await r.json().catch(() => ({}));
      if (!r.ok || data?.ok === false) {
        throw new Error(data?.message || `HTTP ${r.status}`);
      }

      setEditOpen(false);
      await refresh();
    } catch (e: any) {
      alert(e?.message || 'Kaydetme hatası');
    } finally {
      setSavingEdit(false);
    }
  }

  if (loading) return <div className="p-6 text-sm text-neutral-400">Yükleniyor…</div>;
  if (!m) return <div className="p-6 text-sm text-red-400">Maç bulunamadı</div>;

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      {/* Üst bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/landing"
            className="inline-flex items-center gap-2 rounded-lg bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
          >
            ← Ana menü
          </Link>
          <div className="flex items-center gap-2 text-base font-semibold">
            <span>{m.title || 'Maç'}</span>
            {m.inviteOnly ? (
              <span className="rounded bg-neutral-700 px-2 py-0.5 text-xs">Kilitli</span>
            ) : null}
          </div>
        </div>

        {/* Sağ taraf: Arkadaşlar + Aksiyonlar */}
        <div className="flex items-center gap-2">
          <Link
            href="/friends"
            className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
            title="Arkadaşlar"
          >
            Arkadaşlar
          </Link>

          <Link
            href="/invites"
            className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
            title="Davetler"
          >
            Davetler
          </Link>

          {/* SADECE SAHİP: Düzenle */}
          {isOwner && (
            <button
              onClick={() => setEditOpen(true)}
              className="rounded-xl bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
            >
              Düzenle
            </button>
          )}

          {/* TAKIM MAÇI — SAHİP DEĞİL ama canEdit: Saat & Tarih Öner */}
          {m.createdFrom === 'TEAM_MATCH' && !isOwner && canEdit && (
            <button
              onClick={() => setSuggestOpen(true)}
              className="rounded-xl bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
            >
              Saat & Tarih Öner
            </button>
          )}

          {/* SADECE SAHİP: Kilit */}
          {isOwner && (
            <button
              onClick={toggleLock}
              disabled={locking}
              className={`rounded-xl px-3 py-1.5 text-sm ${
                m.inviteOnly ? 'bg-rose-700 hover:bg-rose-600' : 'bg-neutral-800 hover:bg-neutral-700'
              }`}
              title="Kilit: Sadece davetle katılım"
            >
              {locking ? '...' : m.inviteOnly ? 'Kilit Aç' : 'Kilit Kapat'}
            </button>
          )}
        </div>
      </div>

      <div className="text-xs text-neutral-300">
        {m.location || '—'} • {m.format || '—'} • {m.level || '—'}
        {m.price != null ? <> • Fiyat: ₺{m.price}</> : null}
        {m.time ? (
          <>
            {' '}
            • Saat: {fmtDate(m.time)}
          </>
        ) : null}
        <> • ID: {m.id}</>
      </div>

      {/* Aksiyon barı */}
      <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            Senin durumun:{' '}
            {mySlot ? (
              <span className="text-emerald-400">
                Takım {mySlot.team} • Pozisyon: {labelPos(mySlot.pos)}
              </span>
            ) : (
              <span className="text-neutral-400">Henüz katılmadın</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!mySlot ? (
              <>
                <button
                  onClick={() => joinTeam('A')}
                  disabled={busy || isFullA}
                  title={isFullA ? 'Takım A dolu (yedek olabilirsiniz)' : ''}
                  className="rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-medium text-neutral-950 hover:bg-emerald-500 disabled:opacity-50"
                >
                  Takım A’ya katıl
                </button>
                <button
                  onClick={() => joinTeam('B')}
                  disabled={busy || isFullB}
                  title={isFullB ? 'Takım B dolu (yedek olabilirsiniz)' : ''}
                  className="rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-medium text-neutral-950 hover:bg-blue-500 disabled:opacity-50"
                >
                  Takım B’ye katıl
                </button>

                {/* Takım doluysa ve boş SUB varsa yedek katılım */}
                {isFullA && canSubA && (
                  <button
                    onClick={() => joinAsSub('A')}
                    disabled={busy}
                    className="rounded-xl bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
                  >
                    Yedek ol (A)
                  </button>
                )}
                {isFullB && canSubB && (
                  <button
                    onClick={() => joinAsSub('B')}
                    disabled={busy}
                    className="rounded-xl bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
                  >
                    Yedek ol (B)
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={leave}
                disabled={busy}
                className="rounded-xl bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700 disabled:opacity-50"
              >
                Ayrıl
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Takımlar: A ve B */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Takım A */}
        <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
          <div className="mb-2 text-sm font-semibold">Takım A</div>
          <div className="flex flex-wrap gap-2">
            {teamA.map((s, idx) => {
              const isMine = s.userId === me;
              const isEmpty = isFree(s);

              const badgeIcon =
                s.placeholder === 'ADMIN' ? (
                  <Shield className="ml-1 size-3.5 opacity-80" aria-label="Admin rezervi" />
                ) : s.placeholder === 'GUEST' ? (
                  <UserPlus className="ml-1 size-3.5 opacity-80" aria-label="Misafir (+1)" />
                ) : null;

              const baseCls =
                'rounded-full px-3 py-1 text-sm border select-none inline-flex items-center gap-2';
              const stateCls = isMine
                ? 'border-emerald-400 text-emerald-400'
                : isEmpty
                ? 'border-white/30 text-white/90 hover:border-white/60 cursor-pointer'
                : 'border-white/10 text-white/40';

              return (
                <span
                  key={`A-${idx}-${s.pos}`}
                  className={`${baseCls} ${stateCls}`}
                  title={
                    isMine
                      ? 'Senin pozisyonun'
                      : isEmpty
                      ? 'Boş — tıkla'
                      : s.placeholder === 'ADMIN'
                      ? 'Admin rezervi'
                      : s.placeholder === 'GUEST'
                      ? 'Misafir rezervi (+1)'
                      : 'Dolu'
                  }
                  onClick={() => {
                    if (isEmpty && !mySlot && !busy) joinSpecific('A', s.pos);
                  }}
                >
                  {labelPos(s.pos)}
                  {badgeIcon}

                  {isEmpty ? (
                    <span className="ml-2 inline-flex gap-1">
                      {canAdmin(m, me) && (
                        <button
                          title="Admin rezervi"
                          className="rounded bg-neutral-700/70 p-1 hover:bg-neutral-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            reserve('A', s.pos, 'ADMIN');
                          }}
                        >
                          <Shield className="size-3.5" />
                        </button>
                      )}
                      <button
                        title="Misafir rezervi (+1)"
                        className="rounded bg-neutral-700/70 p-1 hover:bg-neutral-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          reserve('A', s.pos, 'GUEST');
                        }}
                      >
                        <UserPlus className="size-3.5" />
                      </button>
                    </span>
                  ) : s.placeholder ? (
                    <button
                      className="ml-2 text-[10px] underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        unreserve('A', s.pos);
                      }}
                    >
                      Kaldır
                    </button>
                  ) : null}
                </span>
              );
            })}
          </div>
        </div>

        {/* Takım B */}
        <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
          <div className="mb-2 text-sm font-semibold">Takım B</div>
          <div className="flex flex-wrap gap-2">
            {teamB.map((s, idx) => {
              const isMine = s.userId === me;
              const isEmpty = isFree(s);

              const badgeIcon =
                s.placeholder === 'ADMIN' ? (
                  <Shield className="ml-1 size-3.5 opacity-80" aria-label="Admin rezervi" />
                ) : s.placeholder === 'GUEST' ? (
                  <UserPlus className="ml-1 size-3.5 opacity-80" aria-label="Misafir (+1)" />
                ) : null;

              const baseCls =
                'rounded-full px-3 py-1 text-sm border select-none inline-flex items-center gap-2';
              const stateCls = isMine
                ? 'border-emerald-400 text-emerald-400'
                : isEmpty
                ? 'border-white/30 text-white/90 hover:border-white/60 cursor-pointer'
                : 'border-white/10 text-white/40';

              return (
                <span
                  key={`B-${idx}-${s.pos}`}
                  className={`${baseCls} ${stateCls}`}
                  title={
                    isMine
                      ? 'Senin pozisyonun'
                      : isEmpty
                      ? 'Boş — tıkla'
                      : s.placeholder === 'ADMIN'
                      ? 'Admin rezervi'
                      : s.placeholder === 'GUEST'
                      ? 'Misafir rezervi (+1)'
                      : 'Dolu'
                  }
                  onClick={() => {
                    if (isEmpty && !mySlot && !busy) joinSpecific('B', s.pos);
                  }}
                >
                  {labelPos(s.pos)}
                  {badgeIcon}

                  {isEmpty ? (
                    <span className="ml-2 inline-flex gap-1">
                      {canAdmin(m, me) && (
                        <button
                          title="Admin rezervi"
                          className="rounded bg-neutral-700/70 p-1 hover:bg-neutral-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            reserve('B', s.pos, 'ADMIN');
                          }}
                        >
                          <Shield className="size-3.5" />
                        </button>
                      )}
                      <button
                        title="Misafir rezervi (+1)"
                        className="rounded bg-neutral-700/70 p-1 hover:bg-neutral-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          reserve('B', s.pos, 'GUEST');
                        }}
                      >
                        <UserPlus className="size-3.5" />
                      </button>
                    </span>
                  ) : s.placeholder ? (
                    <button
                      className="ml-2 text-[10px] underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        unreserve('B', s.pos);
                      }}
                    >
                      Kaldır
                    </button>
                  ) : null}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Düzenleme Modalı */}
      {canEdit && editOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-md space-y-2 rounded-2xl bg-neutral-900 p-4 ring-1 ring-white/10">
            <div className="text-base font-semibold">Maçı Düzenle</div>

            {isOwner ? (
              <>
                <input
                  className="w-full rounded bg-neutral-800 px-3 py-2"
                  placeholder="Başlık"
                  value={editForm.title}
                  onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
                />
                <input
                  className="w-full rounded bg-neutral-800 px-3 py-2"
                  placeholder="Konum"
                  value={editForm.location}
                  onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
                />
                <input
                  className="w-full rounded bg-neutral-800 px-3 py-2"
                  placeholder="Seviye (Kolay/Orta/Zor)"
                  value={editForm.level}
                  onChange={(e) => setEditForm((f) => ({ ...f, level: e.target.value }))}
                />
                <input
                  className="w-full rounded bg-neutral-800 px-3 py-2"
                  placeholder="Format (5v5 / 7v7 / 9v9 / 11v11)"
                  value={editForm.format}
                  onChange={(e) => setEditForm((f) => ({ ...f, format: e.target.value }))}
                />
                <input
                  className="w-full rounded bg-neutral-800 px-3 py-2"
                  type="number"
                  placeholder="Fiyat"
                  value={editForm.price as any}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      price: e.target.value === '' ? '' : Number(e.target.value),
                    }))
                  }
                />
                <input
                  className="w-full rounded bg-neutral-800 px-3 py-2"
                  type="datetime-local"
                  value={editForm.time}
                  onChange={(e) => setEditForm((f) => ({ ...f, time: e.target.value }))}
                />
              </>
            ) : (
              <>
                {/* OWNER DEĞİLSE: sadece Konum + Tarih/Saat */}
                <input
                  className="w-full rounded bg-neutral-800 px-3 py-2"
                  placeholder="Konum"
                  value={editForm.location}
                  onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
                />
                <input
                  className="w-full rounded bg-neutral-800 px-3 py-2"
                  type="datetime-local"
                  value={editForm.time}
                  onChange={(e) => setEditForm((f) => ({ ...f, time: e.target.value }))}
                />
              </>
            )}

            <div className="mt-2 flex justify-end gap-2">
              <button
                onClick={() => setEditOpen(false)}
                className="rounded-xl bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
              >
                İptal
              </button>
              <button
                onClick={saveMatchEdit}
                disabled={savingEdit}
                className="rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-medium text-neutral-950 hover:bg-emerald-500 disabled:opacity-50"
              >
                {savingEdit ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Saat & Tarih Öner Modalı */}
      {m.createdFrom === 'TEAM_MATCH' && !isOwner && canEdit && suggestOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-md space-y-2 rounded-2xl bg-neutral-900 p-4 ring-1 ring-white/10">
            <div className="text-base font-semibold">Saat & Tarih Öner</div>

            <input
              className="w-full rounded bg-neutral-800 px-3 py-2"
              type="datetime-local"
              value={suggestWhen}
              onChange={(e) => setSuggestWhen(e.target.value)}
            />

            <div className="mt-2 flex justify-end gap-2">
              <button
                onClick={() => setSuggestOpen(false)}
                className="rounded-xl bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
              >
                İptal
              </button>
              <button
                onClick={sendTimeSuggestion}
                disabled={!suggestWhen || suggestSending}
                className="rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-medium text-neutral-950 hover:bg-emerald-500 disabled:opacity-50"
              >
                {suggestSending ? 'Gönderiliyor…' : 'Gönder'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Davet mini + (Owner için Access) + Öneriler + Sohbet */}
      <InviteMini matchId={m.id} onOpenInvite={() => setInviteOpen(true)} />
      {isOwner ? <AccessRequestsPanel matchId={m.id} /> : null}

      {/* Saat & Tarih Önerileri paneli (herkes görebilir, owner uygulayabilir) */}
      {/* SADECE NORMAL MAÇTA: TimeProposalsPanel */}
      {m.createdFrom !== 'TEAM_MATCH' && (
        <TimeProposalsPanel matchId={m.id} isOwner={isOwner} onApplied={refresh} />
      )}

      {/* İhtiyaç seçiciler */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-xs text-neutral-400">İhtiyaç odağı:</div>
        <select
          className="rounded-lg border border-white/10 bg-neutral-900 px-2 py-1 text-sm"
          value={focusTeam}
          onChange={(e) => setFocusTeam(e.target.value as any)}
        >
          <option value="ANY">Takım (hepsi)</option>
          <option value="A">Takım A</option>
          <option value="B">Takım B</option>
        </select>
        <select
          className="rounded-lg border border-white/10 bg-neutral-900 px-2 py-1 text-sm"
          value={focusPos}
          onChange={(e) => setFocusPos(e.target.value)}
        >
          <option value="ANY">Pozisyon (hepsi)</option>
          {[...new Set([...needA, ...needB])].map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      <RecommendedPanel matchId={m.id} needPos={focusPos} team={focusTeam} />

      <InviteFriendsClient open={inviteOpen} onClose={() => setInviteOpen(false)} matchId={m.id} />
      <MatchChat matchId={m.id} />
      {/* Saat & Tarih Önerileri - SADECE TAKIM MAÇLARI */}
      {currentUserId && m.createdFrom === 'TEAM_MATCH' && (
        <div className="mt-6">
          <MatchProposalsSection matchId={id} currentUserId={currentUserId} />
        </div>
      )}
    </div>
  );
}

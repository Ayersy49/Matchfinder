// app/match/[id]/MatchDetailClient.tsx
'use client';

import * as React from 'react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/* ===================== Ortak yardımcılar ===================== */
type Team = 'A' | 'B';

type Slot = {
  team: Team;         // "A" | "B"
  pos: string;        // "GK" | "CB" | ...
  userId?: string | null;
};

type MatchDetail = {
  id: string;
  title: string | null;
  location: string | null;
  level: string | null;
  format: string | null;
  price: number | null;
  time: string | null;
  slots: Slot[];
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

function getToken(): string {
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

function myId(): string | null {
  try {
    const t = getToken();
    if (!t) return null;
    const p = JSON.parse(atob(t.split('.')[1] || ''));
    return p?.id || p?.sub || p?.userId || null;
  } catch {
    return null;
  }
}

/* ======================= Mini Davet Paneli ======================= */
function InviteMini({ matchId }: { matchId: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
      <div className="mb-2 text-sm font-medium">Arkadaş çağır</div>
      <div className="text-xs text-neutral-300 mb-3">
        Yakındaki oyuncuları keşfet ve bu maça davet et.
      </div>
      <div className="flex gap-2">
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

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString([], {
      year: '2-digit',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const fetchMessages = React.useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/matches/${matchId}/messages?limit=50`, {
        headers: { Authorization: `Bearer ${getToken()}` },
        cache: 'no-store',
      });
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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ text }),
      });
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

  async function saveEdit() {
    if (!editId) return;
    const text = editText.trim();
    if (!text) return;

    setItems((prev) =>
      prev.map((m) => (m.id === editId ? { ...m, text, editedAt: new Date().toISOString() } : m)),
    );

    try {
      const r = await fetch(`${API_URL}/matches/${matchId}/messages/${editId}/edit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ text }),
      });
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
        headers: { Authorization: `Bearer ${getToken()}` },
      });
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

      {/* Messages */}
      <div className="h-72 overflow-auto p-3 space-y-3">
        {loading ? (
          <div className="text-sm text-neutral-400">Yükleniyor…</div>
        ) : !items.length ? (
          <div className="text-sm text-neutral-400">Henüz mesaj yok.</div>
        ) : (
          items.map((m) => {
            const isMine = m.userId === me;

            // Düzenleme modunda
            if (editId === m.id && !m.deleted) {
              return (
                <div key={m.id} className="flex justify-start">
                  <div className="max-w-xl rounded-2xl bg-[#10151c] ring-1 ring-white/10 shadow-sm px-3 py-2 text-left w-full">
                    <div className="mb-1 flex items-center gap-2">
                      <span className={`text-xs font-medium ${isMine ? 'text-emerald-300' : 'text-zinc-300'}`}>
                        {isMine ? 'Siz' : 'Oyuncu'}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        className="flex-1 rounded-lg bg-[#0f141b] px-2 py-1 text-sm ring-1 ring-white/10 outline-none"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit();
                          if (e.key === 'Escape') {
                            setEditId(null);
                            setEditText('');
                          }
                        }}
                        autoFocus
                      />
                      <button onClick={saveEdit} className="text-xs px-2 py-1 rounded bg-emerald-600/90 hover:bg-emerald-600">
                        Kaydet
                      </button>
                      <button
                        onClick={() => {
                          setEditId(null);
                          setEditText('');
                        }}
                        className="text-xs px-2 py-1 rounded bg-neutral-800/80 hover:bg-neutral-800"
                      >
                        Vazgeç
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            // Normal mesaj
            return (
              <div key={m.id} className="flex justify-start">
                <div className="max-w-xl rounded-2xl bg-[#10151c] ring-1 ring-white/10 shadow-sm px-3 py-2 text-left w-full">
                  <div className="mb-1 flex items-center gap-2">
                    <span className={`text-xs font-medium ${isMine ? 'text-emerald-300' : 'text-zinc-300'}`}>
                      {isMine ? 'Siz' : 'Oyuncu'}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                          <button onClick={() => remove(m.id)} className="text-[11px] text-rose-300 hover:underline">
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

      {/* Input */}
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

/* ==================== DETAY SAYFASI ==================== */
export default function MatchDetailClient({ id }: { id: string }) {
  const me = myId();

  const [m, setM] = React.useState<MatchDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/matches/${id}`, { cache: 'no-store' });
      const data = await r.json();
      const slots: Slot[] = Array.isArray(data?.slots) ? data.slots : [];
      setM({ ...data, slots });
    } catch (e) {
      console.error(e);
      setM(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const mySlot = m?.slots?.find((s) => s.userId === me) || null;
  const teamA = (m?.slots || []).filter((s) => s.team === 'A');
  const teamB = (m?.slots || []).filter((s) => s.team === 'B');

  /** Tercihler uygunsa takıma otomatik katılma (pozisyon göndermeden).
   * Tercihler doluysa backend 409 döner ve kullanıcıdan detaydan slot seçmesi istenir.
   */
  async function joinTeam(team: Team) {
    try {
      setBusy(true);
      const r = await fetch(`${API_URL}/matches/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ matchId: id, team }), // sadece takım; pos yok → tercih kontrolü
      });
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

  /** Belirli bir pozisyona, belirtilen takımda katıl. */
  async function joinSpecific(team: Team, pos: string) {
    try {
      setBusy(true);
      const r = await fetch(`${API_URL}/matches/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ matchId: id, pos, team }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.message || 'Katılım başarısız');
      await refresh();
    } catch (e: any) {
      alert(e?.message || 'Katılım başarısız');
    } finally {
      setBusy(false);
    }
  }

  /** Eski (takım fark etmeyen) katılma – gerekirse kullanırız */
  async function join(pos?: string) {
    try {
      setBusy(true);
      const r = await fetch(`${API_URL}/matches/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ matchId: id, pos }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (r.status === 409 && data?.message === 'no preferred open slot') {
          alert('Tercih ettiğin pozisyonlar dolu. Lütfen alttan boş bir pozisyon seç.');
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

  async function leave() {
    try {
      setBusy(true);
      const r = await fetch(`${API_URL}/matches/${id}/leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getToken()}`,
        },
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data?.ok) throw new Error(data?.message || 'Ayrılma başarısız');
      await refresh();
    } catch (e: any) {
      alert(e?.message || 'Ayrılma başarısız');
    } finally {
      setBusy(false);
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
          <div className="text-base font-semibold">{m.title || 'Maç'}</div>
        </div>

        <div className="text-xs text-neutral-300">
          {m.location || '—'} • {m.format || '—'} • {m.level || '—'}
          {m.price != null ? <> • Fiyat: ₺{m.price}</> : null}
          {m.time ? (
            <>
              {' '}
              • Saat:{' '}
              {new Date(m.time).toLocaleString([], {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </>
          ) : null}
          <> • ID: {m.id}</>
        </div>
      </div>

      {/* Aksiyon barı */}
      <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            Senin durumun:{' '}
            {mySlot ? (
              <span className="text-emerald-400">
                Takım {mySlot.team} • Pozisyon: {mySlot.pos}
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
                  disabled={busy}
                  className="rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-medium text-neutral-950 hover:bg-emerald-500 disabled:opacity-50"
                >
                  Takım A’ya katıl
                </button>
                <button
                  onClick={() => joinTeam('B')}
                  disabled={busy}
                  className="rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-medium text-neutral-950 hover:bg-blue-500 disabled:opacity-50"
                >
                  Takım B’ye katıl
                </button>
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
              const isEmpty = !s.userId;
              const classes = [
                'rounded-full px-3 py-1 text-sm border select-none',
                isMine
                  ? 'border-emerald-400 text-emerald-400'
                  : isEmpty
                  ? 'border-white/30 text-white/90 hover:border-white/60 cursor-pointer'
                  : 'border-white/10 text-white/40',
              ].join(' ');
              return (
                <span
                  key={`A-${idx}-${s.pos}`}
                  className={classes}
                  title={
                    isMine
                      ? 'Senin pozisyonun'
                      : isEmpty
                      ? 'Boş — tıkla ve bu pozisyona katıl'
                      : 'Dolu'
                  }
                  onClick={() => {
                    if (isEmpty && !mySlot && !busy) joinSpecific('A', s.pos);
                  }}
                >
                  {s.pos}
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
              const isEmpty = !s.userId;
              const classes = [
                'rounded-full px-3 py-1 text-sm border select-none',
                isMine
                  ? 'border-emerald-400 text-emerald-400'
                  : isEmpty
                  ? 'border-white/30 text-white/90 hover:border-white/60 cursor-pointer'
                  : 'border-white/10 text-white/40',
              ].join(' ');
              return (
                <span
                  key={`B-${idx}-${s.pos}`}
                  className={classes}
                  title={
                    isMine
                      ? 'Senin pozisyonun'
                      : isEmpty
                      ? 'Boş — tıkla ve bu pozisyona katıl'
                      : 'Dolu'
                  }
                  onClick={() => {
                    if (isEmpty && !mySlot && !busy) joinSpecific('B', s.pos);
                  }}
                >
                  {s.pos}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Davet mini + Sohbet */}
      <InviteMini matchId={m.id} />
      <MatchChat matchId={m.id} />
    </div>
  );
}

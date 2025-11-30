"use client";

import * as React from "react";
import Link from "next/link";
import { authHeader, myId, clearToken } from "@/lib/auth";

/* =================== Ayarlar =================== */
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/* =================== Tipler =================== */
type MiniUser = { id: string; phone?: string | null; name?: string | null };

type FriendRequestRow = {
  id: string;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED";
  message?: string | null;
  createdAt: string;
  from?: MiniUser | null;
  to?: MiniUser | null;
};

type FriendshipRow = {
  id: string;                  // other user's id
  phone?: string | null;       // opsiyonel
  since?: string;              // opsiyonel (backend 'since' döndürüyor olabilir)
  userId?: string;             // eski/opsiyonel
  friendId?: string;           // eski/opsiyonel
  createdAt?: string;          // eski/opsiyonel
  other?: MiniUser | null;     // varsa direkt kullan
};


/* =================== 401 helper =================== */
function handle401(status: number) {
  if (status === 401) {
    clearToken?.();
    alert("Oturum gerekli veya süresi doldu. Lütfen tekrar giriş yapın.");
    window.location.href = "/";
    return true;
  }
  return false;
}

/* =================== Sayfa =================== */
export default function FriendsPage() {
  const meId = myId();

  // Form state
  const [phone, setPhone] = React.useState("");
  const [toUserId, setToUserId] = React.useState("");
  const [msg, setMsg] = React.useState("");
  const [sending, setSending] = React.useState(false);

  // Search state
  const [searchQ, setSearchQ] = React.useState("");
  const [searchResults, setSearchResults] = React.useState<any[]>([]);
  const [searching, setSearching] = React.useState(false);

  async function handleSearch() {
    if (searchQ.length < 3) return;
    setSearching(true);
    try {
      const r = await fetch(`${API_URL}/users/search?q=${encodeURIComponent(searchQ)}`, {
        headers: authHeader()
      });
      const data = await r.json();
      if (data.ok) setSearchResults(data.items);
    } catch (e) { console.error(e); }
    finally { setSearching(false); }
  }

  // Listeler
  const [friends, setFriends] = React.useState<FriendshipRow[]>([]);
  const [incoming, setIncoming] = React.useState<FriendRequestRow[]>([]);
  const [sent, setSent] = React.useState<FriendRequestRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  /* --------- Yükle / yenile --------- */
  const reload = React.useCallback(async () => {
    setLoading(true);
    try {
      const hdr = authHeader();

      // >>> SADECE PENDING isteklere bakıyoruz
      const q = "status=PENDING";

      const [rF, rIn, rOut] = await Promise.all([
        fetch(`${API_URL}/friends`, { headers: { ...hdr }, cache: "no-store" }),
        fetch(`${API_URL}/friends/requests/incoming?${q}`, {
          headers: { ...hdr },
          cache: "no-store",
        }),
        fetch(`${API_URL}/friends/requests/sent?${q}`, {
          headers: { ...hdr },
          cache: "no-store",
        }),
      ]);

      if (handle401(rF.status) || handle401(rIn.status) || handle401(rOut.status)) return;

      const dF = await rF.json().catch(() => ({}));
      const dIn = await rIn.json().catch(() => ({}));
      const dOut = await rOut.json().catch(() => ({}));

      setFriends(Array.isArray(dF?.items) ? dF.items : []);
      setIncoming(Array.isArray(dIn?.items) ? dIn.items : []);
      setSent(Array.isArray(dOut?.items) ? dOut.items : []);
    } catch {
      // sessiz geç
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    reload();
  }, [reload]);

  /* --------- Aksiyonlar --------- */
  async function sendRequest() {
    if (sending) return;
    const toPhone = phone.replace(/\D/g, "");
    const hasPhone = !!toPhone;
    const hasId = !!toUserId.trim();

    if (!hasPhone && !hasId) {
      alert("Telefon (5xx...) ya da kullanıcı ID girin.");
      return;
    }

    setSending(true);
    try {
      const r = await fetch(`${API_URL}/friends/requests`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          toPhone: hasPhone ? toPhone : undefined,
          toUserId: hasId ? toUserId.trim() : undefined,
          message: msg.trim() || undefined,
        }),
      });
      if (handle401(r.status)) return;
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.message || "İstek gönderilemedi.");

      setPhone("");
      setToUserId("");
      setMsg("");
      await reload();
      alert("İstek gönderildi.");
    } catch (e: any) {
      alert(e?.message || "İstek gönderilemedi.");
    } finally {
      setSending(false);
    }
  }

  async function respond(inviteId: string, action: "ACCEPT" | "DECLINE") {
    try {
      const r = await fetch(`${API_URL}/friends/requests/${inviteId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ action }),
      });
      if (handle401(r.status)) return;
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.message || "İşlem başarısız.");

      // Kabul/ret sonrası listeleri tazele → pending olmayanlar görünmez
      await reload();
    } catch (e: any) {
      alert(e?.message || "İşlem başarısız.");
    }
  }

  async function cancel(inviteId: string) {
    try {
      const r = await fetch(`${API_URL}/friends/requests/${inviteId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ action: "CANCEL" }),
      });
      if (handle401(r.status)) return;
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.message || "İşlem başarısız.");
      await reload();
    } catch (e: any) {
      alert(e?.message || "İşlem başarısız.");
    }
  }

  async function unfriend(otherUserId: string) {
    if (!confirm("Bu kişiyi arkadaşlarından kaldırmak istiyor musun?")) return;
    try {
      const r = await fetch(`${API_URL}/friends/${otherUserId}/remove`, {
        method: "POST",
        headers: { ...authHeader() },
      });
      if (handle401(r.status)) return;
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.message || "Kaldırılamadı.");
      await reload();
    } catch (e: any) {
      alert(e?.message || "Kaldırılamadı.");
    }
  }

  /* --------- Görünüm yardımcıları --------- */
  const nameOf = (u?: MiniUser | null) => u?.name || u?.phone || u?.id || "—";

  function otherOf(row: FriendshipRow): MiniUser {
    if (row.other) return row.other;
    return { id: row.id, phone: row.phone ?? null, name: null };
  }

  const sendingDisabled = sending || (!phone.replace(/\D/g, "") && !toUserId.trim());

  /* =================== UI =================== */
  return (
    <div className="mx-auto max-w-5xl p-4 text-white">
      {/* Üst çubuk */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            href="/landing"
            className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
          >
            ← Ana menü
          </Link>
          <div className="text-lg font-semibold">Arkadaşlar</div>
        </div>

        <Link
          href="/invites"
          className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
        >
          Davetler
        </Link>
      </div>

      {/* Kullanıcı Arama */}
      <div className="mb-4 rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
        <div className="mb-2 text-sm font-medium">Kullanıcı Ara</div>
        <div className="flex gap-2">
          <input
            placeholder="Kullanıcı adı, isim veya telefon..."
            className="flex-1 rounded-lg bg-neutral-800 px-3 py-2 text-sm outline-none ring-1 ring-white/10"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button
            onClick={handleSearch}
            disabled={searching}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500"
          >
            {searching ? '...' : 'Ara'}
          </button>
        </div>

        {/* Sonuçlar */}
        {searchResults.length > 0 && (
          <div className="mt-3 space-y-2">
            {searchResults.map(u => (
              <div key={u.id} className="flex items-center justify-between rounded-lg bg-neutral-800 px-3 py-2 text-sm">
                <div>
                  <div className="font-medium">{u.name || u.username || 'İsimsiz'}</div>
                  <div className="text-xs text-neutral-400">@{u.username}</div>
                </div>
                <Link href={`/player/${u.id}`} className="rounded bg-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-600">
                  Profili Gör
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Yeni istek formu */}
      <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
        <div className="mb-2 text-sm font-medium">Yeni Arkadaş İsteği</div>
        <div className="grid gap-2 md:grid-cols-3">
          <input
            placeholder="Telefon (5xx...)"
            className="rounded-lg bg-neutral-800 px-3 py-2 text-sm outline-none ring-1 ring-white/10"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <input
            placeholder="Kullanıcı ID (opsiyonel)"
            className="rounded-lg bg-neutral-800 px-3 py-2 text-sm outline-none ring-1 ring-white/10"
            value={toUserId}
            onChange={(e) => setToUserId(e.target.value)}
          />
          <input
            placeholder="Mesaj (opsiyonel)"
            className="rounded-lg bg-neutral-800 px-3 py-2 text-sm outline-none ring-1 ring-white/10"
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
          />
        </div>
        <div className="mt-3">
          <button
            disabled={sendingDisabled}
            onClick={sendRequest}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-emerald-500 disabled:opacity-50"
          >
            {sending ? "Gönderiliyor…" : "İstek Gönder"}
          </button>
        </div>
      </div>

      {/* Listeler */}
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {/* Arkadaşlarım */}
        <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
          <div className="mb-2 text-sm font-semibold">Arkadaşlarım</div>
          {loading ? (
            <div className="text-sm text-neutral-400">Yükleniyor…</div>
          ) : !friends.length ? (
            <div className="text-sm text-neutral-400">Henüz arkadaşın yok.</div>
          ) : (
            <div className="space-y-2">
              {friends.map((f) => {
                const other = otherOf(f);
                return (
                  <div
                    key={f.id}
                    className="flex items-center justify-between rounded-lg bg-neutral-800 px-3 py-2 text-sm"
                  >
                    <div>{nameOf(other)}</div>
                    <div className="flex gap-2">
                      <Link
                        href={`/messages/${other.id}`}
                        className="rounded bg-emerald-700 px-2 py-1 text-xs hover:bg-emerald-600"
                      >
                        Mesaj
                      </Link>
                      <Link
                        href={`/player/${other.id}`}
                        className="rounded bg-neutral-700 px-2 py-1 text-xs hover:bg-neutral-600"
                      >
                        Profili Gör
                      </Link>
                      <button
                        onClick={() => unfriend(other.id)}
                        className="rounded bg-rose-700 px-2 py-1 text-xs hover:bg-rose-600"
                      >
                        Kaldır
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Gelen istekler (yalnızca PENDING) */}
        <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
          <div className="mb-2 text-sm font-semibold">Gelen İstekler</div>
          {loading ? (
            <div className="text-sm text-neutral-400">Yükleniyor…</div>
          ) : !incoming.length ? (
            <div className="text-sm text-neutral-400">Gelen istek yok.</div>
          ) : (
            <div className="space-y-2">
              {incoming.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-lg bg-neutral-800 px-3 py-2 text-sm"
                >
                  <div>
                    <div className="font-medium">{nameOf(r.from)}</div>
                    {r.message && (
                      <div className="text-xs text-neutral-300">“{r.message}”</div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => respond(r.id, "ACCEPT")}
                      className="rounded bg-emerald-600 px-2 py-1 text-xs hover:bg-emerald-500"
                    >
                      Kabul
                    </button>
                    <button
                      onClick={() => respond(r.id, "DECLINE")}
                      className="rounded bg-neutral-700 px-2 py-1 text-xs hover:bg-neutral-600"
                    >
                      Reddet
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Gönderilen istekler (yalnızca PENDING) */}
        <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
          <div className="mb-2 text-sm font-semibold">Gönderilen İstekler</div>
          {loading ? (
            <div className="text-sm text-neutral-400">Yükleniyor…</div>
          ) : !sent.length ? (
            <div className="text-sm text-neutral-400">Gönderilen istek yok.</div>
          ) : (
            <div className="space-y-2">
              {sent.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-lg bg-neutral-800 px-3 py-2 text-sm"
                >
                  <div>
                    <div className="font-medium">{nameOf(r.to)}</div>
                    {/* İstersen göster: beklemede bilgisini */}
                    <div className="text-[11px] text-neutral-400">Durum: PENDING</div>
                  </div>
                  <button
                    onClick={() => cancel(r.id)}
                    className="rounded bg-neutral-700 px-2 py-1 text-xs hover:bg-neutral-600"
                  >
                    İptal
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

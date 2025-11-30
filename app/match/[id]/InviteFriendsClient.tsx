// app/match/[id]/InviteFriendsClient.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { authHeader } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type FriendRow = {
  id: string;
  phone: string | null;
  isLookingForMatch?: boolean;
};

type SuggestedRow = {
  id: string;
  phone?: string | null;
  distanceKm?: number;
  level?: number | null;
  positions?: string[] | null;
  isLookingForMatch?: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  matchId: string;
};

export default function InviteFriendsClient({ open, onClose, matchId }: Props) {
  const [tab, setTab] = React.useState<"FRIENDS" | "SUGGESTED" | "PHONE">("FRIENDS");

  // ortak durumlar
  const [loading, setLoading] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [message, setMessage] = React.useState("");

  // arkadaşlar
  const [friends, setFriends] = React.useState<FriendRow[]>([]);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set());

  // önerilenler
  const [suggested, setSuggested] = React.useState<SuggestedRow[]>([]);
  const [sugLoading, setSugLoading] = React.useState(false);

  // telefonla
  const [phone, setPhone] = React.useState("");

  // küçük yardımcılar
  const handle401 = (status: number) => {
    if (status === 401) {
      alert("Oturum gerekli veya süresi doldu. Lütfen tekrar giriş yapın.");
      return true;
    }
    return false;
  };
  const normalizePhone = (s: string) => s.replace(/\D/g, "");

  React.useEffect(() => {
    if (!open) return;
    void loadFriends();
  }, [open]);

  async function loadFriends() {
    try {
      setLoading(true);
      // Kabul edilmiş arkadaşlar: sende /friends veya /friends/accepted olabilir.
      const r = await fetch(`${API_URL}/friends`, {
        headers: { ...authHeader() },
        cache: "no-store",
      });
      const j = await r.json().catch(() => ({}));

      const items: any[] = Array.isArray(j?.items) ? j.items : Array.isArray(j) ? j : [];
      const rows: FriendRow[] = items.map((x: any) => ({
        id: String(x?.friendId || x?.id),
        phone: x?.friend?.phone ?? x?.phone ?? null,
        isLookingForMatch: !!x?.isLookingForMatch,
      }));
      setFriends(rows);
    } catch {
      setFriends([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadSuggested() {
    try {
      setSugLoading(true);
      const r = await fetch(`${API_URL}/matches/${matchId}/recommend-invites?limit=20`, {
        headers: { ...authHeader() },
        cache: "no-store",
      });
      const j = await r.json().catch(() => ({}));
      const items: any[] = Array.isArray(j?.items) ? j.items : [];
      const rows: SuggestedRow[] = items.map((x: any) => ({
        id: String(x?.id),
        phone: x?.phone ?? null,
        distanceKm: typeof x?.distanceKm === "number" ? x.distanceKm : undefined,
        level: typeof x?.level === "number" ? x.level : null,
        positions: Array.isArray(x?.positions) ? x.positions.map(String) : null,
        isLookingForMatch: !!x?.isLookingForMatch,
      }));
      setSuggested(rows);
    } catch {
      setSuggested([]);
    } finally {
      setSugLoading(false);
    }
  }

  // önerilenlere ilk geçişte yükle (lazy)
  React.useEffect(() => {
    if (!open) return;
    if (tab === "SUGGESTED" && suggested.length === 0 && !sugLoading) {
      void loadSuggested();
    }
  }, [tab, open]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  /* ================== GÖNDERİM FONKSİYONLARI ================== */

  // Tek request ile birden fazla kullanıcıya davet (backend toUserIds[] destekliyor)
  async function sendInvitesToUserIds(ids: string[]) {
    // Önce toplu dene
    let r = await fetch(`${API_URL}/matches/${matchId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ toUserIds: ids, message }),
    });

    if (handle401(r.status)) return;
    if (r.ok) {
      const j = await r.json().catch(() => ({}));
      if (j?.ok === false) throw new Error(j?.message || "Davet gönderilemedi");
      return;
    }

    // Olmazsa tek tek fallback
    for (const toUserId of ids) {
      const r2 = await fetch(`${API_URL}/matches/${matchId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ toUserId, message }),
      });
      if (handle401(r2.status)) return;
      const j2 = await r2.json().catch(() => ({}));
      if (!r2.ok || j2?.ok === false) throw new Error(j2?.message || "Davet gönderilemedi");
    }
  }

  async function sendInviteToPhone(p: string) {
    const digits = normalizePhone(p);
    if (!digits) throw new Error("Telefon numarası gerekli");
    const r = await fetch(`${API_URL}/matches/${matchId}/invite-phone`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ toPhone: digits, message }),
    });
    if (handle401(r.status)) return;
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j?.ok === false) throw new Error(j?.message || "Davet gönderilemedi");
  }

  async function onSend() {
    try {
      setSending(true);
      if (tab === "FRIENDS" || tab === "SUGGESTED") {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) throw new Error("En az bir kişi seçin");
        await sendInvitesToUserIds(ids);
        alert("Davet(ler) gönderildi.");
        setSelectedIds(new Set());
        onClose();
      } else {
        await sendInviteToPhone(phone);
        alert("Davet gönderildi.");
        setPhone("");
        onClose();
      }
    } catch (e: any) {
      alert(e?.message || "İşlem başarısız");
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-neutral-900 p-4 ring-1 ring-white/10">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-base font-semibold">Maça davet et</div>
          <button
            onClick={onClose}
            className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
          >
            Kapat
          </button>
        </div>

        {/* Sekmeler */}
        <div className="mb-3 flex gap-2">
          <button
            onClick={() => setTab("FRIENDS")}
            className={`rounded-lg px-3 py-1.5 text-sm ${tab === "FRIENDS" ? "bg-white/10" : "bg-neutral-800 hover:bg-neutral-700"
              }`}
          >
            Arkadaşlarım
          </button>
          <button
            onClick={() => setTab("SUGGESTED")}
            className={`rounded-lg px-3 py-1.5 text-sm ${tab === "SUGGESTED" ? "bg-white/10" : "bg-neutral-800 hover:bg-neutral-700"
              }`}
          >
            Önerilenler
          </button>
          <button
            onClick={() => setTab("PHONE")}
            className={`rounded-lg px-3 py-1.5 text-sm ${tab === "PHONE" ? "bg-white/10" : "bg-neutral-800 hover:bg-neutral-700"
              }`}
          >
            Telefonla
          </button>
        </div>

        {/* Mesaj (opsiyonel) */}
        <div className="mb-3">
          <input
            className="w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm"
            placeholder="Mesaj (opsiyonel)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>

        {/* FRIENDS */}
        {tab === "FRIENDS" && (
          <div className="rounded-xl border border-white/10">
            {loading ? (
              <div className="p-3 text-sm text-neutral-400">Yükleniyor…</div>
            ) : friends.length === 0 ? (
              <div className="p-3 text-sm text-neutral-400">Arkadaş yok.</div>
            ) : (
              <ul className="max-h-80 divide-y divide-white/5 overflow-auto">
                {friends.map((f) => {
                  const checked = selectedIds.has(f.id);
                  return (
                    <li key={f.id} className="flex items-center justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Link href={`/player/${f.id}`} target="_blank" className="text-sm font-medium hover:underline">
                            Kullanıcı
                          </Link>
                          {f.isLookingForMatch && (
                            <span className="relative flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-neutral-400">{f.phone || "—"}</div>
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(f.id)}
                        />
                        Seç
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* SUGGESTED */}
        {tab === "SUGGESTED" && (
          <div className="rounded-xl border border-white/10">
            {sugLoading ? (
              <div className="p-3 text-sm text-neutral-400">Yükleniyor…</div>
            ) : suggested.length === 0 ? (
              <div className="p-3 text-sm text-neutral-400">Uygun öneri bulunamadı.</div>
            ) : (
              <ul className="max-h-80 divide-y divide-white/5 overflow-auto">
                {suggested.map((p) => {
                  const checked = selectedIds.has(p.id);
                  return (
                    <li key={p.id} className="flex items-center justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Link href={`/player/${p.id}`} target="_blank" className="text-sm font-medium hover:underline">
                            Oyuncu {p.phone ? `• ${p.phone}` : ""}
                          </Link>
                          {p.isLookingForMatch && (
                            <span className="relative flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-neutral-400">
                          {typeof p.distanceKm === "number" && (
                            <span>~{p.distanceKm.toFixed(1)} km</span>
                          )}
                          {typeof p.level === "number" && <span>Lvl {p.level}</span>}
                          {p.positions && p.positions.length > 0 && (
                            <span>Pos: {p.positions.slice(0, 3).join(", ")}</span>
                          )}
                        </div>
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(p.id)}
                        />
                        Seç
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {/* PHONE */}
        {tab === "PHONE" && (
          <div className="rounded-xl border border-white/10 p-3">
            <div className="mb-2 text-sm">Telefon numarası (5xx…)</div>
            <input
              className="w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 text-sm"
              placeholder="Telefon (ör. 5051234567)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        )}

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
          >
            İptal
          </button>
          <button
            onClick={onSend}
            disabled={
              sending ||
              (tab !== "PHONE" && selectedIds.size === 0) ||
              (tab === "PHONE" && !phone.trim())
            }
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-neutral-950 hover:bg-emerald-500 disabled:opacity-50"
          >
            {sending ? "Gönderiliyor…" : "Davet Gönder"}
          </button>
        </div>
      </div>
    </div>
  );
}

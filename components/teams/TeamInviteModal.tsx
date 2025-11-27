"use client";
import * as React from "react";
import { postTeamInvites } from "@/lib/api";

type Props = {
  teamId: string;
  /** Controlled kullanım için (senin sayfanda var) */
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  /** Davetler başarıyla gönderilince çağrılır (liste/üyeler refresh etmek için) */
  onSent?: () => void | Promise<void>;
};

export default function TeamInviteModal(props: Props) {
  const { teamId, open, onOpenChange, onSent } = props;

  // uncontrolled fallback
  const [localOpen, setLocalOpen] = React.useState<boolean>(false);
  const isOpen = open ?? localOpen;
  const setOpen = onOpenChange ?? setLocalOpen;

  const [toUserIdsStr, setToUserIdsStr] = React.useState<string>("");
  const [toPhonesStr, setToPhonesStr] = React.useState<string>("");
  const [message, setMessage] = React.useState<string>("");
  const [sending, setSending] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  function parseList(input: string): string[] {
    return input
      .split(/[,\s;]+/g)
      .map(s => s.trim())
      .filter(Boolean);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const toUserIds = parseList(toUserIdsStr);
    const toPhones = parseList(toPhonesStr);

    if (!toUserIds.length && !toPhones.length) {
      setError("En az bir kullanıcı adı veya telefon numarası gir.");
      return;
    }

    try {
      setSending(true);
      const result = await postTeamInvites(teamId, { toUserIds, toPhones, message: message.trim() || undefined });
      // temizle
      setToUserIdsStr("");
      setToPhonesStr("");
      setMessage("");
      if (onSent) await onSent();
      setOpen(false);
    } catch (err: any) {
      setError(err?.message || "Davet gönderilemedi");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className={isOpen ? "" : "hidden"}>
      {/* backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60"
        onClick={() => setOpen(false)}
      />
      {/* modal */}
      <div className="fixed inset-0 z-50 grid place-items-center p-4">
        <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-neutral-900/90 p-4 shadow-xl backdrop-blur">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-base font-semibold">Oyuncu davet et</div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg bg-neutral-800 px-2 py-1 text-sm hover:bg-neutral-700"
            >
              Kapat
            </button>
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-neutral-300">
                Kullanıcı adı veya ID (virgül/boşlukla ayır)
              </label>
              <input
                value={toUserIdsStr}
                onChange={(e) => setToUserIdsStr(e.target.value)}
                placeholder="örn: ali_forvet, veli_kaleci..."
                className="w-full rounded-lg bg-neutral-800 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-neutral-300">
                Telefon numaraları (örn. 5xx..., virgül/boşlukla ayır)
              </label>
              <input
                value={toPhonesStr}
                onChange={(e) => setToPhonesStr(e.target.value)}
                placeholder="5551234567, 5559876543..."
                className="w-full rounded-lg bg-neutral-800 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-neutral-300">Mesaj (opsiyonel)</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Kısa bir not bırakabilirsin"
                className="w-full rounded-lg bg-neutral-800 px-3 py-2 text-sm"
                rows={3}
              />
            </div>

            {error && (
              <div className="rounded-lg bg-rose-500/15 p-2 text-sm text-rose-300 ring-1 ring-rose-500/30">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={sending}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-neutral-950 disabled:opacity-50 hover:bg-emerald-500"
              >
                {sending ? "Gönderiliyor…" : "Davetleri Gönder"}
              </button>
            </div>

            <div className="pt-1 text-[11px] text-neutral-400">
              * Kullanıcı adı veya telefon numarası ile davet gönderebilirsin.
              Sistem kayıtlı kullanıcıları otomatik eşleştirir.
              Aktif üyeler zaten listeden filtrelenir.
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

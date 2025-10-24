"use client";

import * as React from "react";
import { authHeader } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/* ---------- renk & yıldız yardımcıları (landing ile aynı) ---------- */
function colorToneFromValue(value: number) {
  if (value >= 5) return "text-sky-400";
  if (value >= 3) return "text-emerald-400";
  if (value === 2) return "text-amber-400";
  return "text-rose-500";
}
function RateStar({
  filled = false,
  tone,
  onClick,
  disabled = false,
}: {
  filled?: boolean;
  tone: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <span
      role="button"
      aria-hidden="true"
      onClick={disabled ? undefined : onClick}
      className={[
        "select-none text-lg",
        disabled ? "cursor-default opacity-40" : "cursor-pointer hover:scale-110 transition-transform",
        filled ? tone : "text-neutral-500/40",
      ].join(" ")}
    >
      ★
    </span>
  );
}
function TraitStars({
  value,
  set,
  disabled = false,
}: {
  value: number;
  set: (n: number) => void;
  disabled?: boolean;
}) {
  const tone = colorToneFromValue(value);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <RateStar key={n} filled={value >= n} tone={tone} onClick={() => set(n)} disabled={disabled} />
      ))}
    </div>
  );
}
function ScorePills({ value, set }: { value: number; set: (n: number) => void }) {
  const opts = Array.from({ length: 10 }, (_, i) => i + 1);
  return (
    <div role="radiogroup" aria-label="Oyun (1–10)" className="flex flex-wrap gap-1">
      {opts.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          onClick={() => set(n)}
          className={
            "h-7 w-7 rounded-md text-xs ring-1 ring-white/10 " +
            (value === n ? "bg-emerald-600 text-neutral-950" : "bg-neutral-800 text-neutral-200 hover:bg-neutral-700")
          }
        >
          {n}
        </button>
      ))}
    </div>
  );
}
function labelFor(k: "punctuality" | "respect" | "sportsmanship" | "swearing" | "aggression") {
  return (
    {
      punctuality: "Dakiklik",
      respect: "Saygı",
      sportsmanship: "Sportmenlik",
      swearing: "Küfür",
      aggression: "Agresiflik",
    } as const
  )[k];
}

/* ---------- Tipler ---------- */
type Player = { id: string; phone?: string | null; pos?: string | null };
export type RatePayload = { matchId: string; title?: string | null; players: Player[] };

export default function RateMatchModal({
  open,
  onClose,
  match,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  match: RatePayload | null;
  onSaved?: () => void;
}) {
  // kalan haklar (BE /ratings/:id/remaining’den)
  const [remaining, setRemaining] = React.useState<Record<string, number>>({});
  React.useEffect(() => {
    if (!open || !match?.matchId) return;
    fetch(`${API_URL}/ratings/${match.matchId}/remaining`, {
      headers: { ...(authHeader() as any) },
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((j) => setRemaining(j?.remaining ?? {}))
      .catch(() => setRemaining({}));
  }, [open, match?.matchId]);

  const [rows, setRows] = React.useState<
    Array<{
      userId: string;
      phone?: string | null;
      pos?: string | null;
      include: boolean;
      traits: {
        punctuality: number;
        respect: number;
        sportsmanship: number;
        swearing: number;
        aggression: number;
      };
      posScore: number; // 1..10
    }>
  >([]);
  const [saving, setSaving] = React.useState(false);

  // modal açıldığında satırları hazırla
  React.useEffect(() => {
    if (!open || !match) return;
    const list = Array.isArray(match?.players) ? match.players : [];
    setRows(
      list.map((p) => ({
        userId: String(p.id),
        phone: p.phone ?? null,
        pos: p.pos ?? null,
        include: true,
        traits: { punctuality: 3, respect: 3, sportsmanship: 3, swearing: 3, aggression: 3 },
        posScore: 7,
      }))
    );
  }, [open, match]);

  async function save() {
    try {
      setSaving(true);

      const selectable = rows.filter((r) => r.include && (remaining[r.userId] ?? 3) > 0);
      if (selectable.length === 0) {
        alert("Kilitli/çıkarılmış oyuncular nedeniyle gönderilecek kayıt yok.");
        setSaving(false);
        return;
      }

      const items = selectable.map((r) => ({
        rateeId: r.userId,
        pos: r.pos ?? undefined,
        posScore: r.pos ? Math.max(1, Math.min(10, Math.round(Number(r.posScore)))) : undefined,
        traits: {
          punctuality: r.traits.punctuality,
          respect: r.traits.respect,
          sports: r.traits.sportsmanship, // FE -> BE alias
          swearing: r.traits.swearing,
          aggression: r.traits.aggression,
        },
      }));

      const r = await fetch(`${API_URL}/ratings/${match!.matchId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(authHeader() as any) },
        body: JSON.stringify({ items }),
      });
      const j = await r.json().catch(() => ({}));

      if (j?.remaining && typeof j.remaining === "object") {
        setRemaining((prev) => ({ ...prev, ...j.remaining }));
      }

      if (!r.ok || j?.ok !== true) {
        if (r.status === 403 && (j?.message === "window_closed" || j?.error === "ForbiddenException")) {
          alert("Süre doldu. Değerlendirme penceresi maçtan sonra 24 saat.");
        } else if (r.status === 409 && j?.message === "rate_limit") {
          alert("Aynı oyuncu için en fazla 3 kez düzenleyebilirsin.");
        } else {
          alert(j?.message || `Kaydedilemedi (HTTP ${r.status})`);
        }
        setSaving(false);
        return;
      }

      onSaved?.();
      onClose();
      alert("Teşekkürler! Değerlendirmen kaydedildi.");
    } catch (e: any) {
      alert(e?.message || "Hata");
    } finally {
      setSaving(false);
    }
  }

  if (!open || !match) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <div className="w-full max-w-4xl rounded-2xl bg-neutral-900 p-4 ring-1 ring-white/10">
        <div className="mb-2 text-base font-semibold">Oyuncuları değerlendir — {match.title ?? "Maç"}</div>

        {/* toplu seçim */}
        <div className="mb-2 flex items-center justify-end gap-2">
          <button
            onClick={() =>
              setRows((rs) =>
                rs.map((r) => ({
                  ...r,
                  include: (remaining[r.userId] ?? 3) > 0, // kilitli olanlar seçilmesin
                }))
              )
            }
            className="rounded-md bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700"
          >
            Tümünü seç
          </button>
          <button
            onClick={() => setRows((rs) => rs.map((r) => ({ ...r, include: false })))}
            className="rounded-md bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700"
          >
            Hepsini kaldır
          </button>
        </div>

        <div className="max-h-[60vh] overflow-auto">
          {rows.map((row, idx) => {
            const rLeft = remaining[row.userId] ?? 3;
            const disabled = !row.include || rLeft <= 0;
            return (
              <div key={row.userId} className="border-b border-white/5 py-3">
                <div className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={row.include}
                    onChange={(e) =>
                      setRows((rs) => {
                        const cp = [...rs];
                        cp[idx] = { ...cp[idx], include: e.target.checked };
                        return cp;
                      })
                    }
                    className="h-4 w-4 accent-emerald-500"
                  />
                  <span className={`truncate ${row.include ? "" : "opacity-40 line-through"}`}>
                    {row.phone ?? row.userId.slice(0, 6)}
                  </span>
                  {row.pos && <span className="rounded-md bg-neutral-800 px-2 py-0.5 text-xs">{row.pos}</span>}
                </div>

                <div className="mt-1 text-xs text-neutral-400">
                  Bu oyuncu için değerlendirmeni <b>{rLeft}</b> düzenleme hakkın kaldı.
                  {rLeft <= 0 && <span className="text-red-400"> • Kilitli</span>}
                </div>

                <div className={`mt-2 flex flex-wrap items-center gap-x-8 gap-y-2 text-xs ${disabled ? "pointer-events-none opacity-50" : ""}`}>
                  {(["punctuality", "respect", "sportsmanship", "swearing", "aggression"] as const).map((k) => (
                    <div key={k} className="inline-flex items-center whitespace-nowrap basis-1/2 sm:basis-1/3 md:basis-1/5">
                      <span className="mr-3">{labelFor(k)}</span>
                      <div className="shrink-0">
                        <TraitStars
                          value={row.traits[k]}
                          set={(n) =>
                            setRows((rs) => {
                              const cp = [...rs];
                              cp[idx] = { ...cp[idx], traits: { ...cp[idx].traits, [k]: n } };
                              return cp;
                            })
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className={`mt-4 flex w-full flex-col items-center gap-1 ${disabled ? "pointer-events-none opacity-50" : ""}`}>
                  {row.pos ? (
                    <>
                      <span className="text-xs">Oyun (1–10)</span>
                      <ScorePills
                        value={row.posScore}
                        set={(n) =>
                          setRows((rs) => {
                            const cp = [...rs];
                            cp[idx] = { ...cp[idx], posScore: n };
                            return cp;
                          })
                        }
                      />
                      <span className="text-xs">{row.posScore}</span>
                    </>
                  ) : (
                    <span className="text-[11px] text-neutral-500">Pozisyon bilgisi yok</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="text-[11px] text-neutral-400">
            Not: Değerlendirmeler anonimdir. 24 saat içinde en fazla 3 kez güncelleyebilirsin.
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700">
              Vazgeç
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-neutral-950 disabled:opacity-50 hover:bg-emerald-500"
            >
              {saving ? "Kaydediliyor…" : "Kaydet"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

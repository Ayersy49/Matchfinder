"use client";

import React from "react";
import { getTeamSlots, postAssignSlot } from "@/lib/api";
import type { TeamMemberRow } from "@/components/teams/TeamMembersList";

export type SlotRow = {
  id: string;
  teamId: string;
  formationCode: string;
  slotKey: string; // GK/LB/CB1/.../SB1
  x: number;
  y: number;
  userId?: string | null;
  locked?: boolean | null;
};

interface Props {
  teamId: string;
  members?: TeamMemberRow[]; // atama için opsiyonel
  editable?: boolean;
}

export default function TeamPitch({ teamId, members = [], editable = true }: Props) {
  const [slots, setSlots] = React.useState<SlotRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState<string | null>(null); // slotKey

  async function refresh() {
    setLoading(true);
    setErr(null);
    try {
      const data = await getTeamSlots(teamId);
      setSlots(Array.isArray(data) ? (data as SlotRow[]) : []);
    } catch (e: any) {
      setErr(e?.message || "Slotlar yüklenemedi");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    refresh();
  }, [teamId]);

  async function assign(slotKey: string, userId: string | null) {
    if (!editable) return;
    setSaving(slotKey);
    try {
      await postAssignSlot(teamId, { slotKey, userId });
      await refresh();
    } catch (e: any) {
      alert(e?.message || "Atanamadı");
    } finally {
      setSaving(null);
    }
  }

  const bench = (k: string) => /^SB\d+$/i.test(k);

  const getMemberForSlot = (slot: SlotRow) =>
    members.find((m) => m.userId === slot.userId) || null;

  const handleSlotClick = (slot: SlotRow) => {
    if (!editable) return;
    if (!members.length) return;

    const currentMember = getMemberForSlot(slot);
    const current = currentMember?.userId || slot.userId || "";

    // Basit bir prompt tabanlı seçim – istersen sonra dropdown'a çevirebiliriz
    const list = members
      .map(
        (m) =>
          `${m.userId} ${
            m.preferredPosition ? `(${m.preferredPosition})` : ""
          }`
      )
      .join("\n");

    const input = window.prompt(
      `Bu slot için userId gir (boş bırak = kaldır):\n\n${list}`,
      current
    );
    if (input === null) return;

    const trimmed = input.trim();
    assign(slot.slotKey, trimmed || null);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-medium">Kuş Bakışı Saha</div>
        <div className="text-xs text-neutral-400">{slots.length} slot</div>
      </div>

      {err && (
        <div className="mb-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {err}
        </div>
      )}

      {loading && !slots.length ? (
        <div className="flex h-40 items-center justify-center text-xs text-neutral-400">
          Yükleniyor...
        </div>
      ) : (
        <>
          {/* Saha */}
          <div className="relative mb-3 w-full overflow-hidden rounded-xl bg-gradient-to-b from-emerald-900 to-emerald-700 p-2">
            <div className="relative mx-auto aspect-[2/3] max-w-sm rounded-lg border border-emerald-300/40">
              {/* Orta çizgi, ceza sahaları vs eklemek istersen buraya ekleyebilirsin */}

              {slots
                .filter((s) => !bench(s.slotKey))
                .map((slot) => {
                  const member = getMemberForSlot(slot);
                  const label =
                    member?.preferredPosition ||
                    slot.slotKey ||
                    member?.user?.phone ||
                    "Boş";

                  // x,y'yi % kabul ediyoruz (0–100 arası)
                  const left = `${slot.x}%`;
                  const top = `${slot.y}%`;

                  const isSaving = saving === slot.slotKey;

                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => handleSlotClick(slot)}
                      className={`absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border text-[10px] font-semibold shadow-sm transition ${
                        slot.userId
                          ? "border-emerald-200 bg-emerald-500/90 text-emerald-950"
                          : "border-emerald-200/40 bg-emerald-900/70 text-emerald-50/80"
                      } ${!editable ? "cursor-default" : "cursor-pointer hover:scale-105"}`}
                      style={{ left, top }}
                      disabled={isSaving || !editable}
                    >
                      <span className="leading-tight">
                        {member?.number ? `#${member.number}` : label}
                      </span>
                      {isSaving && (
                        <span className="mt-0.5 text-[8px]">
                          Kaydediliyor…
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Yedek kulübesi */}
          {slots.some((s) => bench(s.slotKey)) && (
            <div className="mt-2 rounded-xl bg-neutral-950/60 p-2">
              <div className="mb-1 text-[11px] font-medium text-neutral-400">
                Yedek Kulübesi
              </div>
              <div className="flex flex-wrap gap-1">
                {slots
                  .filter((s) => bench(s.slotKey))
                  .map((slot) => {
                    const member = getMemberForSlot(slot);
                    const isSaving = saving === slot.slotKey;
                    const label =
                      member?.preferredPosition ||
                      member?.user?.phone ||
                      slot.slotKey;

                    return (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => handleSlotClick(slot)}
                        className={`rounded-full px-2 py-0.5 text-[11px] ${
                          slot.userId
                            ? "bg-emerald-600/80 text-emerald-50"
                            : "bg-neutral-800 text-neutral-200"
                        } ${!editable ? "cursor-default" : "hover:bg-emerald-500/80"}`}
                        disabled={isSaving || !editable}
                      >
                        {label}
                        {isSaving && " …"}
                      </button>
                    );
                  })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

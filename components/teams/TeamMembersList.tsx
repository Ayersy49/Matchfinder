"use client";

import React from "react";
import { Users } from "lucide-react";

export type TeamMemberRow = {
  userId: string;
  role: "OWNER" | "ADMIN" | "PLAYER" | string;
  number?: number | null;
  preferredPosition?: string | null;
  user?: { id: string; phone?: string | null } | null;
};

function RoleBadge({ role }: { role: TeamMemberRow["role"] }) {
  if (role === "OWNER")
    return (
      <span className="rounded bg-yellow-500/15 px-2 py-0.5 text-[11px] font-medium text-yellow-300 ring-1 ring-yellow-500/30">
        Owner
      </span>
    );

  if (role === "ADMIN")
    return (
      <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300 ring-1 ring-emerald-500/30">
        Captain
      </span>
    );

  return null;
}

export default function TeamMembersList({ members }: { members: TeamMemberRow[] }) {
  if (!members?.length) return null;

  const mask = (p?: string | null) => {
    const s = String(p || "");
    return s.length >= 7 ? `${s.slice(0, 3)} *** **` : s || "U***";
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-900/60">
      <div className="flex items-center gap-2 border-b border-white/10 p-3 text-sm">
        <Users className="h-4 w-4 text-neutral-400" />
        <div className="font-medium">Oyuncular</div>
      </div>

      <div className="divide-y divide-white/10">
        {members.map((m) => (
          <div key={m.userId} className="flex items-center gap-3 p-3">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-neutral-800 text-xs font-semibold">
              {m.userId.slice(0, 2)}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div className="truncate text-sm font-medium">
                  {mask(m.user?.phone)}
                </div>
                <RoleBadge role={m.role} />
              </div>
              <div className="text-xs text-neutral-400">
                {m.preferredPosition || "-"}
              </div>
            </div>

            {typeof m.number === "number" && (
              <div className="rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300">
                #{m.number}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

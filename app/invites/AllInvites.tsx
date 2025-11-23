// app/invites/AllInvites.tsx
"use client";

import * as React from "react";
import { useSearchParams, useRouter } from "next/navigation";
import InvitesInbox from "./InvitesInbox";
import TeamInvitesPanel from "@/components/panels/TeamInvitesPanel"; // <-- düzeltildi


type Tab = "matches" | "teams";

export default function AllInvites() {
  const search = useSearchParams();
  const router = useRouter();
  const initial: Tab = (search.get("tab") === "teams" ? "teams" : "matches");
  const [tab, setTab] = React.useState<Tab>(initial);

  React.useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if ((q.get("tab") || "matches") !== tab) {
      q.set("tab", tab);
      router.replace(`/invites?${q.toString()}`);
    }
  }, [tab, router]);

  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-900/60">
      <div className="flex items-center justify-between border-b border-white/10 p-3">
        <div className="text-base font-semibold">Davetler</div>
        <div className="flex gap-2">
          <button onClick={() => setTab("matches")} className={`rounded-lg px-3 py-1.5 text-sm ${tab === "matches" ? "bg-white/10" : "bg-neutral-800 hover:bg-neutral-700"}`}>
            Maç Davetleri
          </button>
          <button onClick={() => setTab("teams")} className={`rounded-lg px-3 py-1.5 text-sm ${tab === "teams" ? "bg-white/10" : "bg-neutral-800 hover:bg-neutral-700"}`}>
            Takım Davetleri
          </button>
        </div>
      </div>

      <div className="p-3">
        {tab === "matches" ? <InvitesInbox /> : <TeamInvitesPanel />}
      </div>
    </div>
  );
}

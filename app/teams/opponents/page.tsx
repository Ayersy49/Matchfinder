"use client";
import * as React from "react";
import { listOpenTeamRequests, offerOpponent, getMyTeams } from "@/lib/api";

export default function OpponentsPage() {
  const [reqs, setReqs] = React.useState<any[]>([]);
  const [myTeams, setMyTeams] = React.useState<any[]>([]);
  React.useEffect(() => { listOpenTeamRequests().then(setReqs); getMyTeams().then(setMyTeams); }, []);
  return (
    <div style={{ padding: 24 }}>
      <h1 className="text-lg font-semibold mb-3">Açık Rakip İlanları</h1>
      <div className="grid gap-3">
        {reqs.map(r=>(
          <div key={r.id} className="rounded-xl bg-neutral-900 p-3">
            <div className="text-sm">{r.reqTeam?.name} — {new Date(r.date).toLocaleString()} — {r.format} — {r.locationText}</div>
            <div className="mt-2 flex gap-2">
              {myTeams.map(t=>(
                <button key={t.id} className="rounded-lg bg-neutral-800 px-3 py-1.5 text-xs"
                  onClick={()=> offerOpponent(r.id, t.id).then(()=>alert("Teklif gönderildi"))}>
                  {t.name} ile teklif et
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

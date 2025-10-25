// app/teams/[id]/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useMe } from "@/lib/useMe";
import {
  getTeam,
  getTeamSlots,
  postAssignSlot,
  getTeamChat,
  postTeamChat,
  postTeamRequest,
} from "@/lib/api";

/** ---- Diziliş XY yerleşimleri ---- */
type XY = Record<string, [number, number]>;
const XY433: XY = { GK:[10,50], LB:[23,23], CB1:[16,36], CB2:[16,64], RB:[23,77], DM:[40,50], CM:[52,37], AM:[52,63], LW:[72,23], ST:[86,50], RW:[72,77] };
const XY352: XY = { GK:[10,50], CB1:[18,30], CB2:[18,50], CB3:[18,70], LWB:[38,23], RWB:[38,77], DM:[43,50], CM:[55,40], AM:[55,60], ST1:[86,42], ST2:[86,58] };
const XY4231: XY = { GK:[10,50], LB:[23,23], CB1:[16,36], CB2:[16,64], RB:[23,77], DM1:[40,40], DM2:[40,60], LW:[70,23], AM:[60,50], RW:[70,77], ST:[86,50] };

function xyFor(formation: string) {
  if (formation === "3-5-2") return XY352;
  if (formation === "4-2-3-1") return XY4231;
  return XY433;
}

/** ---- Etiket çevirileri ---- */
const POS_LABEL: Record<string, string> = {
  GK:"Kaleci", LB:"Sol Bek", RB:"Sağ Bek", CB1:"Stoper", CB2:"Stoper", CB3:"Stoper",
  DM:"Ön Libero", DM1:"Def Orta", DM2:"Def Orta", CM:"Merkez", AM:"10 Numara",
  LW:"Sol Kanat", RW:"Sağ Kanat", ST:"Forvet", ST1:"Forvet", ST2:"Forvet",
  LWB:"Sol Kanat Bek", RWB:"Sağ Kanat Bek",
};

export default function TeamDetail({ params }: { params: { id: string } }) {
  const id = params.id;
  const router = useRouter();
  const { me } = useMe();

  const [team, setTeam] = React.useState<any | null>(null);
  const [slots, setSlots] = React.useState<any[]>([]);
  const [messages, setMessages] = React.useState<any[]>([]);
  const [text, setText] = React.useState("");
  const [assigning, setAssigning] = React.useState(false);
  const [selectedPos, setSelectedPos] = React.useState<string>("");

  React.useEffect(() => {
    (async () => {
      const t = await getTeam(id);
      setTeam(t);
      const s = await getTeamSlots(id);
      setSlots(s);
      const chat = await getTeamChat(id);
      setMessages(chat);
    })();
  }, [id]);

  const xy = xyFor(team?.formationCode || "4-3-3");
  const slotMap: Record<string, any> = React.useMemo(() => {
    const m: Record<string, any> = {};
    slots.forEach((s) => (m[s.slotKey] = s));
    return m;
  }, [slots]);

  const myUserId = me?.id ?? null;
  const mySlotKey = React.useMemo(() => {
    if (!myUserId) return null;
    const s = slots.find((s) => s.userId === myUserId);
    return s?.slotKey || null;
  }, [slots, myUserId]);

  const activeMembers = React.useMemo(
    () => (team?.members || []).filter((m: any) => m.status === "ACTIVE"),
    [team?.members]
  );

  const avgLevel = React.useMemo(() => {
    const list = activeMembers.map((m: any) => Number(m.user?.level ?? 0)).filter((n: number) => n > 0);
    if (!list.length) return null;
    return Math.round((list.reduce((a: number, b: number) => a + b, 0) / list.length) * 10) / 10;
  }, [activeMembers]);

  const openSlots = React.useMemo(() => {
    return Object.keys(xy).filter((k) => !slotMap[k]?.userId);
  }, [xy, slotMap]);

  React.useEffect(() => {
    // kullanıcı tercihleri (me.positions) varsa ve uygun boşluk varsa onu seçili getir
    if (!selectedPos && openSlots.length) {
      const prefs: string[] = Array.isArray(me?.positions) ? (me!.positions as any) : [];
      const hit = prefs.find((p) => openSlots.includes(p));
      setSelectedPos(hit || openSlots[0]);
    }
  }, [openSlots, me?.positions, selectedPos]);

  async function placeSelf(slotKey: string) {
    if (!myUserId) { alert("Giriş gerekli."); return; }
    setAssigning(true);
    try {
      await postAssignSlot(id, { slotKey, userId: myUserId });
      const s = await getTeamSlots(id);
      setSlots(s);
    } catch (e: any) {
      alert(e?.message || "Yerleştirme başarısız");
    } finally {
      setAssigning(false);
    }
  }

  async function leaveSlot() {
    if (!myUserId || !mySlotKey) return;
    setAssigning(true);
    try {
      await postAssignSlot(id, { slotKey: mySlotKey, userId: null });
      const s = await getTeamSlots(id);
      setSlots(s);
    } catch (e: any) {
      alert(e?.message || "Çıkarılamadı");
    } finally {
      setAssigning(false);
    }
  }

  async function send() {
    if (!text.trim()) return;
    const m = await postTeamChat(id, text.trim());
    setMessages((x) => [...x, m]);
    setText("");
  }

  async function createOpponentReq() {
    const dt = new Date(); dt.setDate(dt.getDate() + 2); dt.setHours(21, 0, 0, 0);
    await postTeamRequest({
      teamId: id,
      date: dt.toISOString(),
      durationMin: 60,
      locationText: team?.city ? `${team.city} ${team?.district || ""}` : "Belirlenen halısaha",
      format: "7v7",
      levelMin: avgLevel ? Math.max(1, avgLevel - 1) : undefined,
      levelMax: avgLevel ? Math.min(10, avgLevel + 1) : undefined,
    });
    alert("Rakip arama ilanı oluşturuldu.");
  }

  if (!team) return <div className="p-6">Yükleniyor…</div>;

  return (
    <div className="mx-auto grid max-w-6xl gap-4 p-4 pb-24">
      {/* Üst bar */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">{team.name}</div>
          <div className="text-xs text-neutral-400">{team.city || ""} {team.district || ""}</div>
        </div>
        <div className="flex gap-2">
          <Link
            href="/landing?tab=teams"
            className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
          >
            Ana ekrana dön
          </Link>
          <button
            onClick={createOpponentReq}
            className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
          >
            Rakip Ara
          </button>
        </div>
      </div>

      {/* İstatistikler */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-300">
        {(team.city || team.district) && (
          <span className="rounded-full bg-neutral-800 px-2 py-1">{team.city} {team.district}</span>
        )}
        <span className="rounded-full bg-neutral-800 px-2 py-1">ELO {team.elo ?? 1000}</span>
        <span className="rounded-full bg-neutral-800 px-2 py-1">
          Ortalama Seviye {avgLevel ?? "—"}
        </span>
        <span className="rounded-full bg-neutral-800 px-2 py-1">
          Üye {activeMembers.length}
        </span>
      </div>

      {/* Ortalanmış saha + sağda yerleşme paneli */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Saha */}
        <div className="grid place-items-center">
          <Pitch>
            {Object.entries(xy).map(([key, [left, top]]) => {
              const s = slotMap[key];
              const occupied = Boolean(s?.userId);
              const mine = s?.userId && myUserId && s.userId === myUserId;
              const label =
                mine ? "Ben"
                : occupied
                ? "U" + ((team.members.find((m:any)=>m.userId===s.userId)?.user?.phone?.slice(-3)) ?? "***")
                : key;

              return (
                <button
                  key={key}
                  onClick={() => !occupied && placeSelf(key)}
                  title={occupied ? `${POS_LABEL[key] || key} • Dolu` : `Slota yerleş: ${POS_LABEL[key] || key}`}
                  className={[
                    "absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-xs ring-1",
                    mine
                      ? "bg-emerald-600 text-neutral-950 ring-emerald-400"
                      : occupied
                      ? "bg-neutral-700 text-white ring-white/20"
                      : "bg-black/70 text-white hover:bg-black/80 ring-white/30",
                  ].join(" ")}
                  style={{ left: `${left}%`, top: `${top}%` }}
                  disabled={occupied && !mine}
                >
                  {label}
                </button>
              );
            })}
          </Pitch>
        </div>

        {/* Yerleşme paneli */}
        <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
          <div className="text-sm font-medium">Kendimi yerleştir</div>

          {mySlotKey ? (
            <div className="mt-2 text-sm text-neutral-300">
              Şu an mevkin: <b>{POS_LABEL[mySlotKey] || mySlotKey}</b>
              <div className="mt-2">
                <button
                  onClick={leaveSlot}
                  disabled={assigning}
                  className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700 disabled:opacity-50"
                >
                  Slottan çık
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-2 text-xs text-neutral-400">
                Boş mevkilerden birini seçip “Yerleştir”e tıkla.
              </div>
              <div className="mt-3 flex gap-2">
                <select
                  value={selectedPos}
                  onChange={(e) => setSelectedPos(e.target.value)}
                  className="min-w-[160px] rounded-lg bg-neutral-800 px-3 py-1.5 text-sm"
                >
                  {openSlots.map((k) => (
                    <option key={k} value={k}>
                      {POS_LABEL[k] || k}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => selectedPos && placeSelf(selectedPos)}
                  disabled={!selectedPos || assigning}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-neutral-950 disabled:opacity-50 hover:bg-emerald-500"
                >
                  Yerleştir
                </button>
              </div>
            </>
          )}

          {/* Üyeler */}
          <div className="mt-6">
            <div className="mb-2 text-sm font-medium">Üyeler</div>
            <div className="flex flex-wrap gap-2">
              {team.members.map((m: any) => (
                <span key={m.userId} className="rounded-lg bg-neutral-800 px-2 py-1 text-xs">
                  U{m.user.phone?.slice(-3) ?? "***"} · {m.role}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Sohbet */}
      <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
        <div className="mb-2 text-sm font-medium">Takım Sohbeti</div>
        <div className="mb-2 max-h-60 space-y-1 overflow-y-auto">
          {messages.map((m) => (
            <div key={m.id} className="text-sm">
              <span className="mr-1 text-neutral-400">{m.user?.nickname || "U***"}:</span>
              {m.text}
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Mesaj yaz…"
            className="flex-1 rounded-lg bg-neutral-800 px-3 py-2"
          />
          <button onClick={send} className="rounded-lg bg-emerald-600 px-3 py-2">
            Gönder
          </button>
        </div>
      </div>
    </div>
  );
}

/** ─────────── Görsel Saha Bileşeni ─────────── */
function Pitch({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative aspect-[16/10] w-full max-w-[720px] overflow-hidden rounded-2xl bg-[#0B7A3B] shadow-lg ring-1 ring-black/20">
      {/* Zemine hafif doku */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.06),transparent_60%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.05),transparent_60%)]" />

      {/* Saha çizgileri */}
      <div className="absolute inset-2 rounded-xl border-4 border-white/70" />
      <div className="absolute left-1/2 top-2 bottom-2 w-[3px] -translate-x-1/2 bg-white/70" />
      <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white/70" />

      {/* Ceza alanları */}
      <Box side="left" />
      <Box side="right" />

      {children}
    </div>
  );
}

function Box({ side }: { side: "left" | "right" }) {
  const align = side === "left" ? "left-2" : "right-2";
  return (
    <>
      <div className={`absolute ${align} top-1/2 h-40 w-28 -translate-y-1/2 border-4 border-white/70`} />
      <div className={`absolute ${align} top-1/2 h-24 w-12 -translate-y-1/2 border-4 border-white/70`} />
      <div
        className={`absolute ${align} top-1/2 h-24 w-12 -translate-y-1/2`}
        style={{
          borderTop: "0",
          borderBottom: "0",
        }}
      />
    </>
  );
}

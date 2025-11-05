"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMe } from "@/lib/useMe";
import {
  getTeam,
  getTeamSlots,
  postAssignSlot,
  getTeamChat,
  postTeamChat,
  postTeamRequest,
  patchTeam,
  postTeamClose,
  postTeamOpen,
  postTeamLeave,
  deleteTeamHard,
} from "@/lib/api";

const POS_LABEL: Record<string, string> = {
  GK:"Kaleci", LB:"Sol Bek", RB:"Sağ Bek", CB1:"Stoper", CB2:"Stoper", CB3:"Stoper",
  DM:"Ön Libero", DM1:"Defansif Orta", DM2:"Defansif Orta", CM:"Merkez", AM:"Ofansif Ortasaha",
  LW:"Sol Kanat", RW:"Sağ Kanat", ST:"Forvet", ST1:"Forvet", ST2:"Forvet",
  LWB:"Sol Kanat Bek", RWB:"Sağ Kanat Bek",
};

const PREF_TO_CODE: Record<string, string> = {
  "Santrafor": "ST",
  "Sol Kanat": "LW",
  "Sağ Kanat": "RW",
  "Kaleci": "GK",
  "Stoper": "CB",
  "Sol Bek": "LB",
  "Sağ Bek": "RB",
  "Defansif Orta": "DM",
  "Ön Libero": "DM",
  "Merkez": "CM",
  "10 Numara": "AM",
  "Sol Kanat Bek": "LWB",
  "Sağ Kanat Bek": "RWB",
};

function toBaseCode(pref: string): string {
  const t = (pref || "").trim();
  return PREF_TO_CODE[t] || t.toUpperCase();
}
function expandVariants(base: string): string[] {
  switch (base) {
    case "ST": return ["ST", "ST1", "ST2"];
    case "CB": return ["CB", "CB1", "CB2", "CB3"];
    case "CM": return ["CM", "CM1", "CM2"];
    case "DM": return ["DM", "DM1", "DM2"];
    default:   return [base];
  }
}
function pickSlotForPref(pref: string, open: string[]): string | null {
  const base = toBaseCode(pref);
  const variants = expandVariants(base);
  return variants.find(k => open.includes(k)) || null;
}

export default function TeamDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const { me } = useMe();

  const [team, setTeam] = React.useState<any | null>(null);
  const [slots, setSlots] = React.useState<any[]>([]);
  const [messages, setMessages] = React.useState<any[]>([]);
  const [text, setText] = React.useState("");
  const [assigning, setAssigning] = React.useState(false);
  const [selectedPos, setSelectedPos] = React.useState<string>("");

  // yönetim UI
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const teamId = React.useMemo(() => (Array.isArray(id) ? id[0] : id) as string, [id]);

  React.useEffect(() => {
    (async () => {
      const t = await getTeam(teamId);
      setTeam(t);
      const s = await getTeamSlots(teamId);
      setSlots(s);
      const chat = await getTeamChat(teamId);
      setMessages(chat);
    })();
  }, [teamId]);

  const myUserId = me?.id ?? null;

  const myMember = React.useMemo(
    () => (team?.members || []).find((m: any) => m.userId === me?.id) || null,
    [team?.members, me?.id]
  );
  const isOwner = myMember?.role === "OWNER";
  const isAdmin = isOwner || myMember?.role === "ADMIN";

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
    return slots.filter((s) => !s.userId).map((s) => s.slotKey);
  }, [slots]);

  React.useEffect(() => {
    if (!selectedPos && openSlots.length) {
      const prefs: string[] = Array.isArray(me?.positions) ? (me!.positions as any) : [];
      let hit: string | null = null;
      for (const p of prefs) {
        const candidate = pickSlotForPref(p, openSlots);
        if (candidate) { hit = candidate; break; }
      }
      setSelectedPos(hit || openSlots[0]);
    }
  }, [openSlots, me?.positions, selectedPos]);

  async function quickPlace() {
    const prefs: string[] = Array.isArray(me?.positions) ? (me!.positions as any) : [];
    let choice: string | null = null;
    for (const p of prefs) {
      const c = pickSlotForPref(p, openSlots);
      if (c) { choice = c; break; }
    }
    if (choice) await placeSelf(choice);
    else alert("İlk 3 tercih dolu. Listeden mevki seçebilirsin.");
  }

  async function placeSelf(slotKey: string) {
    if (!myUserId) { alert("Giriş gerekli."); return; }
    setAssigning(true);
    try {
      await postAssignSlot(teamId, { slotKey, userId: myUserId });
      const s = await getTeamSlots(teamId);
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
      await postAssignSlot(teamId, { slotKey: mySlotKey, userId: null });
      const s = await getTeamSlots(teamId);
      setSlots(s);
    } catch (e: any) {
      alert(e?.message || "Çıkarılamadı");
    } finally {
      setAssigning(false);
    }
  }

  async function send() {
    if (!text.trim()) return;
    try {
      const m = await postTeamChat(teamId, text.trim());
      setMessages((x) => [...x, m]);
      setText("");
    } catch (e:any) {
      alert(e?.message || "Mesaj gönderilemedi");
    }
  }


  async function createOpponentReq() {
    const dt = new Date(); dt.setDate(dt.getDate() + 2); dt.setHours(21, 0, 0, 0);
    const sizeGuess = slots.filter(s => s.formationCode === (team?.formationCode || '4-3-3')).length || 7;
    await postTeamRequest({
      teamId: teamId,
      date: dt.toISOString(),
      durationMin: 60,
      locationText: team?.city ? `${team.city} ${team?.district || ""}` : "Belirlenen halısaha",
      format: `${sizeGuess}v${sizeGuess}`,
      levelMin: avgLevel ? Math.max(1, avgLevel - 1) : undefined,
      levelMax: avgLevel ? Math.min(10, avgLevel + 1) : undefined,
    });
    alert("Rakip arama ilanı oluşturuldu.");
    router.push("/opponents");
  }

  async function refreshTeam() {
    const [t, s] = await Promise.all([getTeam(teamId), getTeamSlots(teamId)]);
    setTeam(t);
    setSlots(s);
  }

  async function handleCloseTeam() {
    if (!confirm("Takımı kapat: keşiften gizlenecek ve açık ilanlar iptal edilecek. Onaylıyor musun?")) return;
    await postTeamClose(teamId);
    await refreshTeam();
    alert("Takım kapatıldı.");
  }
  async function handleOpenTeam() {
    await postTeamOpen(teamId);
    await refreshTeam();
    alert("Takım tekrar açıldı.");
  }
  async function handleLeaveTeam() {
    if (!confirm("Bu takımdan ayrılmak istediğine emin misin?")) return;
    const res: any = await postTeamLeave(teamId);
    if (res?.deleted) { alert("Son üyeydin, takım silindi."); router.push("/landing?tab=teams"); return; }
    alert("Takımdan ayrıldın.");
    router.push("/landing?tab=teams");
  }
  async function handleDeleteTeam() {
    if (!confirm("Bu takımı kalıcı olarak silmek istiyor musun?")) return;
    try {
      await deleteTeamHard(teamId);
      alert("Takım silindi.");
      router.push("/landing?tab=teams");
    } catch (e: any) {
      alert(e?.message || "Silinemedi");
    }
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

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/landing?tab=teams" className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700">
            Ana ekrana dön
          </Link>

          <button onClick={createOpponentReq} className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700">
            Rakip Ara
          </button>

          {isAdmin && (
            <button onClick={() => setEditing(v => !v)} className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700">
              {editing ? "Düzenlemeyi Kapat" : "Düzenle"}
            </button>
          )}

          {isOwner && (
            team?.discoverable
              ? <button onClick={handleCloseTeam} className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700">Takımı Kapat</button>
              : <button onClick={handleOpenTeam}  className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700">Tekrar Aç</button>
          )}

          {isOwner ? (
            <button onClick={handleDeleteTeam} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm hover:bg-red-500">
              Sil
            </button>
          ) : myMember ? (
            <button onClick={handleLeaveTeam} className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700">
              Takımdan Çık
            </button>
          ) : null}
        </div>
      </div>

      {/* İstatistikler */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-300">
        {(team.city || team.district) && (
          <span className="rounded-full bg-neutral-800 px-2 py-1">{team.city} {team.district}</span>
        )}
        <span className="rounded-full bg-neutral-800 px-2 py-1">ELO {team.elo ?? 1000}</span>
        <span className="rounded-full bg-neutral-800 px-2 py-1">Ortalama Seviye {avgLevel ?? "—"}</span>
        <span className="rounded-full bg-neutral-800 px-2 py-1">Üye {activeMembers.length}</span>
        {!team.discoverable && <span className="rounded-full bg-amber-700/40 px-2 py-1">Kapalı</span>}
      </div>

      {/* DÜZENLE paneli */}
      {editing && isAdmin && (
        <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
          <div className="mb-2 text-sm font-medium">Takımı düzenle</div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget as HTMLFormElement);
              const payload = {
                name: String(fd.get("name") || "").trim(),
                city: String(fd.get("city") || "").trim(),
                district: String(fd.get("district") || "").trim(),
                bio: String(fd.get("bio") || "").trim(),
                formationCode: String(fd.get("formationCode") || team?.formationCode),
                size: Number(fd.get("size") || 7),
                visibility: String(fd.get("visibility") || team?.visibility),
              } as any;

              setSaving(true);
              try {
                const res: any = await patchTeam(teamId, payload);
                if (res?.bench?.length) {
                  const list = res.bench
                    .map((b: any) => b.phone ? `U${String(b.phone).slice(-3)}` : b.userId.slice(0,4))
                    .join(', ');
                  alert(`${res.bench.length} oyuncu yedeğe alındı: ${list}`);
                }
                await refreshTeam();
                setEditing(false);
              } catch (err:any) {
                alert(err?.message || "Kaydedilemedi");
              } finally {
                setSaving(false);
              }
            }}
            className="grid grid-cols-1 gap-3 md:grid-cols-2"
          >
            <input name="name" defaultValue={team?.name || ""} placeholder="Takım adı"
                   className="rounded-lg bg-neutral-800 px-3 py-2" />
            <input name="city" defaultValue={team?.city || ""} placeholder="Şehir"
                   className="rounded-lg bg-neutral-800 px-3 py-2" />
            <input name="district" defaultValue={team?.district || ""} placeholder="İlçe"
                   className="rounded-lg bg-neutral-800 px-3 py-2" />
            <select name="formationCode" defaultValue={team?.formationCode || "4-3-3"}
                    className="rounded-lg bg-neutral-800 px-3 py-2">
              <option value="4-3-3">4-3-3</option>
              <option value="3-5-2">3-5-2</option>
              <option value="4-2-3-1">4-2-3-1</option>
            </select>
            <select name="size" defaultValue={String(slots.filter(s => s.formationCode === (team?.formationCode || '4-3-3')).length || 7)}
                    className="rounded-lg bg-neutral-800 px-3 py-2">
              {[5,6,7,8,9,10,11].map(n=>(
                <option key={n} value={n}>{n}v{n}</option>
              ))}
            </select>
            <select name="visibility" defaultValue={team?.visibility || "PUBLIC"}
                    className="rounded-lg bg-neutral-800 px-3 py-2">
              <option value="PUBLIC">Genel</option>
              <option value="PRIVATE">Özel</option>
            </select>
            <textarea name="bio" defaultValue={team?.bio || ""} placeholder="Açıklama"
                      className="md:col-span-2 rounded-lg bg-neutral-800 px-3 py-2" />
            <div className="md:col-span-2 flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-neutral-950 disabled:opacity-50 hover:bg-emerald-500"
              >
                {saving ? 'Kaydediliyor…' : 'Kaydet'}
              </button>
              <button type="button" onClick={()=>setEditing(false)}
                      className="rounded-lg bg-neutral-800 px-3 py-2 text-sm">
                İptal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Ortalanmış saha + sağda yerleşme paneli */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Saha */}
        <div className="grid place-items-center">
          <Pitch>
            {slots.map((s) => {
              const key = s.slotKey as string;
              const left = s.x as number;
              const top  = s.y as number;
              const occupied = Boolean(s.userId);
              const mine = occupied && me?.id && s.userId === me.id;

              const member = occupied ? team.members.find((m:any) => m.userId === s.userId) : null;
              const label = mine ? "Ben" : occupied ? "U" + ((member?.user?.phone?.slice(-3)) ?? "***") : key;

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
                  className="rounded-lg bg-neutral-800 px-3 py-1.5 text-xs hover:bg-neutral-700"
                >
                  Slottan Çık.
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-2 text-xs text-neutral-400">
                Boş mevkilerden birini seçip “Yerleştir”e tıkla.
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={quickPlace}
                  className="rounded-lg bg-neutral-800 px-3 py-1.5 text-xs hover:bg-neutral-700"
                >
                  Tercihlerime göre yerleştir
                </button>
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
                  Yerleştir.
                </button>
              </div>
            </>
          )}

          {/* Üyeler */}
          <div className="mt-6">
            <div className="mb-2 text-sm font-medium">Üyeler</div>
            <div className="flex flex-wrap gap-2">
              {(team.members ?? []).map((m: any) => (
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
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.06),transparent_60%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.05),transparent_60%)]" />
      <div className="absolute inset-2 rounded-xl border-4 border-white/70" />
      <div className="absolute left-1/2 top-2 bottom-2 w-[3px] -translate-x-1/2 bg-white/70" />
      <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white/70" />
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
      <div className={`absolute ${align} top-1/2 h-24 w-12 -translate-y-1/2`} style={{ borderTop: "0", borderBottom: "0" }} />
    </>
  );
}

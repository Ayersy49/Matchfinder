// app/opponents/page.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import {
  listOpenTeamRequests,
  getMyTeams,
  offerOpponentSafe,   // hata fırlatmayan wrapper
  getOfferInbox,       // gelen teklifler
  respondOffer,        // kabul / reddet
} from "@/lib/api";
import { useMe } from "@/lib/useMe";

/** "7v7" → 7 */
function sizeFromFormat(fmt?: string): number | undefined {
  const m = String(fmt || "").match(/^\s*(\d+)\s*v\s*\d+\s*$/i);
  const n = m ? parseInt(m[1], 10) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

/** Takımın format boyutu (yedekler hariç slot sayısı) */
function getFormatSize(team: any): number {
  if (!team) return 11; // varsayılan
  
  // positionSlots varsa, bench olmayan slotları say
  const slots = Array.isArray(team.positionSlots) ? team.positionSlots : [];
  if (slots.length > 0) {
    // Bench slotları: SB1, SB2, SB3
    const fieldSlots = slots.filter((s: any) => !/^SB\d+$/i.test(s.slotKey || ''));
    if (fieldSlots.length > 0) {
      return fieldSlots.length;
    }
  }
  
  // team.size alanı varsa ve mantıklıysa (5..11) onu dön
  if (typeof team.size === 'number' && team.size >= 5 && team.size <= 11) {
    return team.size;
  }
  
  // formationCode "5v5" gibi bir formattaysa
  const code = team.formationCode || "";
  const m = code.match(/^(\d+)v\d+$/i);
  if (m) return parseInt(m[1], 10);

  return 11; // varsayılan
}

/** Takımdaki toplam dolu slot sayısı (yedekler dahil) */
function getTotalMemberCount(team: any): number {
  if (!team) return 0;
  const slots = Array.isArray(team.positionSlots) ? team.positionSlots : [];
  // Sadece dolu slotları say (userId veya locked)
  return slots.filter((s: any) => s.userId || s.locked).length;
}

export default function OpponentsPage() {
  const { me } = useMe();

  const [reqs, setReqs] = React.useState<any[]>([]);
  const [myTeams, setMyTeams] = React.useState<any[]>([]);
  const [sendingKey, setSendingKey] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  // Gelen teklifler (ilan sahiplerine)
  const [inbox, setInbox] = React.useState<any[]>([]);
  const [respondingId, setRespondingId] = React.useState<string | null>(null);

  // Açık ilanlar + benim takımlarım
  React.useEffect(() => {
    (async () => {
      try {
        // backend includeOffers=1 destekliyor; lib/api bu parametreyi eklemiyorsa yine de çalışır
        const [r, t] = await Promise.all([
          listOpenTeamRequests().catch(() => []),
          getMyTeams().catch(() => []),
        ]);
        setReqs(Array.isArray(r) ? r : []);
        setMyTeams(Array.isArray(t) ? t : []);
      } catch (e: any) {
        setErr(e?.message || "İlanlar yüklenemedi");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Gelen teklifler kutusu (ilan sahibi olduğun takımlara gelenler)
  React.useEffect(() => {
    (async () => {
      try {
        const xs = await getOfferInbox().catch(() => []);
        setInbox(Array.isArray(xs) ? xs : []);
      } catch {
        /* no-op */
      }
    })();
  }, []);

  // Benim takım id listem
  const myTeamIds = React.useMemo(
    () => (myTeams || []).map((t: any) => t.id),
    [myTeams]
  );

  // Kendi ilanlarını ekranda hiç gösterme
  const visibleReqs = React.useMemo(
    () =>
      (reqs || []).filter((r: any) => {
        const reqTeamId = r.requestingTeamId ?? r.reqTeamId; // backend alanını tolere et
        return !myTeamIds.includes(reqTeamId);
      }),
    [reqs, myTeamIds]
  );

  // Teklif gönder
  const handleOffer = React.useCallback(
    async (requestId: string, teamId: string) => {
      const key = `${requestId}:${teamId}`;
      if (sendingKey === key) return; // çift tık engeli
      setSendingKey(key);
      try {
        const res = await offerOpponentSafe(requestId, teamId);
        if (res.ok) {
          alert("Teklif gönderildi");
          // optimistic update: ilana 'bu takımdan teklif var' gibi işaretle (opsiyonel)
          setReqs((xs) =>
            xs.map((x) =>
              x.id === requestId
                ? { ...x, offers: [...(x.offers || []), { offerTeamId: teamId }] }
                : x
            )
          );
        } else {
          alert(res.message);
        }
      } finally {
        setSendingKey(null);
      }
    },
    [sendingKey]
  );

  // Gelen teklife cevap ver (ilan sahibi)
  async function handleRespond(offerId: string, action: "accept" | "decline") {
    if (respondingId) return;
    setRespondingId(offerId);
    try {
      await respondOffer(offerId, action);
      // inbox'tan düş
      setInbox((xs) => xs.filter((x) => x.id !== offerId));
      if (action === "accept") {
        alert("Teklif kabul edildi. İlan eşleştirildi.");
        // Eşleşen ilan 'OPEN' listesinden düşsün
        const r = await listOpenTeamRequests().catch(() => []);
        setReqs(Array.isArray(r) ? r : []);
      }
    } catch (e: any) {
      alert(e?.message || "İşlem başarısız");
    } finally {
      setRespondingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Açık Rakip İlanları</h1>
        <Link
          href="/landing?tab=teams"
          className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
        >
          Ana menü
        </Link>
      </div>

      {/* Gelen Tekliflerim (ilan sahibine) */}
      {inbox.length > 0 && (
        <div className="mb-4 rounded-xl border border-white/10 bg-neutral-900/60 p-4">
          <div className="mb-2 text-sm font-semibold">Gelen Tekliflerim</div>
          <div className="space-y-2">
            {inbox.map((o: any) => {
              const when = new Date(o.request?.date);
              return (
                <div
                  key={o.id}
                  className="rounded-lg border border-white/10 p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <b>{o.offerTeam?.name || "Bir takım"}</b>
                    <span className="opacity-70">→</span>
                    <span>{o.request?.reqTeam?.name || "Takımım"}</span>
                    <span className="opacity-70">•</span>
                    <span>
                      {when.toLocaleDateString()}{" "}
                      {when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="opacity-70">•</span>
                    <span>{o.request?.format}</span>
                    <span className="opacity-70">•</span>
                    <span>{o.request?.locationText}</span>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      disabled={respondingId === o.id}
                      onClick={() => handleRespond(o.id, "accept")}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs hover:bg-emerald-500 disabled:opacity-50"
                    >
                      Kabul et
                    </button>
                    <button
                      disabled={respondingId === o.id}
                      onClick={() => handleRespond(o.id, "decline")}
                      className="rounded-lg bg-neutral-800 px-3 py-1.5 text-xs hover:bg-neutral-700 disabled:opacity-50"
                    >
                      Reddet
                    </button>
                    <span className="self-center text-xs text-neutral-400">
                      {respondingId === o.id ? "İşleniyor…" : "Beklemede"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading && (
        <div className="rounded-xl border border-white/10 bg-neutral-900/60 p-4 text-sm text-neutral-300">
          Yükleniyor…
        </div>
      )}
      {!!err && !loading && (
        <div className="rounded-xl border border-red-500/30 bg-red-900/30 p-4 text-sm">
          {err}
        </div>
      )}

      <div className="grid gap-3">
        {!loading && !err && visibleReqs.length === 0 && (
          <div className="rounded-xl border border-white/10 bg-neutral-900/60 p-4 text-sm text-neutral-300">
            Şu anda açık ilan bulunamadı.
          </div>
        )}

        {visibleReqs.map((r: any) => {
          const when = new Date(r.date);
          const reqTeamId = r.requestingTeamId ?? r.reqTeamId;
          const expectedSize = sizeFromFormat(r.format); // ilan boyutu
          return (
            <div
              key={r.id}
              className="rounded-xl border border-white/10 bg-neutral-900/60 p-4"
            >
              <div className="text-sm flex flex-wrap items-center gap-2">
                <b>{r.reqTeam?.name || "Bir takım"}</b>
                <span className="opacity-70">•</span>
                <span>
                  {when.toLocaleDateString()}{" "}
                  {when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="opacity-70">•</span>
                <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-xs">
                  {r.format}
                </span>
                <span className="opacity-70">•</span>
                <span>{r.locationText}</span>
                {(r.levelMin || r.levelMax) && (
                  <>
                    <span className="opacity-70">•</span>
                    <span>Seviye {r.levelMin ?? "?"}-{r.levelMax ?? "?"}</span>
                  </>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {myTeams
                  .filter((t: any) => t.id !== reqTeamId) // kendi ilanına teklif butonu gösterme
                  .map((t: any) => {
                    const already = (r.offers || []).some(
                      (o: any) => o.offerTeamId === t.id
                    );
                    const key = `${r.id}:${t.id}`;

                    const myFormatSize = getFormatSize(t);
                    const totalMembers = getTotalMemberCount(t);
                    const subsCount = Math.max(0, totalMembers - myFormatSize);

                    const sizeMismatch =
                      typeof expectedSize === "number" && myFormatSize !== expectedSize;

                    const disabled = already || sendingKey === key || sizeMismatch;

                    return (
                      <button
                        key={t.id}
                        disabled={disabled}
                        onClick={() => void handleOffer(r.id, t.id)}
                        className={`rounded-lg px-3 py-1.5 text-xs ${disabled
                            ? "bg-neutral-800 text-neutral-400 opacity-60 cursor-not-allowed"
                            : "bg-neutral-800 hover:bg-neutral-700"
                          }`}
                        title={
                          sizeMismatch
                            ? `Boyut uymuyor: ilan ${expectedSize}v${expectedSize}, takımın ${myFormatSize}v${myFormatSize}`
                            : already
                              ? "Bu takımdan teklif gönderildi"
                              : `${t.name} ile teklif et`
                        }
                      >
                        {already
                          ? "Teklif gönderildi"
                          : sizeMismatch
                            ? `${t.name} (${myFormatSize}v${myFormatSize}) — UYUŞMUYOR`
                            : `${t.name} (${myFormatSize}v${myFormatSize}${subsCount > 0 ? ` +${subsCount}` : ''}) ile teklif et`}
                      </button>
                    );
                  })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";
import React from "react";
import Link from "next/link";
import { Users, Shirt, LineChart, MapPin } from "lucide-react";
import { getMyTeams } from "@/lib/api";

type TeamRow = {
  id: string;
  name: string;
  city?: string | null;
  district?: string | null;
  formationCode?: string | null;
  logoUrl?: string | null;
  elo?: number | null;
  avgSportsmanship?: number | null;
  members?: Array<any> | null;
  memberCount?: number | null;
};

function EmptyState() {
  return (
    <div className="grid place-items-center rounded-2xl border border-white/10 bg-neutral-900/60 p-8 text-center">
      {/* İkon rozet (emoji yok) */}
      <div className="mb-3">
        <div className="relative h-16 w-16">
          <div className="absolute inset-0 rounded-2xl bg-neutral-950 ring-1 ring-white/10" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <Shirt className="h-7 w-7 text-neutral-300" />
          </div>
          <div className="absolute -right-2 -bottom-2 rounded-xl bg-neutral-950 p-1 ring-1 ring-white/10">
            <Users className="h-4 w-4 text-neutral-400" />
          </div>
        </div>
      </div>

      <div className="text-base font-semibold">Henüz takımın yok</div>
      <p className="mt-1 max-w-sm text-sm text-neutral-400">
        Sık oynadığın arkadaşlarla bir <b>takım</b> kur, formasyonunu belirle,
        sohbeti aç ve birlikte <b>ELO</b> puanını yükseltin.
      </p>
      <Link
        href="/teams/new"
        className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-emerald-500"
      >
        Yeni Takım
      </Link>
    </div>
  );
}

export default function TeamsTab() {
  const [items, setItems] = React.useState<TeamRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setErr(null);
    try {
      const list = await getMyTeams();
      setItems(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setErr(e?.message || "Yükleme hatası");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="mx-auto max-w-4xl p-4 pb-20">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Takımlarım</h1>
        <Link
          href="/teams/new"
          className="rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-medium text-neutral-950 hover:bg-emerald-500"
        >
          Yeni Takım
        </Link>
      </div>

      {err && (
        <div className="mb-3 rounded-lg bg-rose-500/15 p-3 text-sm text-rose-300 ring-1 ring-rose-500/30">
          {err}
          <button
            onClick={refresh}
            className="ml-2 rounded bg-rose-500/20 px-2 py-0.5 text-xs hover:bg-rose-500/30"
          >
            Tekrar dene
          </button>
        </div>
      )}

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-neutral-900/60" />
          ))}
        </div>
      )}

      {!loading && items.length === 0 && <EmptyState />}

      <div className="grid gap-3">
        {items.map((t) => {
          const memberCount =
            typeof t.memberCount === "number"
              ? t.memberCount
              : Array.isArray(t.members)
              ? t.members.length
              : undefined;

          return (
            <div key={t.id} className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
              <div className="flex items-center gap-3">
                {/* logo */}
                <div className="grid size-12 place-items-center overflow-hidden rounded-xl bg-neutral-800">
                  {t.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" src={t.logoUrl} className="size-full object-cover" />
                  ) : (
                    <Shirt className="size-6 text-neutral-400" />
                  )}
                </div>

                {/* orta */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="truncate text-base font-medium">{t.name}</div>
                    {t.formationCode && (
                      <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300">
                        {t.formationCode}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
                    {(t.city || t.district) && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3" />
                        {t.city} {t.district}
                      </span>
                    )}
                    {typeof t.elo === "number" && (
                      <span className="inline-flex items-center gap-1">
                        <LineChart className="size-3" />
                        Elo {t.elo}
                      </span>
                    )}
                    {typeof t.avgSportsmanship === "number" && (
                      <span
                        className={`inline-flex items-center gap-1 ${
                          t.avgSportsmanship >= 7
                            ? "text-emerald-300"
                            : t.avgSportsmanship >= 5
                            ? "text-amber-300"
                            : "text-rose-300"
                        }`}
                      >
                        SI {t.avgSportsmanship.toFixed(1)}
                      </span>
                    )}
                    {typeof memberCount === "number" && (
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3" />
                        {memberCount} oyuncu
                      </span>
                    )}
                  </div>
                </div>

                {/* sağ */}
                <div className="flex shrink-0 gap-2">
                  <Link
                    href={`/teams/${t.id}`}
                    className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
                  >
                    Aç
                  </Link>
                  <Link
                    href={`/teams/${t.id}?opponent=new`}
                    className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700"
                  >
                    Rakip ara
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

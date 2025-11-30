"use client";

import * as React from "react";
import { authHeader } from "@/lib/auth";
import ReportModal from "./ReportModal";
import BanUserModal from "./admin/BanUserModal";
import { useMe } from "@/lib/useMe";
import { AlertTriangle, ShieldBan } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/* =================== TİPLER & YARDIMCILAR =================== */

type PositionKey =
    | "GK" | "LB" | "CB" | "RB" | "LWB" | "RWB"
    | "DM" | "CM" | "AM" | "LW" | "RW" | "ST" | "STP";

const FORMATIONS: Record<string, { key: PositionKey; label: string; x: number; y: number }[]> = {
    "4-2-3-1": [
        { key: "GK", label: "Kaleci", x: 10, y: 50 },
        { key: "LB", label: "Sol Bek", x: 30, y: 15 },
        { key: "CB", label: "Stoper", x: 25, y: 38 },
        { key: "CB", label: "Stoper", x: 25, y: 62 },
        { key: "RB", label: "Sağ Bek", x: 30, y: 85 },
        { key: "DM", label: "Ön Libero", x: 45, y: 35 },
        { key: "DM", label: "Ön Libero", x: 45, y: 65 },
        { key: "AM", label: "10 Numara", x: 65, y: 50 },
        { key: "LW", label: "Sol Kanat", x: 70, y: 15 },
        { key: "RW", label: "Sağ Kanat", x: 70, y: 85 },
        { key: "ST", label: "Santrafor", x: 85, y: 50 },
    ],
    "4-3-3": [
        { key: "GK", label: "Kaleci", x: 10, y: 50 },
        { key: "LB", label: "Sol Bek", x: 30, y: 15 },
        { key: "CB", label: "Stoper", x: 25, y: 38 },
        { key: "CB", label: "Stoper", x: 25, y: 62 },
        { key: "RB", label: "Sağ Bek", x: 30, y: 85 },
        { key: "CM", label: "Merkez", x: 50, y: 30 },
        { key: "CM", label: "Merkez", x: 50, y: 70 },
        { key: "AM", label: "10 Numara", x: 60, y: 50 },
        { key: "LW", label: "Sol Kanat", x: 75, y: 15 },
        { key: "RW", label: "Sağ Kanat", x: 75, y: 85 },
        { key: "ST", label: "Santrafor", x: 85, y: 50 },
    ],
    "3-5-2": [
        { key: "GK", label: "Kaleci", x: 10, y: 50 },
        { key: "CB", label: "Stoper", x: 25, y: 25 },
        { key: "CB", label: "Stoper", x: 25, y: 50 },
        { key: "CB", label: "Stoper", x: 25, y: 75 },
        { key: "LWB", label: "Sol Kanat Bek", x: 50, y: 10 },
        { key: "RWB", label: "Sağ Kanat Bek", x: 50, y: 90 },
        { key: "DM", label: "Ön Libero", x: 45, y: 50 },
        { key: "AM", label: "Ofansif Orta", x: 65, y: 35 },
        { key: "AM", label: "Ofansif Orta", x: 65, y: 65 },
        { key: "ST", label: "Santrafor", x: 85, y: 35 },
        { key: "ST", label: "Santrafor", x: 85, y: 65 },
    ],
};

type BehaviorAvg = {
    punctuality: number;
    respect: number;
    sportsmanship: number;
    swearing: number;
    aggression: number;
};
type BehaviorResp = { avg: BehaviorAvg | null; si: number; samples: number };

function siColor(si: number) {
    if (si >= 90) return { bar: "bg-sky-500", text: "text-sky-400" };
    if (si >= 60) return { bar: "bg-emerald-500", text: "text-emerald-400" };
    if (si >= 40) return { bar: "bg-amber-500", text: "text-amber-400" };
    return { bar: "bg-rose-500", text: "text-rose-400" };
}

function traitPosLabel(k: string) {
    const map: Record<string, string> = {
        GK: "Kaleci", LB: "Sol Bek", CB: "Stoper", RB: "Sağ Bek",
        LWB: "Sol Kanat Bek", RWB: "Sağ Kanat Bek",
        DM: "Ön Libero", CM: "Merkez", AM: "10 Numara",
        LW: "Sol Kanat", RW: "Sağ Kanat", ST: "Santrafor", STP: "Stoper",
    };
    return map[k] || k;
}

const BASELINE_AVG: BehaviorAvg = {
    punctuality: 4, respect: 4, sportsmanship: 4, swearing: 2, aggression: 2,
};

function siFromAvg(avg: BehaviorAvg) {
    const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
    const norm = (v: number) => (clamp(v, 1, 5) - 1) / 4;
    const P = (norm(avg.punctuality) + norm(avg.respect) + norm(avg.sportsmanship)) / 3;
    const Nminus = (1 - norm(avg.swearing) + 1 - norm(avg.aggression)) / 2;
    return Math.round(100 * (0.6 * P + 0.4 * Nminus));
}

/* =================== ALT BİLEŞENLER =================== */

function RatingStars({
    label, value, negative = false,
}: {
    label: string;
    value: number;
    negative?: boolean;
}) {
    const colorClass = (() => {
        const v = value;
        if (!negative) {
            if (v >= 4) return "text-sky-400";
            if (v >= 2.5) return "text-emerald-400";
            if (v >= 1.5) return "text-amber-400";
            return "text-rose-400";
        } else {
            if (v >= 4) return "text-rose-400";
            if (v >= 2.5) return "text-amber-400";
            if (v >= 1.5) return "text-emerald-400";
            return "text-sky-400";
        }
    })();

    const filled = Math.round(value);

    return (
        <div className="mt-1 flex items-center justify-between">
            <span className="text-sm">{label}</span>
            <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                    <svg
                        key={n}
                        viewBox="0 0 24 24"
                        className={`size-4 ${n <= filled ? colorClass : "text-neutral-600"}`}
                        fill="currentColor"
                        aria-hidden={true}
                    >
                        <title>{value.toFixed(1)}</title>
                        <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
                    </svg>
                ))}
            </div>
        </div>
    );
}

function Pitch() {
    return (
        <div className="absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.07),transparent_60%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.05),transparent_60%)]" />
            <div className="absolute inset-2 rounded-xl border-4 border-white/50" />
            <div className="absolute left-1/2 top-2 bottom-2 w-1 -translate-x-1/2 bg-white/50" />
            <div className="absolute left-1/2 top-1/2 size-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white/50" />
            <div className="absolute left-2 top-1/2 h-40 w-24 -translate-y-1/2 border-4 border-white/50" />
            <div className="absolute right-2 top-1/2 h-40 w-24 -translate-y-1/2 border-4 border-white/50" />
            <div className="absolute left-0 top-1/2 h-16 w-2 -translate-y-1/2 bg-white/70" />
            <div className="absolute right-0 top-1/2 h-16 w-2 -translate-y-1/2 bg-white/70" />
        </div>
    );
}

function PositionBadge({
    pos,
    prefIndex,
    skill,
    onClick,
}: {
    pos: { key: PositionKey; label: string; x: number; y: number };
    prefIndex: number;
    skill: number;
    onClick: () => void;
}) {
    const active = prefIndex !== -1;
    return (
        <button
            onClick={onClick}
            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-xl px-2 py-1 text-xs shadow transition ${active ? "bg-emerald-500 text-neutral-950" : "bg-black/60 text-white"
                }`}
            style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            title={`${pos.label} • Seviye ${skill}`}
        >
            <span className="font-medium">{pos.key}</span> <span className="opacity-80">{skill}</span>
            {active && <span className="ml-1 rounded bg-neutral-900/30 px-1">{prefIndex + 1}</span>}
        </button>
    );
}

function MatchHistorySection({ userId }: { userId: string }) {
    const [matches, setMatches] = React.useState<any[]>([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        if (!userId) return;
        let cancelled = false;

        (async () => {
            try {
                const r = await fetch(`${API_URL}/users/${userId}/match-history?limit=5`, {
                    headers: { ...authHeader() },
                });
                if (r.ok) {
                    const data = await r.json();
                    if (!cancelled) setMatches(data.matches || []);
                }
            } catch (e) {
                console.error('Failed to fetch match history:', e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [userId]);

    return (
        <section className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
            <h3 className="mb-3 text-base font-semibold">⚽ Son Maçlar</h3>

            {loading ? (
                <div className="text-sm text-neutral-400">Yükleniyor...</div>
            ) : matches.length === 0 ? (
                <div className="text-sm text-neutral-500">
                    Henüz tamamlanmış takım/seri maçı bulunmuyor.
                    <p className="mt-1 text-xs text-neutral-600">
                        Takım maçları oynayıp skor bildirdikten sonra burada görünecek.
                    </p>
                </div>
            ) : (
                <>
                    <div className="flex items-center gap-1 mb-3">
                        {matches.map((m) => (
                            <div
                                key={m.matchId}
                                className="relative group cursor-pointer"
                                title={`${m.opponentName} - ${m.result === 'W' ? 'Kazandı' : m.result === 'L' ? 'Kaybetti' : 'Berabere'}`}
                            >
                                <div
                                    className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold transition
                    ${m.result === 'W' ? 'bg-emerald-600 text-white' : ''}
                    ${m.result === 'L' ? 'bg-red-600 text-white' : ''}
                    ${m.result === 'D' ? 'bg-neutral-500 text-white' : ''}
                  `}
                                >
                                    {m.result === 'W' ? '1' : m.result === 'L' ? '0' : '½'}
                                </div>
                                <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border border-neutral-900
                  ${m.type === 'TEAM' ? 'bg-rose-500' : 'bg-indigo-500'}
                `} />
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                        <span className="text-emerald-400 font-medium">
                            {matches.filter(m => m.result === 'W').length}W
                        </span>
                        <span className="text-neutral-400">
                            {matches.filter(m => m.result === 'D').length}D
                        </span>
                        <span className="text-red-400 font-medium">
                            {matches.filter(m => m.result === 'L').length}L
                        </span>
                    </div>

                    <div className="mt-2 text-[10px] text-neutral-500">
                        <span className="inline-block w-2 h-2 rounded-full bg-rose-500 mr-1" /> Takım Maçı
                        <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 ml-3 mr-1" /> Seri Maçı
                    </div>
                </>
            )}
        </section>
    );
}

function PitchExplorerSection({ userId }: { userId: string }) {
    const [data, setData] = React.useState<{
        xp: number;
        level: number;
        title: string;
        visitCount: number;
        uniquePitches: number;
    } | null>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        if (!userId) return;
        let cancelled = false;

        (async () => {
            try {
                const r = await fetch(`${API_URL}/users/${userId}/pitch-explorer`, {
                    headers: { ...authHeader() },
                });
                if (r.ok) {
                    const json = await r.json();
                    if (!cancelled) setData(json);
                }
            } catch (e) {
                console.error('Failed to fetch pitch explorer:', e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [userId]);

    const levelColors = ['text-neutral-400', 'text-emerald-400', 'text-blue-400', 'text-purple-400', 'text-amber-400'];
    const levelIcons = ['🌱', '🏘️', '🏙️', '🗺️', '🌍'];

    return (
        <section className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
            <h3 className="mb-3 text-base font-semibold">🗺️ Saha Kaşifi</h3>

            {loading ? (
                <div className="text-sm text-neutral-400">Yükleniyor...</div>
            ) : !data || (data.xp === 0 && data.visitCount === 0) ? (
                <div className="text-sm text-neutral-500">
                    Henüz saha kaşifliği başlamadı.
                    <p className="mt-1 text-xs text-neutral-600">
                        Kayıtlı sahalarda maç oynadıktan sonra XP kazanmaya başlarsınız.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">{levelIcons[data.level] || '🗺️'}</span>
                            <div>
                                <div className={`font-semibold ${levelColors[data.level] || 'text-white'}`}>
                                    {data.title}
                                </div>
                                <div className="text-xs text-neutral-400">Seviye {data.level}</div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-lg font-bold text-emerald-400">{data.xp} XP</div>
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between text-xs text-neutral-400 mb-1">
                            <span>Sonraki Seviye</span>
                            <span>{data.xp} / {(data.level + 1) * 100}</span>
                        </div>
                        <div className="h-2 w-full rounded bg-neutral-800 overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 transition-all duration-500"
                                style={{ width: `${Math.min(100, (data.xp / ((data.level + 1) * 100)) * 100)}%` }}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-center">
                        <div className="rounded-lg bg-neutral-800 p-2">
                            <div className="text-lg font-bold text-white">{data.visitCount}</div>
                            <div className="text-xs text-neutral-400">Toplam Ziyaret</div>
                        </div>
                        <div className="rounded-lg bg-neutral-800 p-2">
                            <div className="text-lg font-bold text-white">{data.uniquePitches}</div>
                            <div className="text-xs text-neutral-400">Farklı Saha</div>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}

/* =================== ANA BİLEŞEN =================== */

export default function PlayerProfileCard({ userId }: { userId: string }) {
    const [user, setUser] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);

    // Formasyon (user tercihini al)
    const [formation, setFormation] = React.useState<"4-2-3-1" | "4-3-3" | "3-5-2">("4-2-3-1");

    // Davranış verisi
    const [behavior, setBehavior] = React.useState<BehaviorResp | null>(null);
    const [bLoading, setBLoading] = React.useState(true);

    // Pozisyon verisi
    const [posAgg, setPosAgg] = React.useState<Record<string, { avg: number, samples: number }>>({});

    // Rapor modal
    const [reportOpen, setReportOpen] = React.useState(false);
    // Ban modal
    const [banOpen, setBanOpen] = React.useState(false);
    const { me } = useMe();

    // 1) Kullanıcı verisini çek
    React.useEffect(() => {
        if (!userId) return;
        setLoading(true);
        fetch(`${API_URL}/users/${userId}/public-profile`, { headers: { ...authHeader() } })
            .then(r => {
                if (!r.ok) throw new Error("Kullanıcı yüklenemedi");
                return r.json();
            })
            .then(data => {
                setUser(data.user);
                if (data.user?.preferredFormation) {
                    setFormation(data.user.preferredFormation);
                }
            })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [userId]);

    // 2) Davranış verisini çek
    React.useEffect(() => {
        if (!userId) return;
        setBLoading(true);
        fetch(`${API_URL}/users/${userId}/behavior`, { headers: { ...authHeader() } })
            .then(r => r.json())
            .then(j => setBehavior(j))
            .catch(() => setBehavior({ avg: null, si: siFromAvg(BASELINE_AVG), samples: 0 }))
            .finally(() => setBLoading(false));
    }, [userId]);

    // 3) Pozisyon istatistiklerini çek
    React.useEffect(() => {
        if (!userId) return;
        fetch(`${API_URL}/users/${userId}/positions`, { headers: { ...authHeader() } })
            .then(r => r.json())
            .then(j => setPosAgg(j?.byPos || {}))
            .catch(() => setPosAgg({}));
    }, [userId]);

    if (loading) return <div className="p-4 text-neutral-400">Yükleniyor...</div>;
    if (error) return <div className="p-4 text-rose-400">Hata: {error}</div>;
    if (!user) return null;

    // Veri hazırlığı
    const prefs: string[] = Array.isArray(user.positions) ? user.positions : [];
    const levels: Record<string, number> = user.positionLevels || {};

    const mapToProfileKey = (k: string) => (k === 'STP' ? 'CB' : k);

    const perfOf = (rawKey: string) => {
        const key = mapToProfileKey(rawKey);
        const row = (posAgg as any)?.[key] || (posAgg as any)?.[rawKey];
        if (row && typeof row.avg === "number") {
            const baseline = (levels as any)?.[key];
            if (typeof baseline === "number" && typeof row.samples === "number" && row.samples >= 1) {
                return (row.avg * row.samples + baseline) / (row.samples + 1);
            }
            return row.avg;
        }
        return undefined;
    };
    const skillOf = (rawKey: string) => {
        const perf = perfOf(rawKey);
        if (typeof perf === 'number') return Math.max(1, Math.min(10, perf));

        const key = mapToProfileKey(rawKey).toUpperCase();

        const stored = (levels as any)?.[key];
        if (typeof stored === 'number') return Math.max(1, Math.min(10, stored));

        const hasPref = Array.isArray(prefs) && prefs.some(p => p.toUpperCase() === key);

        if (hasPref) {
            return 5;
        }
        return 5;
    };

    const slots = FORMATIONS[formation];
    const showAvg: BehaviorAvg = behavior?.avg ?? BASELINE_AVG;
    const si = behavior?.avg ? (behavior?.si ?? 70) : siFromAvg(showAvg);
    const siC = siColor(si);

    const warnings = behavior?.avg &&
        (Object.entries(behavior.avg) as [keyof BehaviorAvg, number][])
            .filter(([, v]) => v < 2.5);

    return (
        <div className="mx-auto grid max-w-4xl gap-4">
            {/* Başlık / Kullanıcı Bilgisi */}
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
                <div>
                    <h2 className="text-xl font-bold">{user.name || user.username || "İsimsiz Oyuncu"}</h2>
                    <div className="text-sm text-neutral-400">@{user.username || user.id.slice(0, 8)}</div>
                </div>
                <div className="flex items-center gap-4">
                    <a
                        href={`/messages/${userId}`}
                        className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium hover:bg-emerald-500"
                    >
                        Mesaj
                    </a>
                    <button
                        onClick={() => setReportOpen(true)}
                        className="rounded bg-rose-900/30 p-2 text-rose-400 hover:bg-rose-900/50"
                        title="Kullanıcıyı Raporla"
                    >
                        <AlertTriangle className="size-5" />
                    </button>
                    {me?.role === 'ADMIN' && (
                        <button
                            onClick={() => setBanOpen(true)}
                            className="rounded bg-red-900/30 p-2 text-red-500 hover:bg-red-900/50"
                            title="Kullanıcıyı Yasakla (Admin)"
                        >
                            <ShieldBan className="size-5" />
                        </button>
                    )}
                    <div className="text-right">
                        <div className="text-xs text-neutral-400">Genel Seviye</div>
                        <div className="text-2xl font-bold text-emerald-400">{user.level ?? "-"}</div>
                    </div>
                </div>
            </div>

            <section className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
                <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-base font-semibold">Kuşbakışı Saha & Tercihler</h3>
                    <div className="flex gap-2">
                        {(["4-2-3-1", "4-3-3", "3-5-2"] as const).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFormation(f)}
                                className={`rounded-lg px-3 py-1 text-sm ${formation === f ? "bg-emerald-500 text-neutral-900" : "bg-neutral-800"
                                    }`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                    {/* Saha */}
                    <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-green-800">
                        <Pitch />
                        {slots.map((p) => (
                            <PositionBadge
                                key={`${formation}-${p.key}-${p.x}-${p.y}`}
                                pos={p as any}
                                prefIndex={prefs.indexOf(p.key as any)}
                                skill={skillOf(p.key)}
                                onClick={() => { }}
                            />
                        ))}
                    </div>

                    {/* Sağ panel: Tercihler + Davranış */}
                    <div className="space-y-4">
                        {/* Tercihler */}
                        <div className="rounded-xl border border-white/10 p-3">
                            <div className="text-sm text-neutral-300">Tercihlerim</div>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {prefs.length ? (
                                    prefs.map((k: string, i: number) => (
                                        <span
                                            key={k}
                                            className="rounded-full bg-emerald-500/20 px-3 py-1 text-sm text-emerald-300"
                                        >
                                            {i + 1}. {traitPosLabel(k)} • {Number(skillOf(k)).toFixed(1)}
                                        </span>
                                    ))
                                ) : (
                                    <span className="text-xs text-neutral-400">Profilde pozisyon seçilmemiş.</span>
                                )}
                            </div>
                        </div>

                        {/* Davranış */}
                        <div className="rounded-xl border border-white/10 p-3">
                            <div className="mb-2 text-sm text-neutral-300">
                                Davranış Değerlendirmeleri (anonim, 1–5)
                            </div>

                            {bLoading && <div className="text-xs text-neutral-400">Yükleniyor…</div>}

                            {!bLoading && (
                                <>
                                    <RatingStars label="Dakiklik" value={showAvg.punctuality} />
                                    <RatingStars label="Saygı" value={showAvg.respect} />
                                    <RatingStars label="Sportmenlik" value={showAvg.sportsmanship} />
                                    <RatingStars label="Küfür" value={showAvg.swearing} />
                                    <RatingStars label="Agresiflik" value={showAvg.aggression} />

                                    <div className="mt-3 flex items-center justify-between rounded-xl bg-neutral-800 p-3">
                                        <div>
                                            <div className="text-xs text-neutral-400">Sportmenlik Katsayısı</div>
                                            <div className={`text-2xl font-semibold ${siC.text}`}>{si}</div>
                                            <div className="text-[11px] text-neutral-400">
                                                {behavior?.avg ? `Örnek sayısı: ${behavior?.samples ?? 0}` : "Topluluk başlangıcı"}
                                            </div>
                                        </div>
                                        <div className="h-2 w-40 overflow-hidden rounded bg-neutral-900">
                                            <div className={`h-full ${siC.bar}`} style={{ width: `${si}%` }} />
                                        </div>
                                    </div>

                                    {warnings && warnings.length > 0 && (
                                        <div className="mt-3 rounded-lg bg-yellow-500/10 p-2 text-[12px] text-amber-300">
                                            <div className="font-medium">Uyarılar</div>
                                            <ul className="list-disc pl-4">
                                                {warnings.map(([k, v]) => (
                                                    <li key={k}>
                                                        {({ punctuality: "Dakiklik", respect: "Saygı", sportsmanship: "Sportmenlik", swearing: "Küfür", aggression: "Agresiflik" } as any)[k]}{" "}
                                                        ort. {v.toFixed(1)} — {v < 1.5 ? "kırmızı" : "sarı"}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
                <h3 className="mb-2 text-base font-semibold">Açıklama</h3>
                <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-300">
                    <li>Diziliş seçimi sahadaki mevkileri günceller (3-5-2'de <b>LWB/RWB</b> görünür).</li>
                    <li>Değerlendirmeler 24 saat içinde yapılır ve ağırlıklandırılır.</li>
                </ul>
            </section>

            {/* Son 5 Maç W/L/D */}
            <MatchHistorySection userId={userId} />

            {/* Saha Kaşifi */}
            <PitchExplorerSection userId={userId} />

            <ReportModal
                open={reportOpen}
                onClose={() => setReportOpen(false)}
                reportedId={userId}
                reportedName={user.name || user.username || "Kullanıcı"}
            />
            <BanUserModal
                open={banOpen}
                onClose={() => setBanOpen(false)}
                userId={userId}
                userName={user.name || user.username || "Kullanıcı"}
            />
        </div>
    );
}

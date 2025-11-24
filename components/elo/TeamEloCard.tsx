"use client";

import React, { useEffect, useState } from "react";
import { Trophy, TrendingUp, TrendingDown, Minus, Shield, AlertTriangle } from "lucide-react";
import { authHeader } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface EloStats {
  elo: number;
  reputationScore: number;
  matchCount: number;
  winStreak: number;
  lossStreak: number;
  isProvisional: boolean;
  recentHistory: { result: "W" | "L" | "D"; eloDelta: number; date: string }[];
  rank?: number;
}

interface TeamEloCardProps {
  teamId: string;
  showReputation?: boolean; // Sadece takım yöneticileri için
}

/**
 * Maç geçmişi göstergesi (W W D L W formatında)
 */
function MatchHistoryIndicator({
  history,
}: {
  history: { result: "W" | "L" | "D"; eloDelta: number }[];
}) {
  const colorMap = {
    W: "text-emerald-400",
    L: "text-red-400",
    D: "text-neutral-400",
  };

  return (
    <div className="flex items-center gap-1.5">
      {history.slice(0, 5).map((match, i) => (
        <span
          key={i}
          className={`text-sm font-bold ${colorMap[match.result]}`}
          title={`${match.result === "W" ? "Galibiyet" : match.result === "L" ? "Mağlubiyet" : "Beraberlik"} (${match.eloDelta > 0 ? "+" : ""}${match.eloDelta})`}
        >
          {match.result}
        </span>
      ))}
    </div>
  );
}

/**
 * Elo değişim göstergesi
 */
function EloDeltaIndicator({ delta }: { delta: number }) {
  if (delta > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-400 text-sm">
        <TrendingUp className="size-4" />+{delta}
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-red-400 text-sm">
        <TrendingDown className="size-4" />
        {delta}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-neutral-400 text-sm">
      <Minus className="size-4" />0
    </span>
  );
}

/**
 * İtibar puanı göstergesi (sadece yöneticilere görünür)
 */
function ReputationIndicator({
  score,
  visible,
}: {
  score: number;
  visible: boolean;
}) {
  if (!visible) return null;

  const getColor = () => {
    if (score >= 4) return "text-emerald-400";
    if (score >= 3) return "text-yellow-400";
    if (score >= 2) return "text-orange-400";
    return "text-red-400";
  };

  const getIcon = () => {
    if (score >= 4) return <Shield className="size-4" />;
    if (score >= 2) return <AlertTriangle className="size-4" />;
    return <AlertTriangle className="size-4 text-red-400" />;
  };

  return (
    <div className={`flex items-center gap-1 ${getColor()}`}>
      {getIcon()}
      <span className="text-sm font-medium">
        İtibar: {score.toFixed(1)}/5.0
      </span>
    </div>
  );
}

/**
 * Ana Elo Kartı
 */
export default function TeamEloCard({ teamId, showReputation = false }: TeamEloCardProps) {
  const [stats, setStats] = useState<EloStats | null>(null);
  const [reputation, setReputation] = useState<{
    visible: boolean;
    reputationScore: number;
    warning?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        // Elo stats
        const statsRes = await fetch(`${API_URL}/elo/teams/${teamId}/stats`);
        if (statsRes.ok) {
          const data = await statsRes.json();
          setStats(data);
        }

        // Reputation (auth required)
        if (showReputation) {
          const repRes = await fetch(`${API_URL}/elo/teams/${teamId}/reputation`, {
            headers: { ...authHeader() },
          });
          if (repRes.ok) {
            const data = await repRes.json();
            setReputation(data);
          }
        }
      } catch (e) {
        console.error("Elo stats fetch error:", e);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [teamId, showReputation]);

  if (loading) {
    return (
      <div className="rounded-xl bg-neutral-900/60 border border-white/10 p-4 animate-pulse">
        <div className="h-8 bg-neutral-800 rounded w-24 mb-2" />
        <div className="h-4 bg-neutral-800 rounded w-32" />
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const lastDelta = stats.recentHistory[0]?.eloDelta || 0;

  return (
    <div className="rounded-xl bg-neutral-900/60 border border-white/10 p-4 space-y-3">
      {/* Elo ve Rank */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="size-6 text-amber-400" />
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold">{stats.elo}</span>
              <span className="text-sm text-neutral-400">ELO</span>
              <EloDeltaIndicator delta={lastDelta} />
            </div>
            {stats.isProvisional && (
              <span className="text-xs text-amber-400">
                Provisional ({stats.matchCount}/5 maç)
              </span>
            )}
          </div>
        </div>

        {stats.rank && !stats.isProvisional && (
          <div className="text-right">
            <span className="text-xl font-bold text-neutral-200">#{stats.rank}</span>
            <p className="text-xs text-neutral-400">Sıralama</p>
          </div>
        )}
      </div>

      {/* Streak göstergesi */}
      {(stats.winStreak > 0 || stats.lossStreak > 0) && (
        <div className="flex items-center gap-2">
          {stats.winStreak > 0 && (
            <span className="inline-flex items-center gap-1 text-sm text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded">
              🔥 {stats.winStreak} galibiyet serisi
            </span>
          )}
          {stats.lossStreak > 0 && (
            <span className="inline-flex items-center gap-1 text-sm text-red-400 bg-red-400/10 px-2 py-1 rounded">
              📉 {stats.lossStreak} mağlubiyet serisi
            </span>
          )}
        </div>
      )}

      {/* Son 5 maç geçmişi */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-400">Son 5 maç:</span>
        <MatchHistoryIndicator history={stats.recentHistory} />
      </div>

      {/* İtibar Puanı (sadece yöneticilere) */}
      {reputation?.visible && (
        <div className="pt-2 border-t border-white/10">
          <ReputationIndicator
            score={reputation.reputationScore}
            visible={reputation.visible}
          />
          {reputation.warning && (
            <p className="text-xs text-amber-400 mt-1">{reputation.warning}</p>
          )}
        </div>
      )}

      {/* Maç sayısı */}
      <div className="text-xs text-neutral-500">
        Toplam {stats.matchCount} maç oynandı
      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { Trophy, Medal, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface LeaderboardTeam {
  id: string;
  name: string;
  elo: number;
  matchCount: number;
  rank: number;
}

interface LeaderboardData {
  teams: LeaderboardTeam[];
  total: number;
}

export default function EloLeaderboard() {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true);
      try {
        const res = await fetch(
          `${API_URL}/elo/leaderboard?limit=${pageSize}&offset=${page * pageSize}`
        );
        if (res.ok) {
          const json = await res.json();
          setData(json);
        }
      } catch (e) {
        console.error("Leaderboard fetch error:", e);
      } finally {
        setLoading(false);
      }
    }

    fetchLeaderboard();
  }, [page]);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="size-5 text-amber-400" />;
      case 2:
        return <Medal className="size-5 text-neutral-300" />;
      case 3:
        return <Medal className="size-5 text-amber-600" />;
      default:
        return <span className="text-neutral-500 font-mono">{rank}</span>;
    }
  };

  const getRankBg = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-gradient-to-r from-amber-500/20 to-transparent border-amber-500/30";
      case 2:
        return "bg-gradient-to-r from-neutral-400/20 to-transparent border-neutral-400/30";
      case 3:
        return "bg-gradient-to-r from-amber-700/20 to-transparent border-amber-700/30";
      default:
        return "bg-neutral-900/40 border-white/5";
    }
  };

  if (loading && !data) {
    return (
      <div className="rounded-xl bg-neutral-900/60 border border-white/10 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-neutral-800 rounded w-32" />
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-neutral-800 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.teams.length === 0) {
    return (
      <div className="rounded-xl bg-neutral-900/60 border border-white/10 p-6 text-center">
        <Trophy className="size-12 text-neutral-600 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-neutral-400">Henüz Sıralama Yok</h3>
        <p className="text-sm text-neutral-500 mt-1">
          Takımlar en az 5 maç oynadıktan sonra sıralamaya girecek.
        </p>
      </div>
    );
  }

  const totalPages = Math.ceil(data.total / pageSize);

  return (
    <div className="rounded-xl bg-neutral-900/60 border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Trophy className="size-6 text-amber-400" />
          <h2 className="text-lg font-semibold">Elo Sıralaması</h2>
        </div>
        <span className="text-sm text-neutral-400">
          {data.total} takım
        </span>
      </div>

      {/* Table */}
      <div className="divide-y divide-white/5">
        {data.teams.map((team) => (
          <Link
            key={team.id}
            href={`/teams/${team.id}`}
            className={`flex items-center justify-between px-6 py-3 hover:bg-white/5 transition border-l-2 ${getRankBg(team.rank)}`}
          >
            <div className="flex items-center gap-4">
              <div className="w-8 flex justify-center">
                {getRankIcon(team.rank)}
              </div>
              <div>
                <p className="font-medium">{team.name}</p>
                <p className="text-xs text-neutral-500">
                  {team.matchCount} maç
                </p>
              </div>
            </div>

            <div className="text-right">
              <p className="text-lg font-bold">{team.elo}</p>
              <p className="text-xs text-neutral-500">ELO</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="size-4" /> Önceki
          </button>

          <span className="text-sm text-neutral-500">
            {page + 1} / {totalPages}
          </span>

          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Sonraki <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}

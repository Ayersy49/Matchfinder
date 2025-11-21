// app/match/[id]/MatchProposalsSection.tsx

"use client";

import React from "react";
import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import { Clock, ThumbsUp, ThumbsDown, Trash2, Plus } from "lucide-react";
import {
  getMatchProposals,
  createMatchProposal,
  voteMatchProposal,
  deleteMatchProposal,
  MatchProposal,
} from "@/lib/api";

interface Props {
  matchId: string;
  currentUserId: string;
}

export default function MatchProposalsSection({ matchId, currentUserId }: Props) {
  const [proposals, setProposals] = React.useState<MatchProposal[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState("");
  const [selectedTime, setSelectedTime] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  // Önerileri yükle
  async function fetchProposals() {
    setLoading(true);
    setError(null);
    try {
      const data = await getMatchProposals(matchId);
      setProposals(data);
    } catch (err: any) {
      setError(err?.message || "Öneriler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    fetchProposals();
  }, [matchId]);

  // Yeni öneri oluştur
  async function handleCreateProposal(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDate || !selectedTime) return;

    setCreating(true);
    try {
      const proposedDate = new Date(`${selectedDate}T${selectedTime}`).toISOString();
      await createMatchProposal(matchId, proposedDate);
      await fetchProposals(); // Listeyi yenile
      setShowCreateForm(false);
      setSelectedDate("");
      setSelectedTime("");
    } catch (err: any) {
      alert(err?.message || "Öneri oluşturulamadı");
    } finally {
      setCreating(false);
    }
  }

  // Oy ver
  async function handleVote(proposalId: string, voteType: "ACCEPT" | "REJECT") {
    try {
      // Optimistic update
      setProposals((prev) =>
        prev.map((p) => {
          if (p.id !== proposalId) return p;

          const prevVote = p.userVote;
          let acceptCount = p.acceptCount;
          let rejectCount = p.rejectCount;

          if (prevVote === "ACCEPT") acceptCount--;
          if (prevVote === "REJECT") rejectCount--;
          if (voteType === "ACCEPT") acceptCount++;
          if (voteType === "REJECT") rejectCount++;

          return { ...p, userVote: voteType, acceptCount, rejectCount };
        })
      );

      await voteMatchProposal(matchId, proposalId, voteType);
    } catch (err: any) {
      alert(err?.message || "Oy verilemedi");
      fetchProposals(); // Hata durumunda geri al
    }
  }

  // Öneri sil
  async function handleDelete(proposalId: string) {
    if (!confirm("Bu öneriyi silmek istediğinizden emin misiniz?")) return;
    try {
      await deleteMatchProposal(matchId, proposalId);
      setProposals((prev) => prev.filter((p) => p.id !== proposalId));
    } catch (err: any) {
      alert(err?.message || "Öneri silinemedi");
    }
  }

  // Telefon maskele
  const maskPhone = (phone: string) => {
    if (phone.length < 10) return phone;
    return `${phone.substring(0, 3)} *** **`;
  };

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-neutral-400" />
          <h3 className="text-lg font-semibold">Saat & Tarih Önerileri</h3>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-medium text-neutral-950 hover:bg-emerald-500"
        >
          <Plus className="h-4 w-4" />
          Yeni Öneri
        </button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <form
          onSubmit={handleCreateProposal}
          className="space-y-3 rounded-xl border border-white/10 bg-neutral-800/60 p-4"
        >
          <h4 className="text-sm font-medium">Yeni Tarih & Saat Öner</h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-neutral-400">Tarih</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
                required
                className="w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-400">Saat</label>
              <input
                type="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                required
                className="w-full rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-emerald-500 disabled:opacity-50"
            >
              {creating ? "Oluşturuluyor..." : "Öner"}
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="rounded-xl bg-neutral-700 px-4 py-2 text-sm hover:bg-neutral-600"
            >
              İptal
            </button>
          </div>
        </form>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-rose-500/15 p-3 text-sm text-rose-300 ring-1 ring-rose-500/30">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && <div className="text-center text-sm text-neutral-400 py-4">Yükleniyor…</div>}

      {/* Empty State */}
      {!loading && proposals.length === 0 && (
        <div className="text-center text-sm text-neutral-400 py-8">
          Henüz öneri yok. İlk öneriyi siz oluşturun!
        </div>
      )}

      {/* Proposals List */}
      {!loading && proposals.length > 0 && (
        <div className="space-y-3">
          {proposals.map((proposal) => {
            const proposedDate = parseISO(proposal.proposedDate);
            const isOwner = proposal.proposedBy === currentUserId;

            return (
              <div
                key={proposal.id}
                className="rounded-xl border border-white/10 bg-neutral-800/60 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    {/* Proposer */}
                    <div className="mb-2 flex items-center gap-2">
                      <div className="grid h-6 w-6 place-items-center rounded-full bg-emerald-600 text-xs font-bold text-neutral-950">
                        {proposal.proposer.phone.charAt(0)}
                      </div>
                      <span className="text-sm text-neutral-300">
                        {maskPhone(proposal.proposer.phone)}
                      </span>
                    </div>

                    {/* Date & Time */}
                    <div className="mb-3 text-lg font-semibold text-emerald-400">
                      {format(proposedDate, "dd MMMM yyyy - HH:mm", { locale: tr })}
                    </div>

                    {/* Vote Stats */}
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1 text-emerald-400">
                        <ThumbsUp className="h-4 w-4" />
                        <span>{proposal.acceptCount}</span>
                      </div>
                      <div className="flex items-center gap-1 text-rose-400">
                        <ThumbsDown className="h-4 w-4" />
                        <span>{proposal.rejectCount}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {!isOwner && (
                      <>
                        <button
                          onClick={() => handleVote(proposal.id, "ACCEPT")}
                          className={`rounded-lg p-2 transition ${
                            proposal.userVote === "ACCEPT"
                              ? "bg-emerald-600 text-white"
                              : "bg-neutral-700 hover:bg-neutral-600"
                          }`}
                          title="Kabul et"
                        >
                          <ThumbsUp className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleVote(proposal.id, "REJECT")}
                          className={`rounded-lg p-2 transition ${
                            proposal.userVote === "REJECT"
                              ? "bg-rose-600 text-white"
                              : "bg-neutral-700 hover:bg-neutral-600"
                          }`}
                          title="Reddet"
                        >
                          <ThumbsDown className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    {isOwner && (
                      <button
                        onClick={() => handleDelete(proposal.id)}
                        className="rounded-lg bg-rose-600 p-2 hover:bg-rose-700"
                        title="Sil"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
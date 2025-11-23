// app/match/[id]/MatchProposalsSection.tsx
"use client";

import React from "react";
import { format, parseISO } from "date-fns";
import { tr } from "date-fns/locale";
import { Clock, ThumbsUp, ThumbsDown, Plus, CheckCircle } from "lucide-react";
import {
  getTimeProposals,
  proposeTime,
  voteTimeProposal,
  applyTimeProposal,
  TimeProposalItem,
  TimeProposalVote,
} from "@/lib/api";

interface Props {
  matchId: string;
}

export default function MatchProposalsSection({ matchId }: Props) {
  const [items, setItems] = React.useState<TimeProposalItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = React.useState(false);
  const [selectedDate, setSelectedDate] = React.useState("");
  const [selectedTime, setSelectedTime] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const list = await getTimeProposals(matchId);
      setItems(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setError(e?.message || "Öneriler yüklenemedi");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, [matchId]);

  // Yeni saat & tarih öner
  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDate || !selectedTime) return;
    setCreating(true);
    try {
      const iso = new Date(`${selectedDate}T${selectedTime}`).toISOString();
      await proposeTime(matchId, iso);
      setShowCreateForm(false);
      setSelectedDate("");
      setSelectedTime("");
      await load();
    } catch (e: any) {
      const msg = String(e?.message || "");
      alert(
        msg.includes("duplicate_time")
          ? "Aynı tarih/saat zaten önerildi."
          : msg || "Öneri oluşturulamadı"
      );
    } finally {
      setCreating(false);
    }
  }

  // Oy ver (UP/DOWN). Admin için UP taraf onayıdır; iki taraf onaylıysa BE otomatik uygulayabilir.
  async function onVote(pid: string, value: TimeProposalVote) {
    // optimistic
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== pid) return it;
        let up = it.votesUp;
        let down = it.votesDown;
        if (it.myVote === "UP") up--;
        if (it.myVote === "DOWN") down--;
        if (value === "UP") up++;
        else down++;
        return { ...it, myVote: value, votesUp: up, votesDown: down };
      })
    );
    try {
      const r = await voteTimeProposal(matchId, pid, value);
      if (r?.applied) {
        // BE maçı güncellediyse listede statü değişmiş olabilir
        await load();
      }
    } catch (e: any) {
      alert(e?.message || "Oy verilemedi");
      load(); // geri al
    }
  }

  // İki taraf da onayladıysa manuel uygula (owner veya takım admini)
  async function onApply(pid: string) {
    try {
      const r = await applyTimeProposal(matchId, pid);
      if (r?.ok) {
        alert("Tarih & saat uygulandı.");
        await load();
      }
    } catch (e: any) {
      alert(e?.message || "Uygulanamadı");
    }
  }

  const maskPhone = (p: string) =>
    !p || p.length < 10 ? p : `${p.slice(0, 3)} *** **`;

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-neutral-400" />
          <h3 className="text-lg font-semibold">Saat & Tarih Önerileri</h3>
        </div>
        <button
          onClick={() => setShowCreateForm((s) => !s)}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-medium text-neutral-950 hover:bg-emerald-500"
        >
          <Plus className="h-4 w-4" />
          Yeni Öneri
        </button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <form
          onSubmit={onCreate}
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
              {creating ? "Oluşturuluyor…" : "Öner"}
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
      {loading && (
        <div className="py-4 text-center text-sm text-neutral-400">Yükleniyor…</div>
      )}

      {/* Empty */}
      {!loading && items.length === 0 && (
        <div className="py-8 text-center text-sm text-neutral-400">
          Henüz öneri yok. İlk öneriyi siz oluşturun!
        </div>
      )}

      {/* List */}
      {!loading && items.length > 0 && (
        <div className="space-y-3">
          {items.map((it) => {
            const dt = it.time ? parseISO(it.time) : null;
            const dateText = it.time
              ? format(dt!, "dd MMMM yyyy - HH:mm", { locale: tr })
              : "—";

            return (
              <div
                key={it.id}
                className="rounded-xl border border-white/10 bg-neutral-800/60 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    {/* Proposer */}
                    <div className="mb-2 flex items-center gap-2">
                      <div className="grid h-6 w-6 place-items-center rounded-full bg-emerald-600 text-xs font-bold text-neutral-950">
                        {(it.by || "?").toString().slice(0, 1).toUpperCase()}
                      </div>
                      <span className="text-sm text-neutral-300">
                        {/* BE'de proposer phone dönmüyor; sadece süs için userId kısalt */}
                        {maskPhone(it.by)}
                      </span>
                    </div>

                    {/* Date */}
                    <div className="mb-2 text-lg font-semibold text-emerald-400">
                      {dateText}
                    </div>

                    {/* Status row */}
                    <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-neutral-300">
                      <span className="inline-flex items-center gap-1">
                        <ThumbsUp className="h-4 w-4" />
                        {it.votesUp}
                      </span>
                      <span className="inline-flex items-center gap-1 text-rose-400">
                        <ThumbsDown className="h-4 w-4" />
                        {it.votesDown}
                      </span>

                      <span className="mx-1 h-4 w-px bg-white/10" />

                      <span
                        className={`rounded-md px-2 py-0.5 ${
                          it.approvedA ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-neutral-300"
                        }`}
                        title="Takım A kaptan onayı"
                      >
                        A onay {it.approvedA ? "✓" : "–"}
                      </span>
                      <span
                        className={`rounded-md px-2 py-0.5 ${
                          it.approvedB ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-neutral-300"
                        }`}
                        title="Takım B kaptan onayı"
                      >
                        B onay {it.approvedB ? "✓" : "–"}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col items-stretch gap-2 sm:flex-row">
                    <button
                      onClick={() => onVote(it.id, "UP")}
                      className={`rounded-lg p-2 transition ${
                        it.myVote === "UP"
                          ? "bg-emerald-600 text-white"
                          : "bg-neutral-700 hover:bg-neutral-600"
                      }`}
                      title="Kabul"
                    >
                      <ThumbsUp className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onVote(it.id, "DOWN")}
                      className={`rounded-lg p-2 transition ${
                        it.myVote === "DOWN"
                          ? "bg-rose-600 text-white"
                          : "bg-neutral-700 hover:bg-neutral-600"
                      }`}
                      title="Reddet"
                    >
                      <ThumbsDown className="h-4 w-4" />
                    </button>

                    {it.canFinalize && (
                      <button
                        onClick={() => onApply(it.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-emerald-500"
                        title="Uygula (maç saatini buna çek)"
                      >
                        <CheckCircle className="h-4 w-4" />
                        Uygula
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

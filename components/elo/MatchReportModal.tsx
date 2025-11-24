"use client";

import React, { useState, useEffect } from "react";
import { X, Send, AlertTriangle, CheckCircle, Clock, XCircle } from "lucide-react";
import { authHeader } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface MatchReportModalProps {
  open: boolean;
  onClose: () => void;
  matchId: string;
  teamId: string;
  teamAName: string;
  teamBName: string;
  onReported?: () => void;
}

interface ReportStatus {
  matchId: string;
  verificationStatus: "NONE" | "PENDING" | "VERIFIED" | "DISPUTED" | "INVALID";
  disputeDeadline?: string;
  scoreTeamA?: number;
  scoreTeamB?: number;
  teamA: { id: string; name: string };
  teamB: { id: string; name: string };
  reports: Array<{
    id: string;
    teamId: string;
    teamName: string;
    reporterName: string;
    scoreTeamA: number;
    scoreTeamB: number;
    createdAt: string;
  }>;
}

export default function MatchReportModal({
  open,
  onClose,
  matchId,
  teamId,
  teamAName,
  teamBName,
  onReported,
}: MatchReportModalProps) {
  const [scoreTeamA, setScoreTeamA] = useState(0);
  const [scoreTeamB, setScoreTeamB] = useState(0);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [reportStatus, setReportStatus] = useState<ReportStatus | null>(null);
  const [fetchingStatus, setFetchingStatus] = useState(true);

  // Mevcut raporları yükle
  useEffect(() => {
    if (!open || !matchId) return;

    async function fetchReports() {
      setFetchingStatus(true);
      try {
        const res = await fetch(`${API_URL}/elo/matches/${matchId}/reports`, {
          headers: { ...authHeader() },
        });
        if (res.ok) {
          const data = await res.json();
          setReportStatus(data);

          // Eğer zaten rapor gönderilmişse, skoru göster
          const myReport = data.reports.find((r: any) => r.teamId === teamId);
          if (myReport) {
            setScoreTeamA(myReport.scoreTeamA);
            setScoreTeamB(myReport.scoreTeamB);
          }
        }
      } catch (e) {
        console.error("Report status fetch error:", e);
      } finally {
        setFetchingStatus(false);
      }
    }

    fetchReports();
  }, [open, matchId, teamId]);

  async function submitReport() {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`${API_URL}/elo/matches/${matchId}/report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader(),
        },
        body: JSON.stringify({
          teamId,
          scoreTeamA,
          scoreTeamB,
          notes: notes || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Rapor gönderilemedi");
      }

      setSuccess(data.message);
      onReported?.();

      // Status'u güncelle
      if (data.status === "VERIFIED" || data.status === "DISPUTED") {
        // Yeniden fetch et
        const statusRes = await fetch(`${API_URL}/elo/matches/${matchId}/reports`, {
          headers: { ...authHeader() },
        });
        if (statusRes.ok) {
          setReportStatus(await statusRes.json());
        }
      }
    } catch (e: any) {
      setError(e.message || "Bir hata oluştu");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  const hasMyReport = reportStatus?.reports.some((r) => r.teamId === teamId);
  const isVerified = reportStatus?.verificationStatus === "VERIFIED";
  const isDisputed = reportStatus?.verificationStatus === "DISPUTED";
  const isInvalid = reportStatus?.verificationStatus === "INVALID";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-neutral-900 ring-1 ring-white/10 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Maç Sonucu Bildir</h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white transition"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Loading */}
        {fetchingStatus && (
          <div className="text-center py-8 text-neutral-400">
            Yükleniyor...
          </div>
        )}

        {/* Status Banner */}
        {!fetchingStatus && reportStatus && (
          <div className="mb-4">
            {isVerified && (
              <div className="flex items-center gap-2 bg-emerald-500/20 border border-emerald-500/30 rounded-lg px-4 py-3 text-emerald-300">
                <CheckCircle className="size-5" />
                <div>
                  <p className="font-medium">Maç Onaylandı</p>
                  <p className="text-sm">
                    Skor: {reportStatus.scoreTeamA} - {reportStatus.scoreTeamB}
                  </p>
                </div>
              </div>
            )}

            {isDisputed && (
              <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-500/30 rounded-lg px-4 py-3 text-amber-300">
                <AlertTriangle className="size-5" />
                <div>
                  <p className="font-medium">Anlaşmazlık!</p>
                  <p className="text-sm">
                    Raporlar uyuşmuyor. Lütfen rakip takımla iletişime geçin.
                  </p>
                  {reportStatus.disputeDeadline && (
                    <p className="text-xs mt-1">
                      Son tarih:{" "}
                      {new Date(reportStatus.disputeDeadline).toLocaleString("tr-TR")}
                    </p>
                  )}
                </div>
              </div>
            )}

            {isInvalid && (
              <div className="flex items-center gap-2 bg-red-500/20 border border-red-500/30 rounded-lg px-4 py-3 text-red-300">
                <XCircle className="size-5" />
                <div>
                  <p className="font-medium">Maç Geçersiz</p>
                  <p className="text-sm">
                    Anlaşmazlık çözülemedi. Elo değişimi uygulanmadı.
                  </p>
                </div>
              </div>
            )}

            {reportStatus.verificationStatus === "PENDING" && (
              <div className="flex items-center gap-2 bg-blue-500/20 border border-blue-500/30 rounded-lg px-4 py-3 text-blue-300">
                <Clock className="size-5" />
                <div>
                  <p className="font-medium">Rakip Bekleniyor</p>
                  <p className="text-sm">Rakip takımın raporunu bekliyoruz.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Existing Reports */}
        {!fetchingStatus && reportStatus && reportStatus.reports.length > 0 && (
          <div className="mb-4 space-y-2">
            <p className="text-sm text-neutral-400">Gönderilen Raporlar:</p>
            {reportStatus.reports.map((report) => (
              <div
                key={report.id}
                className={`rounded-lg px-3 py-2 text-sm ${
                  report.teamId === teamId
                    ? "bg-emerald-500/10 border border-emerald-500/20"
                    : "bg-neutral-800"
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium">{report.teamName}</span>
                  <span className="font-mono">
                    {report.scoreTeamA} - {report.scoreTeamB}
                  </span>
                </div>
                <p className="text-xs text-neutral-400">
                  {report.reporterName} •{" "}
                  {new Date(report.createdAt).toLocaleString("tr-TR")}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Score Input Form - sadece rapor gönderilmemişse ve doğrulanmamışsa */}
        {!fetchingStatus && !hasMyReport && !isVerified && !isInvalid && (
          <>
            {/* Score Input */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <label className="block text-sm text-neutral-400 mb-2">
                  {teamAName}
                </label>
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={scoreTeamA}
                  onChange={(e) => setScoreTeamA(parseInt(e.target.value) || 0)}
                  className="w-full text-center text-2xl font-bold bg-neutral-800 rounded-xl py-3 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-emerald-400"
                />
              </div>

              <div className="flex items-center justify-center text-2xl text-neutral-500">
                -
              </div>

              <div className="text-center">
                <label className="block text-sm text-neutral-400 mb-2">
                  {teamBName}
                </label>
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={scoreTeamB}
                  onChange={(e) => setScoreTeamB(parseInt(e.target.value) || 0)}
                  className="w-full text-center text-2xl font-bold bg-neutral-800 rounded-xl py-3 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-emerald-400"
                />
              </div>
            </div>

            {/* Notes */}
            <div className="mb-4">
              <label className="block text-sm text-neutral-400 mb-2">
                Not (opsiyonel)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Maç hakkında not..."
                rows={2}
                className="w-full bg-neutral-800 rounded-xl px-4 py-2 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-emerald-400 resize-none"
              />
            </div>
          </>
        )}

        {/* Error/Success Messages */}
        {error && (
          <div className="mb-4 rounded-lg bg-red-500/20 border border-red-500/30 px-4 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-lg bg-emerald-500/20 border border-emerald-500/30 px-4 py-2 text-sm text-emerald-300">
            {success}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-neutral-800 px-4 py-3 font-medium hover:bg-neutral-700 transition"
          >
            Kapat
          </button>

          {!hasMyReport && !isVerified && !isInvalid && (
            <button
              onClick={submitReport}
              disabled={loading}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-medium text-neutral-950 hover:bg-emerald-500 disabled:opacity-50 transition"
            >
              <Send className="size-4" />
              {loading ? "Gönderiliyor..." : "Gönder"}
            </button>
          )}
        </div>

        {/* Info */}
        <p className="text-xs text-neutral-500 text-center mt-4">
          Her iki takım da aynı skoru bildirirse maç onaylanır ve Elo güncellenir.
        </p>
      </div>
    </div>
  );
}

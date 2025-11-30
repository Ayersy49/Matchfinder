import * as React from "react";
import { authHeader } from "@/lib/auth";
import { AlertTriangle, X } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type Props = {
    open: boolean;
    onClose: () => void;
    userId: string;
    userName: string;
};

export default function BanUserModal({ open, onClose, userId, userName }: Props) {
    const [days, setDays] = React.useState(0);
    const [hours, setHours] = React.useState(0);
    const [minutes, setMinutes] = React.useState(0);
    const [reason, setReason] = React.useState("");
    const [loading, setLoading] = React.useState(false);

    async function handleBan() {
        const totalMinutes = (days * 24 * 60) + (hours * 60) + minutes;
        if (totalMinutes <= 0) return alert("Lütfen geçerli bir süre girin.");
        if (!reason) return alert("Lütfen bir sebep belirtin.");

        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/admin/users/${userId}/ban`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...authHeader(),
                },
                body: JSON.stringify({ duration: totalMinutes, reason }),
            });

            if (res.ok) {
                alert("Kullanıcı yasaklandı.");
                onClose();
            } else {
                const j = await res.json();
                alert(j.message || "Hata oluştu.");
            }
        } catch (e) {
            alert("Bir hata oluştu.");
        } finally {
            setLoading(false);
        }
    }

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-neutral-900 p-6 ring-1 ring-white/10">
                <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-rose-500">
                        <AlertTriangle className="size-5" />
                        <h2 className="text-lg font-bold">Kullanıcıyı Yasakla</h2>
                    </div>
                    <button onClick={onClose} className="text-neutral-400 hover:text-white">
                        <X className="size-5" />
                    </button>
                </div>

                <div className="mb-4 text-sm text-neutral-300">
                    <span className="font-bold text-white">{userName}</span> adlı kullanıcıyı yasaklamak üzeresiniz.
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-2">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-neutral-400">Gün</label>
                            <input
                                type="number"
                                min="0"
                                value={days}
                                onChange={(e) => setDays(Number(e.target.value))}
                                className="w-full rounded-lg bg-neutral-800 px-3 py-2 text-sm text-white focus:ring-1 focus:ring-rose-500"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-neutral-400">Saat</label>
                            <input
                                type="number"
                                min="0"
                                max="23"
                                value={hours}
                                onChange={(e) => setHours(Number(e.target.value))}
                                className="w-full rounded-lg bg-neutral-800 px-3 py-2 text-sm text-white focus:ring-1 focus:ring-rose-500"
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-xs font-medium text-neutral-400">Dakika</label>
                            <input
                                type="number"
                                min="0"
                                max="59"
                                value={minutes}
                                onChange={(e) => setMinutes(Number(e.target.value))}
                                className="w-full rounded-lg bg-neutral-800 px-3 py-2 text-sm text-white focus:ring-1 focus:ring-rose-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="mb-1 block text-xs font-medium text-neutral-400">Sebep</label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Yasaklama sebebi..."
                            className="h-24 w-full resize-none rounded-lg bg-neutral-800 px-3 py-2 text-sm text-white focus:ring-1 focus:ring-rose-500"
                        />
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium hover:bg-neutral-700"
                    >
                        İptal
                    </button>
                    <button
                        onClick={handleBan}
                        disabled={loading}
                        className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
                    >
                        {loading ? "İşleniyor..." : "Yasakla"}
                    </button>
                </div>
            </div>
        </div>
    );
}

import * as React from "react";
import { authHeader } from "@/lib/auth";
import { AlertTriangle } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type Props = {
    open: boolean;
    onClose: () => void;
    reportedId: string;
    reportedName: string;
};

export default function ReportModal({ open, onClose, reportedId, reportedName }: Props) {
    const [reason, setReason] = React.useState("");
    const [desc, setDesc] = React.useState("");
    const [sending, setSending] = React.useState(false);

    // Reset state when opening
    React.useEffect(() => {
        if (open) {
            setReason("");
            setDesc("");
        }
    }, [open]);

    if (!open) return null;

    async function send() {
        if (!reason) return alert("Lütfen bir sebep seçin.");
        setSending(true);
        try {
            const r = await fetch(`${API_URL}/reports`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeader() },
                body: JSON.stringify({ reportedId, reason, description: desc }),
            });
            if (r.ok) {
                alert("Rapor gönderildi. Teşekkürler.");
                onClose();
            } else {
                alert("Rapor gönderilemedi.");
            }
        } catch {
            alert("Hata oluştu.");
        } finally {
            setSending(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-2xl bg-neutral-900 p-4 ring-1 ring-white/10">
                <div className="mb-4 flex items-center gap-2 text-rose-400">
                    <AlertTriangle className="size-5" />
                    <h2 className="text-lg font-bold">Kullanıcıyı Raporla</h2>
                </div>
                <div className="mb-4 text-sm text-neutral-300">
                    <b>{reportedName}</b> adlı kullanıcıyı neden raporluyorsunuz?
                </div>

                <div className="space-y-2 mb-4">
                    {["Küfür/Hakaret", "Agresif Davranış", "Maça Gelmedi", "Hile/Spam", "Diğer"].map(r => (
                        <label key={r} className="flex items-center gap-2 rounded bg-neutral-800 p-2 cursor-pointer hover:bg-neutral-700">
                            <input type="radio" name="reason" value={r} checked={reason === r} onChange={e => setReason(e.target.value)} />
                            <span className="text-sm">{r}</span>
                        </label>
                    ))}
                </div>

                <textarea
                    className="w-full rounded bg-neutral-800 p-2 text-sm mb-4 outline-none ring-1 ring-white/10 focus:ring-rose-500"
                    placeholder="Ek açıklama (opsiyonel)..."
                    rows={3}
                    value={desc}
                    onChange={e => setDesc(e.target.value)}
                />

                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="rounded bg-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-600">İptal</button>
                    <button onClick={send} disabled={sending} className="rounded bg-rose-600 px-3 py-1.5 text-sm font-medium hover:bg-rose-500 disabled:opacity-50">
                        {sending ? "Gönderiliyor..." : "Raporla"}
                    </button>
                </div>
            </div>
        </div>
    );
}

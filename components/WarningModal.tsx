import * as React from "react";
import { authHeader } from "@/lib/auth";
import { AlertTriangle } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type Warning = {
    id: string;
    message: string;
    type: string;
};

export default function WarningModal() {
    const [warnings, setWarnings] = React.useState<Warning[]>([]);
    const [current, setCurrent] = React.useState<Warning | null>(null);

    React.useEffect(() => {
        fetch(`${API_URL}/ratings/warnings`, { headers: { ...authHeader() } })
            .then(r => r.json())
            .then(data => {
                if (Array.isArray(data.items) && data.items.length > 0) {
                    setWarnings(data.items);
                    setCurrent(data.items[0]);
                }
            })
            .catch(() => { });
    }, []);

    async function ack() {
        if (!current) return;
        try {
            await fetch(`${API_URL}/ratings/warnings/${current.id}/ack`, {
                method: "POST",
                headers: { ...authHeader() },
            });
            // Remove from list
            const next = warnings.filter(w => w.id !== current.id);
            setWarnings(next);
            setCurrent(next.length > 0 ? next[0] : null);
        } catch {
            alert("Hata oluştu.");
        }
    }

    if (!current) return null;

    return (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-neutral-900 p-6 ring-1 ring-rose-500/50 shadow-2xl shadow-rose-900/20">
                <div className="mb-4 flex flex-col items-center gap-3 text-center">
                    <div className="rounded-full bg-rose-500/10 p-4 text-rose-500">
                        <AlertTriangle className="size-8" />
                    </div>
                    <h2 className="text-xl font-bold text-white">Dikkat!</h2>
                </div>

                <div className="mb-6 text-center text-neutral-300">
                    {current.message}
                </div>

                <button
                    onClick={ack}
                    className="w-full rounded-xl bg-rose-600 py-3 font-medium text-white hover:bg-rose-500 transition-colors"
                >
                    Anlaşıldı
                </button>
            </div>
        </div>
    );
}

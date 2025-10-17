"use client";
import * as React from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function getToken(): string {
  try {
    return (
      localStorage.getItem("token") ||
      localStorage.getItem("access_token") ||
      localStorage.getItem("jwt") ||
      ""
    );
  } catch {
    return "";
  }
}
function authHeader(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

type AvItem = { dow: number; start: string; end: string };

const DAYS: { label: string; dow: number }[] = [
  { label: "Pzt", dow: 1 },
  { label: "Sal", dow: 2 },
  { label: "Çar", dow: 3 },
  { label: "Per", dow: 4 },
  { label: "Cum", dow: 5 },
  { label: "Cmt", dow: 6 },
  { label: "Paz", dow: 7 },
];

const defaultSlotFor = (dow: number): AvItem => ({ dow, start: "19:00", end: "21:00" });

export default function AvailabilityEditor() {
  const [items, setItems] = React.useState<AvItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);

  const groupByDay = React.useMemo(() => {
    const map: Record<number, AvItem[]> = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] };
    for (const it of items) (map[it.dow] ??= []).push(it);
    for (const k of Object.keys(map)) {
      map[+k].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
    }
    return map;
  }, [items]);

  async function load() {
    setLoading(true);
    try {
      const r = await fetch(`${API_URL}/users/me/availability`, {
        headers: { ...authHeader() },
        cache: "no-store",
      });
      const data = await r.json().catch(() => ({}));
      const arr: AvItem[] = Array.isArray(data?.items) ? data.items : [];
      setItems(
        arr
          .filter(
            (x) =>
              Number(x?.dow) >= 1 &&
              Number(x?.dow) <= 7 &&
              typeof x?.start === "string" &&
              typeof x?.end === "string"
          )
          .map((x) => ({ dow: Number(x.dow), start: x.start.slice(0, 5), end: x.end.slice(0, 5) }))
      );
      setDirty(false);
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    load();
  }, []);

  function addSlot(dow: number) {
    setItems((prev) => {
      const day = prev.filter((i) => i.dow === dow);
      // Çakışmasın diye son slotun bitişinden 1 saat sonrası
      let start = "19:00";
      if (day.length) {
        const last = day[day.length - 1];
        const h = Math.min(22, Math.max(0, parseInt(last.end.slice(0, 2)) + 1));
        start = `${String(h).padStart(2, "0")}:00`;
      }
      const endH = Math.min(23, Math.max(0, parseInt(start.slice(0, 2)) + 2));
      const end = `${String(endH).padStart(2, "0")}:00`;
      setDirty(true);
      return [...prev, { dow, start, end }];
    });
  }

  function updateSlot(idx: number, patch: Partial<AvItem>) {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      setDirty(true);
      return next;
    });
  }

  function removeSlot(idx: number) {
    setItems((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      setDirty(true);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      // Basit doğrulama
      const valid = items.filter((x) => x.start < x.end);
      const r = await fetch(`${API_URL}/users/me/availability`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ items: valid }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || data?.ok !== true) throw new Error("Kayıt başarısız");
      setDirty(false);
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2000);
      // Yeniden sırala
      setItems((prev) =>
        [...prev].sort((a, b) => (a.dow - b.dow) || (a.start < b.start ? -1 : 1))
      );
    } catch (e: any) {
      alert(e?.message || "Kayıt başarısız");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-neutral-900/60">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="text-base font-semibold">Müsaitlik</div>
        <div className="flex items-center gap-2">
          {savedAt && (
            <span className="text-xs text-emerald-300">Kaydedildi ✓</span>
          )}
          <button
            onClick={save}
            disabled={!dirty || saving}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              dirty
                ? "bg-emerald-600 text-white hover:bg-emerald-500"
                : "bg-neutral-700 text-neutral-300 cursor-default"
            }`}
            title={dirty ? "Değişiklikleri kaydet" : "Değişiklik yok"}
          >
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="grid gap-3 p-4 md:grid-cols-2">
        {DAYS.map(({ label, dow }) => {
          const dayItems = groupByDay[dow] || [];
          return (
            <div
              key={dow}
              className="rounded-xl border border-white/10 bg-neutral-900/70 p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-medium">{label}</div>
                <button
                  onClick={() => addSlot(dow)}
                  className="rounded-md border border-white/10 bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700"
                >
                  + Aralık ekle
                </button>
              </div>

              {loading ? (
                <div className="text-xs text-neutral-400">Yükleniyor…</div>
              ) : dayItems.length === 0 ? (
                <div className="text-xs text-neutral-400">Aralık yok.</div>
              ) : (
                <div className="space-y-2">
                  {dayItems.map((slot, orderIdx) => {
                    // Global index’i bulalım ki update/remove doğru slota işlesin
                    const globalIdx = items.findIndex(
                      (i, index) =>
                        index >= 0 &&
                        i.dow === slot.dow &&
                        i.start === slot.start &&
                        i.end === slot.end &&
                        // aynı değerle birden fazla varsa sıralı bulunsun
                        orderIdx ===
                          dayItems.filter(
                            (d) =>
                              d.start <= slot.start &&
                              !(d.start === slot.start && d.end === slot.end)
                          ).length
                    );
                    const idx = globalIdx === -1 ? items.indexOf(slot) : globalIdx;

                    return (
                      <div
                        key={`${orderIdx}-${slot.start}-${slot.end}`}
                        className="flex items-center gap-2"
                      >
                        <input
                          type="time"
                          value={slot.start}
                          onChange={(e) =>
                            updateSlot(idx, { start: e.target.value.slice(0, 5) })
                          }
                          className="w-[90px] rounded-md border border-white/10 bg-neutral-800 px-2 py-1 text-sm"
                        />
                        <span className="text-neutral-400">—</span>
                        <input
                          type="time"
                          value={slot.end}
                          onChange={(e) =>
                            updateSlot(idx, { end: e.target.value.slice(0, 5) })
                          }
                          className="w-[90px] rounded-md border border-white/10 bg-neutral-800 px-2 py-1 text-sm"
                        />
                        <button
                          onClick={() => removeSlot(idx)}
                          className="ml-1 rounded-md bg-rose-700/80 px-2 py-1 text-xs text-white hover:bg-rose-600"
                          title="Bu aralığı sil"
                        >
                          Sil
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Not */}
      <div className="px-4 pb-4 text-xs text-neutral-400">
        Aynı güne birden fazla aralık ekleyebilirsin. Çakışan aralıkları sistem otomatik birleştirir.
      </div>
    </section>
  );
}

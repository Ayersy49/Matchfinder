"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { postCreateTeam } from "@/lib/api";
import { Shirt } from "lucide-react";

/** —— Kuşbakışı yerleşimler (yüzdeler) —————————————————————— */
/** x: 0 solda kalen, 100 sağ kale; y: 0 üst aut, 100 alt aut */
type Slot = { key: string; label: string; x: number; y: number };

const LAYOUTS: Record<number, Slot[]> = {
  5: [
    { key: "GK", label: "Kaleci", x: 8, y: 50 },
    { key: "CB1", label: "Stoper", x: 35, y: 35 },
    { key: "CB2", label: "Stoper", x: 35, y: 65 },
    { key: "ST1", label: "Forvet", x: 75, y: 35 },
    { key: "ST2", label: "Forvet", x: 75, y: 65 },
  ],
  6: [
    { key: "GK", label: "Kaleci", x: 8, y: 50 },
    { key: "CB1", label: "Stoper", x: 25, y: 35 },
    { key: "CB2", label: "Stoper", x: 25, y: 65 },
    { key: "CM1", label: "Orta Saha", x: 55, y: 35 },
    { key: "CM2", label: "Orta Saha", x: 55, y: 65 },
    { key: "ST", label: "Forvet", x: 85, y: 50 },
  ],
  7: [
    { key: "GK", label: "Kaleci", x: 8, y: 50 },
    { key: "CB1", label: "Stoper", x: 22, y: 30 },
    { key: "CB2", label: "Stoper", x: 22, y: 70 },
    { key: "CM1", label: "Orta Saha", x: 45, y: 30 },
    { key: "CM2", label: "Orta Saha", x: 45, y: 70 },
    { key: "ST1", label: "Forvet", x: 75, y: 35 },
    { key: "ST2", label: "Forvet", x: 75, y: 65 },
  ],
  8: [
    { key: "GK", label: "Kaleci", x: 8, y: 50 },
    { key: "CB1", label: "Stoper", x: 20, y: 25 },
    { key: "CB2", label: "Stoper", x: 20, y: 50 },
    { key: "CB3", label: "Stoper", x: 20, y: 75 },
    { key: "DM", label: "Defansif Orta", x: 45, y: 40 },
    { key: "AM", label: "Ofansif Orta", x: 55, y: 60 },
    { key: "ST1", label: "Forvet", x: 80, y: 35 },
    { key: "ST2", label: "Forvet", x: 80, y: 65 },
  ],
  9: [
    { key: "GK", label: "Kaleci", x: 8, y: 50 },
    { key: "CB1", label: "Stoper", x: 20, y: 25 },
    { key: "CB2", label: "Stoper", x: 20, y: 50 },
    { key: "CB3", label: "Stoper", x: 20, y: 75 },
    { key: "DM", label: "Defansif Orta", x: 45, y: 35 },
    { key: "CM", label: "Merkez Orta", x: 50, y: 50 },
    { key: "AM", label: "Ofansif Orta", x: 55, y: 65 },
    { key: "ST1", label: "Forvet", x: 80, y: 40 },
    { key: "ST2", label: "Forvet", x: 80, y: 60 },
  ],
  10: [
    { key: "GK", label: "Kaleci", x: 8, y: 50 },
    { key: "CB1", label: "Stoper", x: 18, y: 40 },
    { key: "CB2", label: "Stoper", x: 18, y: 60 },
    { key: "LB", label: "Sol Bek", x: 25, y: 25 },
    { key: "RB", label: "Sağ Bek", x: 25, y: 75 },
    { key: "DM", label: "Defansif Orta", x: 45, y: 40 },
    { key: "AM", label: "Ofansif Orta", x: 55, y: 60 },
    { key: "LW", label: "Sol Kanat", x: 75, y: 25 },
    { key: "RW", label: "Sağ Kanat", x: 75, y: 75 },
    { key: "ST", label: "Forvet", x: 88, y: 50 },
  ],
  11: [
    { key: "GK", label: "Kaleci", x: 8, y: 50 },
    { key: "CB1", label: "Stoper", x: 18, y: 40 },
    { key: "CB2", label: "Stoper", x: 18, y: 60 },
    { key: "LB", label: "Sol Bek", x: 24, y: 25 },
    { key: "RB", label: "Sağ Bek", x: 24, y: 75 },
    { key: "DM", label: "Defansif Orta", x: 43, y: 37 },
    { key: "CM", label: "Merkez Orta", x: 50, y: 50 },
    { key: "AM", label: "Ofansif Orta", x: 57, y: 63 },
    { key: "LW", label: "Sol Kanat", x: 72, y: 22 },
    { key: "RW", label: "Sağ Kanat", x: 72, y: 78 },
    { key: "ST", label: "Forvet", x: 88, y: 50 },
  ],
};

export default function NewTeamPage() {
  const router = useRouter();

  const [name, setName] = React.useState("");
  const [city, setCity] = React.useState("");
  const [district, setDistrict] = React.useState("");
  const [size, setSize] = React.useState<5 | 6 | 7 | 8 | 9 | 10 | 11>(7); // kişi sayısı
  const [creating, setCreating] = React.useState(false);
  const layout = LAYOUTS[size];

  async function createTeam() {
    if (!name.trim()) {
      alert("Takım adı gerekli.");
      return;
    }
    try {
      setCreating(true);
      // formasyon seçimi takım sonrası yapılacak; BE default '4-3-3' kullanıyor.
      const team = await postCreateTeam({
        name: name.trim(),
        city: city.trim() || undefined,
        district: district.trim() || undefined,
      });
      router.replace(`/teams/${team.id}`);
    } catch (e: any) {
      alert(e?.message || "Oluşturulamadı");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-dvh bg-neutral-950 text-white">
      <header className="sticky top-0 z-10 bg-neutral-950/80 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="inline-flex items-center gap-2 text-lg font-semibold">
            <Shirt className="h-5 w-5" />
            Yeni Takım
          </div>
        </div>
      </header>

      {/* Ortalanmış içerik */}
      <main className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-2">
        {/* Form */}
        <section className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
          <div className="space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Takım adı"
              className="w-full rounded-xl bg-neutral-800 px-3 py-2 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-emerald-400"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Şehir"
                className="w-full rounded-xl bg-neutral-800 px-3 py-2 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-emerald-400"
              />
              <input
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="İlçe"
                className="w-full rounded-xl bg-neutral-800 px-3 py-2 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-emerald-400"
              />
            </div>

            {/* Kişi sayısı (format) */}
            <div className="mt-2">
              <div className="mb-2 text-xs text-neutral-300">Kişi sayısı (format)</div>
              <div className="flex flex-wrap gap-2">
                {[5, 6, 7, 8, 9, 10, 11].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSize(n as any)}
                    className={`rounded-lg px-3 py-1.5 text-sm ring-1 ring-white/10 ${
                      size === n ? "bg-emerald-600 text-neutral-950" : "bg-neutral-800 hover:bg-neutral-700"
                    }`}
                  >
                    {n} v {n}
                  </button>
                ))}
              </div>
              <div className="mt-1 text-[11px] text-neutral-400">
                Formasyon seçimini takım kurulduktan sonra düzenleyebilirsin.
              </div>
            </div>

            <button
              onClick={createTeam}
              disabled={creating}
              className="mt-3 w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-emerald-500 disabled:opacity-50"
            >
              {creating ? "Oluşturuluyor…" : "Oluştur"}
            </button>
          </div>
        </section>

        {/* Halısaha kuşbakışı */}
        <section className="rounded-2xl border border-white/10 bg-neutral-900/60 p-4">
          <div className="mb-3 text-sm text-neutral-300">
            ÖN İZLEME — {size}v{size} yerleşim
          </div>
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-green-800">
            <Pitch />
            {layout.map((p) => (
              <Spot key={`${size}-${p.key}`} x={p.x} y={p.y} label={p.key} title={p.label} />
            ))}
          </div>
          <div className="mt-2 text-[11px] text-neutral-400">
            Bu yerleşim sadece örnektir; takım admini daha sonra slotları taşıyıp kilitleyebilir.
          </div>
        </section>
      </main>
    </div>
  );
}

/** ——— Yardımcı görseller ——— */
function Pitch() {
  return (
    <div className="absolute inset-0">
      {/* dokulu zemin */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.07),transparent_60%),radial-gradient(circle_at_80%_80%,rgba(255,255,255,0.05),transparent_60%)]" />
      {/* çizgiler */}
      <div className="absolute inset-2 rounded-xl border-4 border-white/50" />
      <div className="absolute left-1/2 top-2 bottom-2 w-1 -translate-x-1/2 bg-white/50" />
      <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white/50" />
      <div className="absolute left-2 top-1/2 h-40 w-24 -translate-y-1/2 border-4 border-white/50" />
      <div className="absolute right-2 top-1/2 h-40 w-24 -translate-y-1/2 border-4 border-white/50" />
      <div className="absolute left-0 top-1/2 h-16 w-2 -translate-y-1/2 bg-white/70" />
      <div className="absolute right-0 top-1/2 h-16 w-2 -translate-y-1/2 bg-white/70" />
    </div>
  );
}

function Spot({ x, y, label, title }: { x: number; y: number; label: string; title?: string }) {
  return (
    <div
      className="group absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${x}%`, top: `${y}%` }}
      title={title || label}
    >
      <div className="grid h-8 w-8 place-items-center rounded-full bg-black/70 text-xs font-semibold text-white ring-2 ring-white/70">
        {label}
      </div>
      <div className="pointer-events-none mt-1 hidden rounded bg-black/70 px-2 py-0.5 text-[11px] text-white ring-1 ring-white/20 group-hover:block">
        {title || label}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import React from "react";
import { CalendarDays, Rows3, UserRound, Shield, Shirt } from "lucide-react";

// Tüm sekmeler /landing?tab=... altında çalışacak
type TabKey = "matches" | "series" | "teams" | "profile" | "player";

const TABS: Array<{
  key: TabKey;
  label: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}> = [
  { key: "matches", label: "Maçlar",   Icon: CalendarDays },
  { key: "series",  label: "Seriler",  Icon: Rows3 },
  { key: "teams",   label: "Takımlar", Icon: Shirt },
  { key: "profile", label: "Profil",   Icon: UserRound },
  { key: "player",  label: "Oyuncu",   Icon: Shield },
];

const hrefFor = (key: TabKey) => `/landing?tab=${key}`;

export default function FooterTabs() {
  const sp = useSearchParams();
  const pathname = usePathname();

  // Öncelik: /landing?tab=... parametresi.
  // Eğer başka bir sayfadaysak (ör. /team/123 veya /series/new), mantıklı sekmeyi vurgula.
  let current = (sp.get("tab") as TabKey | null);
  if (!current) {
    if (pathname?.startsWith("/series")) current = "series";
    else if (pathname?.startsWith("/team")) current = "teams";
    else current = "matches";
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-neutral-900/80 backdrop-blur px-4 py-2">
      {/* 5 sekme -> grid-cols-5 */}
      <div className="mx-auto grid max-w-4xl grid-cols-5 gap-2">
        {TABS.map(({ key, label, Icon }) => {
          const active = current === key;
          return (
            <Link
              key={key}
              href={hrefFor(key)}
              className={`flex flex-col items-center justify-center rounded-xl px-3 py-2 ${
                active ? "text-emerald-400" : "text-neutral-300 hover:text-white"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="mt-1 text-xs">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

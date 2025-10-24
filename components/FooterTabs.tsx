"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import React from "react";
// İkonlar (lucide-react zaten projede var)
import { CalendarDays, Rows3, UserRound, Shield } from "lucide-react";

// Sekme anahtarlarımız
type TabKey = "matches" | "series" | "profile" | "player";

// Alt bar için sekme tanımları
const TABS: Array<{
  key: TabKey;
  label: string;
  href: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}> = [
  { key: "matches", label: "Maçlar", href: "/landing?tab=matches", Icon: CalendarDays },
  { key: "series",  label: "Seriler", href: "/series",               Icon: Rows3 },
  { key: "profile", label: "Profil",  href: "/landing?tab=profile",  Icon: UserRound },
  { key: "player",  label: "Oyuncu",  href: "/landing?tab=player",   Icon: Shield },
];

export default function FooterTabs({ active }: { active?: TabKey }) {
  const pathname = usePathname();
  const search   = useSearchParams();

  // Aktif sekmeyi ya prop’tan ya da URL’den çıkar
  const computedActive = React.useMemo<TabKey | null>(() => {
    if (active) return active;
    if (pathname?.startsWith("/series")) return "series";
    if (pathname?.startsWith("/landing")) {
      const tab = (search?.get("tab") as TabKey | null) ?? "matches";
      return tab;
    }
    if (pathname === "/profil") return "profile"; // eski rotalar
    if (pathname === "/oyuncu") return "player";
    return null;
  }, [active, pathname, search]);

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-neutral-900/80 backdrop-blur px-4 py-2">
      <div className="mx-auto grid max-w-4xl grid-cols-4 gap-2">
        {TABS.map(({ key, label, href, Icon }) => {
          const on = computedActive === key;
          return (
            <Link
              key={key}
              href={href}
              className={`flex min-w-[110px] flex-col items-center justify-center rounded-xl px-3 py-2 ${
                on ? "text-emerald-400" : "text-neutral-300 hover:text-white"
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

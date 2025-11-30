"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import PlayerProfileCard from "@/components/PlayerProfileCard";

export default function FriendPublicProfilePage() {
  const params = useParams<{ id: string }>();
  const id = React.useMemo(() => {
    const v = (params as any)?.id;
    return Array.isArray(v) ? v[0] : v || "";
  }, [params]);

  if (!id) return null;

  return (
    <div className="px-4 py-4">
      <div className="mb-3 flex items-center gap-2">
        <Link href="/friends" className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700">
          ← Arkadaşlar
        </Link>
        <Link href="/landing" className="rounded-lg bg-neutral-800 px-3 py-1.5 text-sm hover:bg-neutral-700">
          Ana menü
        </Link>
      </div>

      <PlayerProfileCard userId={id} />
    </div>
  );
}

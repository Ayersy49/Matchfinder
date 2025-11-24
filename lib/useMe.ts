// app/lib/useMe.ts
"use client";

import * as React from "react";
import { authHeader, getToken } from "@/lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/* Varsayılan müsaitlik şeması */
const DEFAULT_AVAILABILITY = {
  mon: { enabled: false, start: "20:00", end: "23:59" },
  tue: { enabled: false, start: "20:00", end: "23:59" },
  wed: { enabled: false, start: "20:00", end: "23:59" },
  thu: { enabled: false, start: "20:00", end: "23:59" },
  fri: { enabled: false, start: "20:00", end: "23:59" },
  sat: { enabled: false, start: "20:00", end: "23:59" },
  sun: { enabled: false, start: "20:00", end: "23:59" },
};

type Me = {
  id: string | null;
  username?: string | null;
  name?: string | null;
  email?: string | null;
  phone: string | null;
  lastname?: string | null;
  surname?: string | null;  // Alias for lastname
  birthDate?: string | null;
  discoverable?: boolean;
  dominantFoot: "L" | "R" | "B" | "N";
  positions: string[];
  preferredFormation?: "4-2-3-1" | "4-3-3" | "3-5-2";
  positionLevels: Record<string, number>;
  availability: Record<string, any>;
  level: number;
  createdAt?: string | null;
  updatedAt?: string | null;
  posLocked?: string[];
  topPositions?: string[];
  top3WithLevels?: { pos: string; level: number }[];
  age?: number | null;
  height?: number | null;
  weight?: number | null;
  gender?: string | null;
};

function normalizeMe(data: any): Me {
  return {
    id: data?.id ?? null,
    username: data?.username ?? null,
    name: data?.name ?? null,
    email: data?.email ?? null,
    phone: data?.phone ?? null,
    lastname: data?.lastname ?? null,
    surname: data?.surname ?? data?.lastname ?? null,
    birthDate: data?.birthDate ?? null,
    discoverable: typeof data?.discoverable === 'boolean' ? data.discoverable : false,
    dominantFoot: (data?.dominantFoot as Me["dominantFoot"]) ?? "N",
    positions: Array.isArray(data?.positions) ? data.positions : [],
    preferredFormation:
      (data?.preferredFormation as Me["preferredFormation"]) ?? "4-2-3-1",
    positionLevels:
      data?.positionLevels && typeof data.positionLevels === "object"
        ? data.positionLevels
        : {},
    availability:
      data?.availability && typeof data.availability === "object"
        ? { ...DEFAULT_AVAILABILITY, ...data.availability }
        : DEFAULT_AVAILABILITY,
    level: typeof data?.level === "number" ? data.level : 5,
    createdAt: data?.createdAt ?? null,
    updatedAt: data?.updatedAt ?? null,
    age: typeof data?.age === 'number' ? data.age : null,
    height: typeof data?.height === 'number' ? data.height : null,
    weight: typeof data?.weight === 'number' ? data.weight : null,
    gender: typeof data?.gender === 'string' ? data.gender : null,
  };
}

export function useMe() {
  const [me, setMe] = React.useState<Me | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    const token = getToken();
    if (!token) {
      // Token yokken istek atmayalım → 401 log'ları olmaz
      setMe(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API_URL}/users/me`, {
        headers: { ...authHeader() },
        cache: "no-store",
      });

      if (r.status === 401) {
        // Oturum düşmüş: sessiz sıfırla
        setMe(null);
        setError(null);
        setLoading(false);
        return;
      }

      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(json?.message || `status ${r.status}`);
      setMe(normalizeMe(json));
    } catch (e: any) {
      setError(e?.message || "Profil alınamadı");
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  async function save(partial: Partial<Me>) {
    const token = getToken();
    if (!token) throw new Error("Giriş gerekli");

    const r = await fetch(`${API_URL}/users/me`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify(partial),
    });

    const json = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(json?.message || `Kaydetme başarısız: ${r.status}`);

    const normalized = normalizeMe(json);
    setMe(normalized);
    return normalized;
  }

  return { me, setMe, loading, error, refresh, save };
}

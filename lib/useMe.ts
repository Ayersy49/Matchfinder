// app/lib/useMe.ts
"use client";

import * as React from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function getToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("token") || "";
}

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
  phone: string | null;
  dominantFoot: "L" | "R" | "B" | "N";
  positions: string[];
  preferredFormation?: "4-2-3-1" | "4-3-3" | "3-5-2";
  positionLevels: Record<string, number>;
  availability: Record<string, any>;
  level: number;
  createdAt?: string | null;
  updatedAt?: string | null;
};

function normalizeMe(data: any): Me {
  const out: Me = {
    id: data?.id ?? null,
    phone: data?.phone ?? null,
    dominantFoot: (data?.dominantFoot as Me["dominantFoot"]) ?? "N",
    positions: Array.isArray(data?.positions) ? data.positions : [],
    preferredFormation: (data?.preferredFormation as Me["preferredFormation"]) ?? "4-2-3-1",
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
  };
  return out;
}

export function useMe() {
  const [me, setMe] = React.useState<Me | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${API_URL}/users/me`, {
        headers: { Authorization: `Bearer ${getToken()}` },
        cache: "no-store",
      });
      if (!r.ok) throw new Error(`status ${r.status}`);
      const json = await r.json();
      setMe(normalizeMe(json));
    } catch (e) {
      setError("Profil alınamadı");
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  async function save(partial: any) {
    const r = await fetch(`${API_URL}/users/me`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify(partial),
    });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`Kaydetme başarısız: ${r.status} ${t}`);
    }
    const json = await r.json();
    const normalized = normalizeMe(json);
    setMe(normalized);
    return normalized;
  }

  return { me, setMe, loading, error, refresh, save };
}

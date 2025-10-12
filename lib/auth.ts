// app/lib/auth.ts
"use client";

/** Tüm olası anahtarlardan ham JWT'yi oku */
function readRawToken(): string {
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

/** "Bearer xxx" gelmişse başlığı at, sadece ham JWT kalsın */
function normalizeToken(raw: string): string {
  if (!raw) return "";
  return raw.replace(/^Bearer\s+/i, "").trim();
}

/** Girişte sadece bunu çağır: tek bir yerde, ham JWT olarak tut */
export function setToken(raw: string) {
  const t = normalizeToken(raw);
  try {
    localStorage.setItem("token", t);
    // Eski anahtarları temizle ki karışıklık olmasın
    localStorage.removeItem("access_token");
    localStorage.removeItem("jwt");
  } catch {}
}

/** Kullanıma hazır (normalize) token */
export function getToken(): string | null {
  return normalizeToken(readRawToken()) || null;
}

/** Çıkış */
export function clearToken() {
  try {
    localStorage.removeItem("token");
    localStorage.removeItem("access_token");
    localStorage.removeItem("jwt");
  } catch {}
}

/** Fetch için Authorization header’ı (yoksa boş obje döner) */
export function authHeader(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/** JWT’den kullanıcı id’si (varsa) */
export function myId(): string | null {
  try {
    const t = getToken();
    if (!t) return null;
    const p = JSON.parse(atob(t.split(".")[1] || ""));
    return p?.id || p?.sub || p?.userId || null;
  } catch {
    return null;
  }
}

/** Token süresi dolmuş mu? */
export function isExpired(token?: string): boolean {
  try {
    const t = token ?? getToken();
    if (!t) return false;
    const p = JSON.parse(atob(t.split(".")[1] || ""));
    if (!p?.exp) return false;
    return p.exp <= Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

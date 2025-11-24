// lib/auth.ts
'use client';

type HeaderMap = Record<string, string>;

const STORAGE_KEY = 'token';
const LEGACY_KEYS = ['access_token', 'jwt'];

/* ---- internal helpers ---- */
function readFromStorage(): string {
  try {
    return (
      localStorage.getItem(STORAGE_KEY) ||
      localStorage.getItem('access_token') ||
      localStorage.getItem('jwt') ||
      ''
    );
  } catch {
    return '';
  }
}

function readFromCookie(name = 'token'): string {
  try {
    const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  } catch {
    return '';
  }
}

function base64urlJsonDecode(s: string): any {
  try {
    const pad = (x: string) => x + '='.repeat((4 - (x.length % 4)) % 4);
    const b64 = pad(s.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
}

/** Tüm olası kaynaklardan ham JWT’yi oku */
function readRawToken(): string {
  const t = readFromStorage();
  if (t) return t;
  return readFromCookie();
}

/** "Bearer xxx" gelmişse başlığı at, sadece ham JWT kalsın */
function normalizeToken(raw: string): string {
  if (!raw) return '';
  return raw.replace(/^Bearer\s+/i, '').trim();
}

/* ---- public api ---- */

/** Girişte sadece bunu çağır: ham JWT’yi tek anahtarda tut */
export function setToken(raw: string, opts: { alsoSetCookie?: boolean } = {}) {
  const t = normalizeToken(raw);
  try {
    localStorage.setItem(STORAGE_KEY, t);
    for (const k of LEGACY_KEYS) localStorage.removeItem(k);
  } catch {}
  if (opts.alsoSetCookie) {
    document.cookie = `token=${encodeURIComponent(t)}; Path=/; SameSite=Lax`;
  }
  try {
    window.dispatchEvent(new Event('auth:token-changed'));
  } catch {}
}

/** Kullanıma hazır (normalize) token */
export function getToken(): string | null {
  const t = normalizeToken(readRawToken());
  return t || null;
}

/** Çıkış */
export function clearToken() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    for (const k of LEGACY_KEYS) localStorage.removeItem(k);
    document.cookie = 'token=; Path=/; Max-Age=0';
    window.dispatchEvent(new Event('auth:token-changed'));
  } catch {}
}

/** Fetch için Authorization header (yoksa boş obje) */
export function authHeader(): HeaderMap {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/** Var olan headers’a güvenli şekilde Authorization ekle (opsiyonel) */
export function withAuth(headers: HeadersInit = {}): HeadersInit {
  const t = getToken();
  if (!t) return headers;
  const obj: HeaderMap =
    headers instanceof Headers
      ? Object.fromEntries(headers.entries())
      : Array.isArray(headers)
      ? Object.fromEntries(headers)
      : { ...(headers as HeaderMap) };

  const already = obj.Authorization || obj.authorization || '';
  if (!/^Bearer\s+/i.test(already)) obj.Authorization = `Bearer ${t}`;
  return obj;
}

/** JWT payload’dan user id (opsiyonel) */
export function myId(): string | null {
  try {
    const t = getToken();
    if (!t) return null;
    const payload = base64urlJsonDecode(t.split('.')[1] || '');
    return payload?.sub || payload?.id || payload?.userId || null;
  } catch {
    return null;
  }
}

/** Token süresi dolmuş mu? (opsiyonel) */
export function isExpired(token?: string): boolean {
  try {
    const t = token ?? getToken();
    if (!t) return false;
    const payload = base64urlJsonDecode(t.split('.')[1] || '');
    if (!payload?.exp) return false;
    return payload.exp <= Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

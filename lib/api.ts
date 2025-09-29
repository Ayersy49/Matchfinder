export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const res = await fetch(base + path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
      ...(token ? { Authorization: 'Bearer ' + token.trim() } : {}),
    },
    credentials: 'include',
  });

  if (!res.ok) {
    // 204 gibi boş gövde gelirse json() patlamasın
    const text = await res.text().catch(() => '');
    const err = text || `HTTP ${res.status}`;
    throw new Error(err);
  }

  const ct = res.headers.get('content-type');
  if (!ct || !ct.includes('application/json')) {
    // JSON olmayan başarı cevabında boş dön
    return undefined as unknown as T;
  }
  return res.json() as Promise<T>;
}

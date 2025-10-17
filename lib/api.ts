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
// --- DAVET API ---
// Maça davet oluştur (arkadaş id'leri ve/veya telefonlar)
export function postInvites(matchId: string, payload: {
  toUserIds?: string[];
  toPhones?: string[];
  message?: string;
}) {
  return api<{ created: number }>(`/matches/${matchId}/invites`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// Gelen davet kutusu
export function getInbox() {
  return api<Array<{
    id: string;
    status: 'PENDING'|'ACCEPTED'|'DECLINED'|'EXPIRED';
    createdAt: string;
    match?: { id: string; title?: string | null };
    fromUser?: { id: string; phone?: string | null };
  }>>('/invites/inbox');
}

// Davete cevap
export function respondInvite(inviteId: string, action: 'accept' | 'decline') {
  return api<{ ok: boolean }>(`/invites/${inviteId}/respond`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  });
}


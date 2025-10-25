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

// ==== TEAMS API ====
export function getMyTeams() {
  return api<any[]>('/teams');
}
export function postCreateTeam(payload: {
  name: string; bio?: string; city?: string; district?: string;
  visibility?: 'PUBLIC'|'PRIVATE'; formationCode?: '4-3-3'|'3-5-2'|'4-2-3-1';
}) {
  return api<any>('/teams', { method: 'POST', body: JSON.stringify(payload) });
}
export function getTeam(id: string) {
  return api<any>(`/teams/${id}`);
}
export function getTeamSlots(id: string) {
  return api<any[]>(`/teams/${id}/slots`);
}
export function postAssignSlot(id: string, payload: { slotKey: string; userId?: string|null; locked?: boolean }) {
  return api<any>(`/teams/${id}/slots/assign`, { method: 'POST', body: JSON.stringify(payload) });
}
export function getTeamChat(id: string, after?: string) {
  const q = after ? `?after=${encodeURIComponent(after)}` : '';
  return api<Array<{ id:string; text:string; createdAt:string; user:{ id:string; nickname:string } }>>(`/teams/${id}/chat${q}`);
}
export function postTeamChat(id: string, text: string) {
  return api(`/teams/${id}/chat`, { method: 'POST', body: JSON.stringify({ text }) });
}
// Rakip arama
export function postTeamRequest(payload: {
  teamId: string; date: string; durationMin: number; locationText: string; format: string;
  levelMin?: number; levelMax?: number; notes?: string;
}) {
  return api(`/team-requests`, { method: 'POST', body: JSON.stringify(payload) });
}
export function listOpenTeamRequests(format?: string) {
  return api<any[]>(`/team-requests${format ? `?format=${encodeURIComponent(format)}` : ''}`);
}
export function offerOpponent(reqId: string, opponentTeamId: string) {
  return api(`/team-requests/${reqId}/offer`, {
    method: 'POST',
    body: JSON.stringify({ opponentTeamId }),
  });
}

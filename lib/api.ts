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
    const ct = res.headers.get('content-type') || '';
    let message = `HTTP ${res.status}`;
    if (ct.includes('application/json')) {
      const data = await res.json().catch(() => null);
      const m = data?.message;
      if (Array.isArray(m)) message = m.join('\n');
      else if (typeof m === 'string') message = m;
      else if (data) message = JSON.stringify(data);
    } else {
      const text = await res.text().catch(() => '');
      if (text) message = text;
    }
    throw new Error(message); // <— sadece burada throw
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
// ==== TEAMS API ====
export function postCreateTeam(payload: {
  name: string; bio?: string;
  city?: string; district?: string;
  visibility?: 'PUBLIC'|'PRIVATE';
  formationCode?: '4-3-3'|'3-5-2'|'4-2-3-1';
  size?: 5|6|7|8|9|10|11; // <— eklendi
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
export async function getTeamChat(id: string, after?: string) {
  const q = after ? `?after=${encodeURIComponent(after)}` : '';
  try {
    return await api<Array<{ id:string; text:string; createdAt:string; user:{ id:string; nickname:string } }>>(`/teams/${id}/chat${q}`);
  } catch (e: any) {
    const msg = String(e?.message || '');
    // BE’de endpoint yoksa 404 gelir → ekranı patlatma, boş liste dön
    if (msg.includes('HTTP 404') || msg.includes('Cannot GET')) return [];
    throw e;
  }
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

export function listOpenTeamRequests() {
  return api<any[]>('/team-match-requests?status=OPEN&includeOffers=1', { method: 'GET' });
}

// lib/api.ts

export function offerOpponent(requestId: string, teamId: string) {
  return api(`/team-match-requests/${requestId}/offers`, {
    method: 'POST',
    body: JSON.stringify({ teamId }),
  });
}

export const patchTeam      = (id:string,d:any)=>api(`/teams/${id}`,{method:'PATCH',body:JSON.stringify(d)});
export const postTeamClose  = (id:string)=>api(`/teams/${id}/close`,{method:'POST'});
export const postTeamOpen   = (id:string)=>api(`/teams/${id}/open`,{method:'POST'});
export const postTeamLeave  = (id:string)=>api(`/teams/${id}/leave`,{method:'POST'});
export const deleteTeamHard = (id:string)=>api(`/teams/${id}`,{method:'DELETE'});

// Tekliflerin gelen kutusu
export function getOfferInbox() {
  return api<any[]>('/team-match-offers/inbox');
}

// Teklife cevap ver
export function respondOffer(offerId: string, action: 'accept' | 'decline') {
  return api<{ ok: boolean }>(`/team-match-offers/${offerId}/respond`, {
    method: 'POST',
    body: JSON.stringify({ action }),
  });
}



/** Exception fırlatmayan sürüm — UI'da overlay riski sıfır */
export async function offerOpponentSafe(requestId: string, teamId: string): Promise<{ok:true}|{ok:false; message:string}> {
  try {
    await offerOpponent(requestId, teamId);
    return { ok: true };
  } catch (e: any) {
    const msg = e?.message || 'Teklif gönderilemedi';
    return { ok: false, message: msg };
  }
}

// lib/api.ts (MEVCUT DOSYANIN SONUNA EKLE)

// ===== MATCH PROPOSALS (Tarih/Saat Önerileri) =====

export interface MatchProposal {
  id: string;
  matchId: string;
  proposedBy: string;
  proposedDate: string;
  proposer: {
    id: string;
    phone: string;
  };
  votes: Array<{
    id: string;
    userId: string;
    vote: 'ACCEPT' | 'REJECT';
    user: {
      id: string;
      phone: string;
    };
  }>;
  acceptCount: number;
  rejectCount: number;
  userVote: 'ACCEPT' | 'REJECT' | null;
  createdAt: string;
}

/**
 * Maç önerilerini getir
 */
export function getMatchProposals(matchId: string) {
  return api<MatchProposal[]>(`/matches/${matchId}/proposals`);
}

/**
 * Yeni öneri oluştur
 */
export function createMatchProposal(matchId: string, proposedDate: string) {
  return api<MatchProposal>(`/matches/${matchId}/proposals`, {
    method: 'POST',
    body: JSON.stringify({ proposedDate }),
  });
}

/**
 * Öneriye oy ver
 */
export function voteMatchProposal(
  matchId: string,
  proposalId: string,
  vote: 'ACCEPT' | 'REJECT'
) {
  return api<{ ok: boolean }>(`/matches/${matchId}/proposals/${proposalId}/vote`, {
    method: 'POST',
    body: JSON.stringify({ vote }),
  });
}

/**
 * Öneriyi sil
 */
export function deleteMatchProposal(matchId: string, proposalId: string) {
  return api<{ message: string }>(`/matches/${matchId}/proposals/${proposalId}`, {
    method: 'DELETE',
  });
}



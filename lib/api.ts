  // lib/api.ts

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
        const m = (data as any)?.message;
        if (Array.isArray(m)) message = m.join('\n');
        else if (typeof m === 'string') message = m;
        else if (data) message = JSON.stringify(data);
      } else {
        const text = await res.text().catch(() => '');
        if (text) message = text;
      }
      throw new Error(message);
    }

    const ct = res.headers.get('content-type');
    if (!ct || !ct.includes('application/json')) {
      // JSON olmayan başarı cevabı
      return undefined as unknown as T;
    }
    return res.json() as Promise<T>;
  }

  /* ----------------- küçük yardımcı: safe GET fallback ----------------- */
  async function apiTry<T>(paths: string[]): Promise<T> {
    let lastErr: any;
    for (const p of paths) {
      try {
        return await api<T>(p);
      } catch (e: any) {
        lastErr = e;
        // 404/“Cannot GET …” durumunda sıradakini dene
        const msg = String(e?.message || '');
        if (!(msg.includes('HTTP 404') || msg.includes('Cannot GET'))) break;
      }
    }
    throw lastErr;
  }

  /* ======================= DAVET API ======================= */

  // Maça davet oluştur (arkadaş id'leri ve/veya telefonlar)
  export function postInvites(
    matchId: string,
    payload: { toUserIds?: string[]; toPhones?: string[]; message?: string }
  ) {
    return api<{ created: number }>(`/matches/${matchId}/invites`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Gelen davet kutusu
  export function getInbox() {
    return api<
      Array<{
        id: string;
        status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
        createdAt: string;
        match?: { id: string; title?: string | null };
        fromUser?: { id: string; phone?: string | null };
      }>
    >('/invites/inbox');
  }

  // Davete cevap
  export function respondInvite(inviteId: string, action: 'accept' | 'decline') {
    return api<{ ok: boolean }>(`/invites/${inviteId}/respond`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
  }

  /* ======================= TEAMS API ======================= */

  export async function getMyTeams() {
    // /teams 404/Cannot GET verirse, /teams/my ve /my-teams yollarını dene
    const data = await apiTry<any[]>(['/teams', '/teams/my', '/my-teams']);
    // {items:[...]} da gelebilir
    return Array.isArray(data) ? data : Array.isArray((data as any)?.items) ? (data as any).items : [];
  }

  export function postCreateTeam(payload: {
    name: string;
    bio?: string;
    city?: string;
    district?: string;
    visibility?: 'PUBLIC' | 'PRIVATE';
    formationCode?: '4-3-3' | '3-5-2' | '4-2-3-1';
    size?: 5 | 6 | 7 | 8 | 9 | 10 | 11;
  }) {
    return api<any>('/teams', { method: 'POST', body: JSON.stringify(payload) });
  }

  export function getTeam(id: string) {
    return api<any>(`/teams/${id}`);
  }

  export function getTeamSlots(id: string) {
    return api<any[]>(`/teams/${id}/slots`);
  }

  export function postAssignSlot(
    id: string,
    payload: { slotKey: string; userId?: string | null; locked?: boolean }
  ) {
    return api<any>(`/teams/${id}/slots/assign`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  export async function getTeamChat(id: string, after?: string) {
    const q = after ? `?after=${encodeURIComponent(after)}` : '';
    try {
      return await api<
        Array<{ id: string; text: string; createdAt: string; user: { id: string; nickname: string } }>
      >(`/teams/${id}/chat${q}`);
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (msg.includes('HTTP 404') || msg.includes('Cannot GET')) return [];
      throw e;
    }
  }

  export function postTeamChat(id: string, text: string) {
    return api(`/teams/${id}/chat`, { method: 'POST', body: JSON.stringify({ text }) });
  }

  // Rakip arama
  export function postTeamRequest(payload: {
    teamId: string;
    date: string;
    durationMin: number;
    locationText: string;
    format: string;
    levelMin?: number;
    levelMax?: number;
    notes?: string;
  }) {
    return api(`/team-requests`, { method: 'POST', body: JSON.stringify(payload) });
  }

  export function listOpenTeamRequests() {
    return api<any[]>('/team-match-requests?status=OPEN&includeOffers=1', { method: 'GET' });
  }

  export function offerOpponent(requestId: string, teamId: string) {
    return api(`/team-match-requests/${requestId}/offers`, {
      method: 'POST',
      body: JSON.stringify({ teamId }),
    });
  }

  export const patchTeam = (id: string, d: any) =>
    api(`/teams/${id}`, { method: 'PATCH', body: JSON.stringify(d) });
  export const postTeamClose = (id: string) => api(`/teams/${id}/close`, { method: 'POST' });
  export const postTeamOpen = (id: string) => api(`/teams/${id}/open`, { method: 'POST' });
  export const postTeamLeave = (id: string) => api(`/teams/${id}/leave`, { method: 'POST' });
  export const deleteTeamHard = (id: string) => api(`/teams/${id}`, { method: 'DELETE' });

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

  /** Exception fırlatmayan sürüm — UI overlay riskini sıfırlar */
  export async function offerOpponentSafe(
    requestId: string,
    teamId: string
  ): Promise<{ ok: true } | { ok: false; message: string }> {
    try {
      await offerOpponent(requestId, teamId);
      return { ok: true };
    } catch (e: any) {
      const msg = e?.message || 'Teklif gönderilemedi';
      return { ok: false, message: msg };
    }
  }

  /* =========================================================
    MATCH TIME PROPOSALS — yeni BE rotalarına uygun
    ---------------------------------------------------------
    GET  /matches/:id/time-proposals        -> { ok:true, items:[...] }
    POST /matches/:id/propose-time          -> { ok:true }
    POST /matches/:id/time-proposals/:pid/vote   body { value:'UP'|'DOWN' }
    POST /matches/:id/time-proposals/:pid/apply  -> { ok:true, applied?:boolean }
    ========================================================= */

  export type TimeProposalVote = 'UP' | 'DOWN';

  export interface TimeProposalItem {
    id: string;
    by: string;            // öneren userId
    time: string | null;   // ISO
    createdAt: string;
    votesUp: number;
    votesDown: number;
    myVote: TimeProposalVote | null;
    approvedA: boolean;
    approvedB: boolean;
    canFinalize: boolean;
  }

  /** Önerileri listele — dizi döndürür */
  export async function getTimeProposals(matchId: string): Promise<TimeProposalItem[]> {
    const j = await api<{ ok: boolean; items: TimeProposalItem[] }>(
      `/matches/${matchId}/time-proposals`
    );
    return Array.isArray(j?.items) ? j.items : [];
  }

  /** Yeni saat öner */
  export function proposeTime(matchId: string, isoTime: string) {
    return api<{ ok: boolean }>(`/matches/${matchId}/propose-time`, {
      method: 'POST',
      body: JSON.stringify({ time: isoTime }),
    });
  }

  /** Öneriye oy ver (UP/DOWN). Admin UP ise taraf onayı sayılır, iki taraf onaylıysa BE maçı otomatik günceller. */
  export function voteTimeProposal(
    matchId: string,
    proposalId: string,
    value: TimeProposalVote
  ) {
    return api<{ ok: boolean; applied?: boolean }>(
      `/matches/${matchId}/time-proposals/${proposalId}/vote`,
      {
        method: 'POST',
        body: JSON.stringify({ value }),
      }
    );
  }

  /** Öneriyi uygula (owner ya da takım admini) */
  export function applyTimeProposal(matchId: string, proposalId: string) {
    return api<{ ok: boolean; applied?: boolean }>(
      `/matches/${matchId}/time-proposals/${proposalId}/apply`,
      { method: 'POST' }
    );
  }

  // ==== TEAM INVITES ====
  // Takıma oyuncu daveti (owner/admin)
  export function postTeamInvites(
    teamId: string,
    payload: { toUserIds?: string[]; toPhones?: string[]; message?: string }
  ) {
    return api<{ created: number }>(`/teams/${teamId}/invites`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  export function getTeamInvites(teamId: string, status?: 'PENDING'|'ACCEPTED'|'DECLINED') {
    const q = status ? `?status=${status}` : '';
    return api<any[]>(`/teams/${teamId}/invites${q}`);
  }
  export function getMyTeamInviteInbox() {
    return api<any[]>('/team-invites/inbox');
  }
  export function respondTeamInvite(inviteId: string, action:'accept'|'decline') {
    return api<{ok:boolean}>(`/team-invites/${inviteId}/respond`, { method:'POST', body: JSON.stringify({ action }) });
  }

  export async function getNotifications() { /* GET /notifications */ }
  export async function markNotificationRead(id: string) { /* POST /notifications/:id/read */ }
  export async function markAllNotificationsRead() { /* POST /notifications/read-all */ }



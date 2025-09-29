'use client';
import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

export type Me = {
  id: string;
  phone: string;
  dominantFoot: 'L' | 'R' | 'N';
  positions: string[];
  level: number;
};

export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const data = await api<any>('/users/me');
        setMe({
          id: data?.id ?? '',
          phone: data?.phone ?? '',
          dominantFoot: (data?.dominantFoot ?? 'R') as 'L' | 'R' | 'N',
          positions: Array.isArray(data?.positions) ? data.positions : [],
          level: Number(data?.level ?? 7),
        });
      } catch (e: any) {
        setError(e?.message || 'Hata');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = useCallback(async (p: Partial<Me>) => {
    if (!me) return;
    const next: Me = {
      ...me,
      ...p,
      positions: Array.isArray(p.positions) ? p.positions.slice(0, 3) : me.positions,
      level: Number(p.level ?? me.level),
    };
    const updated = await api<Me>('/users/me', {
      method: 'PUT',
      body: JSON.stringify({
        dominantFoot: next.dominantFoot,
        positions: next.positions,
        level: next.level,
      }),
    });
    setMe({
      id: updated?.id ?? '',
      phone: updated?.phone ?? '',
      dominantFoot: (updated?.dominantFoot ?? 'R') as 'L' | 'R' | 'N',
      positions: Array.isArray(updated?.positions) ? updated.positions : [],
      level: Number(updated?.level ?? 7),
    });
    return updated;
  }, [me]);

  return { me, setMe, loading, error, save };
}

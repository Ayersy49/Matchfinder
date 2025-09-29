'use client';

import { useMe } from '@/lib/useMe';

export default function ClientShell({ children }: { children: React.ReactNode }) {
  const { me } = useMe();
  const initial = me?.id?.[0]?.toUpperCase() ?? 'N';

  // İstersen burada avatar / bottom nav gibi client-only şeyleri koy.
  // <div className="avatar">{initial}</div>

  return <>{children}</>;
}

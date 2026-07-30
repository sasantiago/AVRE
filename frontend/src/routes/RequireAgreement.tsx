import { ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { apiFetch } from '@/lib/api-client';

export function RequireAgreement({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'accepted' | 'pending'>('checking');

  useEffect(() => {
    apiFetch<{ accepted: boolean }>('/onboarding/status')
      .then((res) => setStatus(res.accepted ? 'accepted' : 'pending'))
      .catch(() => setStatus('pending'));
  }, []);

  if (status === 'checking') {
    return <div className="grid min-h-screen place-items-center text-slate-400">Cargando…</div>;
  }
  if (status === 'pending') {
    return <Navigate to="/onboarding/agreement" replace />;
  }
  return <>{children}</>;
}

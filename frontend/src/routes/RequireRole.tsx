import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, Role } from '@/lib/auth-context';

export function RequireRole({ allow, children }: { allow: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="grid min-h-screen place-items-center text-slate-400">Cargando…</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!allow.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

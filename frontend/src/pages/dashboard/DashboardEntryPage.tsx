import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';

// /dashboard es el destino post-login genérico: cada rol tiene un panel propio.
// Solo CLIENT pasa por el gate del Acuerdo de Gestión Discrecional — ADMIN/ADVISOR
// no aportan capital, así que ese requisito no les aplica (ver App.tsx, ruta
// /client/portfolio, envuelta en RequireAgreement).
export default function DashboardEntryPage() {
  const { user } = useAuth();

  if (user?.role === 'ADMIN') return <Navigate to="/admin/users" replace />;
  if (user?.role === 'ADVISOR') return <Navigate to="/advisor/clients" replace />;

  return <Navigate to="/client/portfolio" replace />;
}

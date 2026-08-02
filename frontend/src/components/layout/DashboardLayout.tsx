import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
}

const NAV_BY_ROLE: Record<string, NavItem[]> = {
  ADMIN: [
    { to: '/admin/users', label: 'Usuarios' },
    { to: '/admin/clients', label: 'Clientes' },
    { to: '/admin/deposits', label: 'Depósitos' },
    { to: '/admin/withdrawals', label: 'Retiros' },
    { to: '/admin/instruments', label: 'Instrumentos' },
    { to: '/admin/metrics', label: 'Métricas' },
    { to: '/admin/audit', label: 'Auditoría' },
  ],
  ADVISOR: [
    { to: '/advisor/clients', label: 'Mi cartera' },
    { to: '/advisor/deposits', label: 'Depósitos' },
    { to: '/advisor/withdrawals', label: 'Retiros' },
  ],
  CLIENT: [
    { to: '/client/portfolio', label: 'Portfolio' },
    { to: '/client/deposits', label: 'Depósitos' },
    { to: '/client/withdrawals', label: 'Retiros' },
    { to: '/client/market', label: 'Mercado' },
    { to: '/client/profile', label: 'Perfil' },
  ],
};

export function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navItems = user ? NAV_BY_ROLE[user.role] ?? [] : [];

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="border-b border-slate-50/10 bg-slate-900/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Logo markClassName="h-8" />
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'rounded-lg px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-50/5 hover:text-slate-50',
                    isActive && 'bg-slate-50/5 text-slate-50',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-slate-500 sm:inline">{user?.role}</span>
            <Button variant="outline" size="sm" onClick={() => logout()}>
              Cerrar sesión
            </Button>
          </div>
        </div>
        {navItems.length > 0 && (
          <nav className="flex items-center gap-1 overflow-x-auto px-6 pb-3 md:hidden">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'whitespace-nowrap rounded-lg px-3 py-2 text-sm text-slate-300',
                    isActive && 'bg-slate-50/5 text-slate-50',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, setAccessToken, setUnauthorizedHandler } from './api-client';

export type Role = 'ADMIN' | 'ADVISOR' | 'CLIENT';

export interface AuthUser {
  userId: string;
  tenantId: string;
  role: Role;
}

interface LoginResponse {
  requiresTotp: boolean;
  accessToken?: string;
  user?: { id: string; role: Role; tenantId: string };
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string, totpCode?: string) => Promise<{ requiresTotp: boolean }>;
  register: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// El access token vive solo en memoria (nunca localStorage) — por eso al recargar la
// página se intenta un refresh silencioso contra la cookie httpOnly para restaurar
// la sesión.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setAccessToken(null);
      navigate('/login');
    });
    return () => setUnauthorizedHandler(null);
  }, [navigate]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'}/auth/refresh`,
          { method: 'POST', credentials: 'include' },
        );
        if (res.ok) {
          const data = await res.json();
          setAccessToken(data.accessToken);
          const me = await apiFetch<AuthUser>('/auth/me');
          setUser(me);
        }
      } catch {
        // sin sesión previa — se queda en null, el ProtectedRoute manda a /login
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      async login(email, password, totpCode) {
        const result = await apiFetch<LoginResponse>('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password, totpCode }),
        });
        if (!result.requiresTotp && result.accessToken && result.user) {
          setAccessToken(result.accessToken);
          setUser({
            userId: result.user.id,
            tenantId: result.user.tenantId,
            role: result.user.role,
          });
        }
        return { requiresTotp: result.requiresTotp };
      },
      async register(email, password, fullName) {
        await apiFetch('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ email, password, fullName }),
        });
      },
      async logout() {
        await apiFetch('/auth/logout', { method: 'POST' }).catch(() => undefined);
        setUser(null);
        setAccessToken(null);
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}

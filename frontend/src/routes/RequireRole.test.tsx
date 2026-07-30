import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RequireRole } from './RequireRole';

const useAuthMock = vi.fn();
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => useAuthMock(),
}));

function renderGuarded(allow: Array<'ADMIN' | 'ADVISOR' | 'CLIENT'>) {
  return render(
    <MemoryRouter initialEntries={['/admin/users']}>
      <Routes>
        <Route path="/login" element={<div>pantalla de login</div>} />
        <Route path="/dashboard" element={<div>dashboard genérico</div>} />
        <Route
          path="/admin/users"
          element={
            <RequireRole allow={allow}>
              <div>panel admin</div>
            </RequireRole>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RequireRole', () => {
  it('redirige a /login si no hay usuario autenticado', () => {
    useAuthMock.mockReturnValue({ user: null, loading: false });
    renderGuarded(['ADMIN']);
    expect(screen.getByText(/pantalla de login/i)).toBeInTheDocument();
  });

  it('redirige a /dashboard si el rol del usuario no está permitido', () => {
    useAuthMock.mockReturnValue({ user: { userId: 'u1', tenantId: 't1', role: 'CLIENT' }, loading: false });
    renderGuarded(['ADMIN']);
    expect(screen.getByText(/dashboard genérico/i)).toBeInTheDocument();
  });

  it('muestra el contenido si el rol está permitido', () => {
    useAuthMock.mockReturnValue({ user: { userId: 'u1', tenantId: 't1', role: 'ADMIN' }, loading: false });
    renderGuarded(['ADMIN']);
    expect(screen.getByText(/panel admin/i)).toBeInTheDocument();
  });
});

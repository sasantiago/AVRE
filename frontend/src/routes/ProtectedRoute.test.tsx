import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';

const useAuthMock = vi.fn();
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => useAuthMock(),
}));

function renderProtected() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="/login" element={<div>pantalla de login</div>} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <div>contenido protegido</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  it('muestra un loader mientras carga la sesión', () => {
    useAuthMock.mockReturnValue({ user: null, loading: true });
    renderProtected();
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('redirige a /login si no hay usuario autenticado', () => {
    useAuthMock.mockReturnValue({ user: null, loading: false });
    renderProtected();
    expect(screen.getByText(/pantalla de login/i)).toBeInTheDocument();
  });

  it('muestra el contenido si hay un usuario autenticado', () => {
    useAuthMock.mockReturnValue({
      user: { userId: 'u1', tenantId: 't1', role: 'CLIENT' },
      loading: false,
    });
    renderProtected();
    expect(screen.getByText(/contenido protegido/i)).toBeInTheDocument();
  });
});

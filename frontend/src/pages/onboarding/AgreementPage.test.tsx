import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AgreementPage from './AgreementPage';

const apiFetchMock = vi.fn();
vi.mock('@/lib/api-client', () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  ApiError: class ApiError extends Error {},
}));

describe('AgreementPage', () => {
  it('habilita el checkbox sin requerir scroll cuando el texto entra completo en el recuadro', async () => {
    // jsdom no calcula layout real: scrollHeight/clientHeight quedan en 0, que es
    // exactamente el caso "el contenido no desborda" que causaba el bug (el checkbox
    // quedaba bloqueado para siempre porque onScroll nunca se disparaba).
    apiFetchMock.mockResolvedValueOnce({
      id: 'a1',
      version: 'v1-placeholder',
      content: 'Texto corto del acuerdo.',
    });

    render(
      <MemoryRouter>
        <AgreementPage />
      </MemoryRouter>,
    );

    const checkbox = await screen.findByRole('checkbox');
    await waitFor(() => expect(checkbox).not.toBeDisabled());
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch, ApiError, setAccessToken, setUnauthorizedHandler } from './api-client';

describe('apiFetch', () => {
  beforeEach(() => {
    setAccessToken(null);
    setUnauthorizedHandler(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('devuelve el JSON cuando la respuesta es ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ hello: 'world' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiFetch<{ hello: string }>('/health');
    expect(result).toEqual({ hello: 'world' });
  });

  it('reintenta una vez tras un 401 refrescando el access token', async () => {
    const fetchMock = vi
      .fn()
      // 1) request original -> 401
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
      // 2) POST /auth/refresh -> ok, nuevo access token
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ accessToken: 'nuevo-token' }) })
      // 3) reintento del request original -> ok
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: 'ok' }) });
    vi.stubGlobal('fetch', fetchMock);

    const result = await apiFetch<{ data: string }>('/onboarding/status');

    expect(result).toEqual({ data: 'ok' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('si el refresh también falla, dispara el handler de no-autorizado y lanza ApiError', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);

    await expect(apiFetch('/onboarding/status')).rejects.toBeInstanceOf(ApiError);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});

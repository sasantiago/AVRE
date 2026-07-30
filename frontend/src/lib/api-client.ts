const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let accessToken: string | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

interface ApiFetchOptions extends RequestInit {
  skipAuthRetry?: boolean;
}

async function rawFetch(path: string, options: ApiFetchOptions = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  // credentials: 'include' — necesario para que viaje la cookie httpOnly de refresh.
  return fetch(`${API_BASE_URL}${path}`, { ...options, headers, credentials: 'include' });
}

async function tryRefresh(): Promise<boolean> {
  try {
    const res = await rawFetch('/auth/refresh', { method: 'POST', skipAuthRetry: true });
    if (!res.ok) return false;
    const data = await res.json();
    setAccessToken(data.accessToken);
    return true;
  } catch {
    return false;
  }
}

// Reintenta UNA vez tras un 401 refrescando el access token — si el refresh también
// falla, notifica al AuthProvider (que limpia sesión y manda a /login).
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  let res = await rawFetch(path, options);

  if (res.status === 401 && !options.skipAuthRetry) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await rawFetch(path, { ...options, skipAuthRetry: true });
    } else {
      unauthorizedHandler?.();
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.message ?? `Error ${res.status}`);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return res.json() as Promise<T>;
}

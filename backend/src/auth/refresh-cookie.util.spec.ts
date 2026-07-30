import { buildRefreshCookieOptions, getRefreshCookieName } from './refresh-cookie.util';

describe('refresh-cookie.util', () => {
  const makeConfig = (overrides: Record<string, string | undefined> = {}) => {
    const values: Record<string, string | undefined> = {
      COOKIE_SECURE: 'false',
      COOKIE_SAME_SITE: 'strict',
      COOKIE_DOMAIN: 'localhost',
      REFRESH_TOKEN_EXPIRES_IN: '7d',
      REFRESH_TOKEN_COOKIE_NAME: 'avre_refresh',
      ...overrides,
    };
    return { get: (key: string) => values[key] } as any;
  };

  it('arma opciones httpOnly + path /auth + maxAge en ms', () => {
    const options = buildRefreshCookieOptions(makeConfig());
    expect(options.httpOnly).toBe(true);
    expect(options.path).toBe('/auth');
    expect(options.sameSite).toBe('strict');
    expect(options.secure).toBe(false);
    expect(options.maxAge).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('secure=true cuando COOKIE_SECURE="true" (producción)', () => {
    const options = buildRefreshCookieOptions(makeConfig({ COOKIE_SECURE: 'true' }));
    expect(options.secure).toBe(true);
  });

  it('usa el nombre de cookie por defecto si no está configurado', () => {
    expect(getRefreshCookieName(makeConfig({ REFRESH_TOKEN_COOKIE_NAME: undefined }))).toBe(
      'avre_refresh',
    );
  });
});

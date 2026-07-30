import { ConfigService } from '@nestjs/config';
import { CookieOptions } from 'express';
import ms from 'ms';

export function buildRefreshCookieOptions(config: ConfigService): CookieOptions {
  return {
    httpOnly: true,
    secure: config.get<string>('COOKIE_SECURE') === 'true',
    sameSite: (config.get<string>('COOKIE_SAME_SITE') as CookieOptions['sameSite']) ?? 'strict',
    domain: config.get<string>('COOKIE_DOMAIN'),
    path: '/auth',
    maxAge: ms(config.get<string>('REFRESH_TOKEN_EXPIRES_IN') ?? '7d'),
  };
}

export function getRefreshCookieName(config: ConfigService): string {
  return config.get<string>('REFRESH_TOKEN_COOKIE_NAME') ?? 'avre_refresh';
}

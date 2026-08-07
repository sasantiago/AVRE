import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ContractType, Prisma } from '@prisma/client';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from './redis-client.token';

export interface Quote {
  price: Prisma.Decimal;
  asOf: Date;
  // % de variación respecto al cierre anterior — null si Finnhub no lo trae
  // (ej. instrumento recién listado, sin cierre previo). Usado para colorear
  // el treemap de Mercado (§4.1), no afecta la cotización de compra.
  changePct: number | null;
}

interface FinnhubQuoteResponse {
  c?: number; // current price
  dp?: number; // % change vs. cierre anterior
  t?: number; // timestamp unix (segundos)
}

interface RedisResult<T> {
  ok: boolean; // false = Redis falló (no solo "no encontrado")
  value: T | null;
}

const STAMPEDE_LOCK_TTL_MS = 5000;
const STAMPEDE_RETRY_DELAY_MS = 150;
const STAMPEDE_MAX_RETRIES = 20; // ~3s de espera máxima

// Caché de cotizaciones en Redis con TTL (§12) — el mismo valor sirve para la
// regla de "antigüedad máxima del precio" del §8. Stampede lock vía SET NX PX:
// si N requests concurrentes piden el mismo símbolo, solo una llama a Finnhub.
// Redis es una optimización, no una dependencia dura — si falla, se loguea y
// se sigue pidiendo directo a Finnhub (mismo criterio que NodemailerEmailSender
// sin SMTP configurado: avisa y sigue, no tira abajo la compra).
@Injectable()
export class MarketDataService {
  private readonly logger = new Logger(MarketDataService.name);

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {}

  // Usado por MarketQuoteRefreshService (ciclo de fondo, § refresco de
  // cotizaciones): pide directo a Finnhub y deja la caché fresca, sin pasar
  // por el stampede lock (acá no hay concurrencia — es un solo loop
  // secuencial) ni por getQuote (que preferiría leer la caché que este mismo
  // método está por escribir).
  async refreshAndCache(symbol: string, assetClass: ContractType): Promise<Quote> {
    const quote = await this.fetchFromFinnhub(symbol, assetClass);
    await this.tryRedisSet(this.cacheKeyFor(symbol), quote);
    return quote;
  }

  private cacheKeyFor(symbol: string): string {
    return `market:quote:${symbol}`;
  }

  async getQuote(symbol: string, assetClass: ContractType): Promise<Quote> {
    const cacheKey = this.cacheKeyFor(symbol);
    const cached = await this.tryRedisGet(cacheKey);
    if (cached.value) {
      return this.parseCached(cached.value);
    }
    if (!cached.ok) {
      // Redis no responde — nos salteamos caché y lock por completo, sin
      // agregar latencia de reintento por algo que ya sabemos que está caído.
      return this.fetchFromFinnhub(symbol, assetClass);
    }

    const lockKey = `market:quote-lock:${symbol}`;
    const lock = await this.tryRedisSetNx(lockKey, STAMPEDE_LOCK_TTL_MS);
    if (!lock.ok) {
      return this.fetchFromFinnhub(symbol, assetClass);
    }

    if (!lock.value) {
      // Otra request ya está trayendo este símbolo — esperamos un instante
      // corto y leemos la caché en vez de duplicar la llamada a Finnhub.
      for (let i = 0; i < STAMPEDE_MAX_RETRIES; i++) {
        await this.sleep(STAMPEDE_RETRY_DELAY_MS);
        const retry = await this.tryRedisGet(cacheKey);
        if (retry.value) return this.parseCached(retry.value);
      }
      // Se agotó la espera (la request que tenía el lock pudo haber fallado) —
      // pedimos directo para no dejar al cliente sin cotización.
      return this.fetchFromFinnhub(symbol, assetClass);
    }

    try {
      const quote = await this.fetchFromFinnhub(symbol, assetClass);
      await this.tryRedisSet(cacheKey, quote);
      return quote;
    } finally {
      await this.tryRedisDel(lockKey);
    }
  }

  private async fetchFromFinnhub(symbol: string, assetClass: ContractType): Promise<Quote> {
    const baseUrl = this.config.get<string>('FINNHUB_API_URL');
    const apiKey = this.config.get<string>('FINNHUB_API_KEY');
    // Finnhub espera los pares de FX con prefijo de exchange (ej. OANDA:EUR_USD).
    const finnhubSymbol = assetClass === ContractType.FOREX ? `OANDA:${symbol}` : symbol;

    const res = await fetch(
      `${baseUrl}/quote?symbol=${encodeURIComponent(finnhubSymbol)}&token=${apiKey ?? ''}`,
    );
    const body = (await res.json()) as FinnhubQuoteResponse;
    if (typeof body.c !== 'number' || body.c <= 0) {
      throw new Error(`No se pudo obtener una cotización válida para ${symbol}`);
    }
    return {
      price: new Prisma.Decimal(body.c),
      asOf: body.t ? new Date(body.t * 1000) : new Date(),
      changePct: typeof body.dp === 'number' ? body.dp : null,
    };
  }

  private parseCached(raw: string): Quote {
    const parsed = JSON.parse(raw) as { price: string; asOf: string; changePct: number | null };
    return {
      price: new Prisma.Decimal(parsed.price),
      asOf: new Date(parsed.asOf),
      changePct: parsed.changePct,
    };
  }

  private async tryRedisGet(key: string): Promise<RedisResult<string>> {
    try {
      return { ok: true, value: await this.redis.get(key) };
    } catch (err) {
      this.logger.warn(`Redis GET falló (${key}): ${(err as Error).message}`);
      return { ok: false, value: null };
    }
  }

  private async tryRedisSet(key: string, quote: Quote): Promise<void> {
    try {
      const ttlMs = Number(this.config.get<string>('MARKET_QUOTE_CACHE_TTL_MS') ?? '15000');
      await this.redis.set(
        key,
        JSON.stringify({
          price: quote.price.toString(),
          asOf: quote.asOf.toISOString(),
          changePct: quote.changePct,
        }),
        'PX',
        ttlMs,
      );
    } catch (err) {
      this.logger.warn(`Redis SET falló (${key}): ${(err as Error).message}`);
    }
  }

  // value=true si se adquirió el lock, false si ya lo tenía otra request.
  private async tryRedisSetNx(key: string, ttlMs: number): Promise<RedisResult<boolean>> {
    try {
      const result = await this.redis.set(key, '1', 'PX', ttlMs, 'NX');
      return { ok: true, value: result === 'OK' };
    } catch (err) {
      this.logger.warn(`Redis SET NX falló (${key}): ${(err as Error).message}`);
      return { ok: false, value: null };
    }
  }

  private async tryRedisDel(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch {
      // no-op — el lock igual expira solo por su TTL.
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

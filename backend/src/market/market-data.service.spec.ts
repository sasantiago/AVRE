import { ContractType } from '@prisma/client';
import { MarketDataService } from './market-data.service';

describe('MarketDataService', () => {
  let redis: any;
  let config: any;
  let service: MarketDataService;

  const envMap: Record<string, string> = {
    FINNHUB_API_URL: 'https://finnhub.test',
    FINNHUB_API_KEY: 'key123',
    MARKET_QUOTE_CACHE_TTL_MS: '15000',
  };

  beforeEach(() => {
    redis = { get: jest.fn(), set: jest.fn(), del: jest.fn() };
    config = { get: jest.fn((k: string) => envMap[k]) };
    service = new MarketDataService(redis, config);
    global.fetch = jest.fn(() =>
      Promise.resolve({ json: () => Promise.resolve({ c: 150.25, t: 1234567890 }) }),
    ) as any;
  });

  it('devuelve la cotización cacheada sin llamar a Finnhub (cache hit)', async () => {
    redis.get.mockResolvedValue(JSON.stringify({ price: '100', asOf: new Date().toISOString() }));
    const quote = await service.getQuote('AAPL', ContractType.STOCKS);
    expect(quote.price.toString()).toBe('100');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('cache miss: adquiere el lock, pide a Finnhub y cachea el resultado', async () => {
    redis.get.mockResolvedValue(null);
    redis.set.mockResolvedValue('OK'); // NX exitoso
    const quote = await service.getQuote('AAPL', ContractType.STOCKS);
    expect(quote.price.toString()).toBe('150.25');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    // Un SET para el lock y otro para cachear el resultado.
    expect(redis.set).toHaveBeenCalledTimes(2);
    expect(redis.del).toHaveBeenCalled(); // libera el lock
  });

  it('cache miss + lock tomado por otra request: espera y lee la caché en vez de duplicar la llamada', async () => {
    redis.get
      .mockResolvedValueOnce(null) // primer chequeo de caché
      .mockResolvedValueOnce(null) // primer retry mientras espera
      .mockResolvedValueOnce(JSON.stringify({ price: '200', asOf: new Date().toISOString() }));
    redis.set.mockResolvedValue(null); // NX falla: alguien más tiene el lock

    const quote = await service.getQuote('AAPL', ContractType.STOCKS);

    expect(quote.price.toString()).toBe('200');
    expect(global.fetch).not.toHaveBeenCalled();
  }, 10000);

  it('para FOREX arma el símbolo con el prefijo OANDA: que espera Finnhub', async () => {
    redis.get.mockResolvedValue(null);
    redis.set.mockResolvedValue('OK');
    await service.getQuote('EUR_USD', ContractType.FOREX);
    const calledUrl = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(calledUrl).toContain(encodeURIComponent('OANDA:EUR_USD'));
  });

  it('si Redis GET falla, se salta caché y lock y pide directo a Finnhub', async () => {
    redis.get.mockRejectedValue(new Error('conexión caída'));
    const quote = await service.getQuote('AAPL', ContractType.STOCKS);
    expect(quote.price.toString()).toBe('150.25');
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(redis.set).not.toHaveBeenCalled();
  });

  it('lanza error si Finnhub no devuelve un precio válido', async () => {
    redis.get.mockResolvedValue(null);
    redis.set.mockResolvedValue('OK');
    global.fetch = jest.fn(() => Promise.resolve({ json: () => Promise.resolve({}) })) as any;
    await expect(service.getQuote('XXX', ContractType.STOCKS)).rejects.toThrow();
  });
});

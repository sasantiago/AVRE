import { ContractType } from '@prisma/client';
import { MarketQuoteRefreshService } from './market-quote-refresh.service';

describe('MarketQuoteRefreshService', () => {
  let prisma: any;
  let tenantContext: any;
  let instrumentRepo: any;
  let marketDataService: any;
  let config: any;
  let cls: any;
  let service: MarketQuoteRefreshService;

  const instrument = (symbol: string, assetClass: ContractType = ContractType.STOCKS) => ({
    instrument: { symbol, assetClass },
  });

  beforeEach(() => {
    jest.useFakeTimers();

    prisma = { tenant: { findMany: jest.fn().mockResolvedValue([{ id: 'tenant-1' }]) } };
    // run() simplificado: ejecuta el callback directo, sin transacción real —
    // alcanza para probar que el servicio recorre tenants correctamente.
    tenantContext = { run: jest.fn((_tenantId: string, work: () => Promise<unknown>) => work()) };
    instrumentRepo = {
      listForTenant: jest.fn().mockResolvedValue([instrument('AAPL'), instrument('MSFT')]),
    };
    marketDataService = { refreshAndCache: jest.fn().mockResolvedValue(undefined) };
    config = { get: jest.fn(() => '1000') };
    // run() simplificado: ejecuta el callback directo — alcanza para probar
    // que el servicio abre un contexto propio antes de usar TenantContextService.
    cls = { run: jest.fn((work: () => Promise<unknown>) => work()) };

    service = new MarketQuoteRefreshService(
      prisma,
      tenantContext,
      instrumentRepo,
      marketDataService,
      config,
      cls,
    );
  });

  afterEach(() => {
    service.onModuleDestroy();
    jest.useRealTimers();
  });

  it('recorre los tenants y refresca cada símbolo activo del catálogo', async () => {
    service.onModuleInit();
    await jest.advanceTimersByTimeAsync(0); // deja correr collectActiveSymbols()

    expect(cls.run).toHaveBeenCalled(); // abre contexto CLS propio — no hay request HTTP acá
    expect(tenantContext.run).toHaveBeenCalledWith('tenant-1', expect.any(Function));
    expect(marketDataService.refreshAndCache).toHaveBeenCalledWith('AAPL', ContractType.STOCKS);

    await jest.advanceTimersByTimeAsync(1000); // pasa el delay entre símbolos
    expect(marketDataService.refreshAndCache).toHaveBeenCalledWith('MSFT', ContractType.STOCKS);
    expect(marketDataService.refreshAndCache).toHaveBeenCalledTimes(2);
  });

  it('si un símbolo falla, sigue con el resto sin cortar el ciclo', async () => {
    marketDataService.refreshAndCache
      .mockRejectedValueOnce(new Error('rate limit'))
      .mockResolvedValueOnce(undefined);

    service.onModuleInit();
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(1000);

    expect(marketDataService.refreshAndCache).toHaveBeenCalledTimes(2);
    expect(marketDataService.refreshAndCache).toHaveBeenNthCalledWith(
      1,
      'AAPL',
      ContractType.STOCKS,
    );
    expect(marketDataService.refreshAndCache).toHaveBeenNthCalledWith(
      2,
      'MSFT',
      ContractType.STOCKS,
    );
  });

  it('con catálogo vacío, no intenta refrescar nada', async () => {
    instrumentRepo.listForTenant.mockResolvedValue([]);

    service.onModuleInit();
    await jest.advanceTimersByTimeAsync(0);

    expect(marketDataService.refreshAndCache).not.toHaveBeenCalled();
  });

  it('deduplica símbolos repetidos entre tenants distintos', async () => {
    prisma.tenant.findMany.mockResolvedValue([{ id: 'tenant-1' }, { id: 'tenant-2' }]);
    instrumentRepo.listForTenant.mockResolvedValue([instrument('AAPL')]); // mismo símbolo en ambos tenants

    service.onModuleInit();
    await jest.advanceTimersByTimeAsync(0);

    expect(marketDataService.refreshAndCache).toHaveBeenCalledTimes(1);
  });

  it('onModuleDestroy corta el ciclo antes de la próxima vuelta', async () => {
    service.onModuleInit();
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(1000);
    const callsBeforeStop = marketDataService.refreshAndCache.mock.calls.length;

    service.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(5000);

    expect(marketDataService.refreshAndCache.mock.calls.length).toBe(callsBeforeStop);
  });
});

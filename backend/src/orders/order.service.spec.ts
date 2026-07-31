import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ContractType, OrderSide, Prisma } from '@prisma/client';
import { isMarketOpen } from '../market/market-hours.util';
import { OrderService } from './order.service';

jest.mock('../market/market-hours.util', () => ({ isMarketOpen: jest.fn() }));

describe('OrderService', () => {
  const userId = '018f0000-0000-7000-8000-000000000002';
  const advisorId = '018f0000-0000-7000-8000-000000000003';
  const instrumentId = '018f0000-0000-7000-8000-000000000004';
  const tenantInstrumentId = '018f0000-0000-7000-8000-000000000005';

  let orderRepo: any;
  let holdingRepo: any;
  let instrumentRepo: any;
  let marketDataService: any;
  let ledgerService: any;
  let userRepo: any;
  let auditRecorder: any;
  let service: OrderService;

  const fakeTenantInstrument = (overrides = {}) => ({
    id: tenantInstrumentId,
    isActive: true,
    instrument: {
      id: instrumentId,
      symbol: 'AAPL',
      name: 'Apple',
      assetClass: ContractType.STOCKS,
    },
    ...overrides,
  });

  beforeEach(() => {
    orderRepo = {
      create: jest.fn((input: any) => ({ id: input.id, ...input })),
      listForUser: jest.fn(),
    };
    holdingRepo = {
      findAllForUser: jest.fn().mockResolvedValue([]),
      upsertBuy: jest.fn(),
      deleteForUser: jest.fn(),
    };
    instrumentRepo = { findTenantInstrumentById: jest.fn() };
    marketDataService = { getQuote: jest.fn() };
    ledgerService = { append: jest.fn() };
    userRepo = { findById: jest.fn(), findByIdForAdvisor: jest.fn() };
    auditRecorder = { record: jest.fn().mockResolvedValue(undefined) };
    (isMarketOpen as jest.Mock).mockReturnValue(true);

    service = new OrderService(
      orderRepo,
      holdingRepo,
      instrumentRepo,
      marketDataService,
      ledgerService,
      userRepo,
      auditRecorder,
    );
  });

  const buyDto = (overrides = {}) => ({
    tenantInstrumentId,
    amountUsd: 100,
    quotedPrice: 150,
    ...overrides,
  });

  describe('buy', () => {
    it('rechaza si el instrumento no está habilitado para el tenant', async () => {
      instrumentRepo.findTenantInstrumentById.mockResolvedValue(null);
      await expect(service.buy({ userId } as any, buyDto())).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('si no se puede obtener cotización (ej. sin FINNHUB_API_KEY), rechaza con 400 y no un 500 crudo', async () => {
      instrumentRepo.findTenantInstrumentById.mockResolvedValue(fakeTenantInstrument());
      marketDataService.getQuote.mockRejectedValue(new Error('sin FINNHUB_API_KEY'));

      await expect(service.buy({ userId } as any, buyDto())).rejects.toBeInstanceOf(BadRequestException);
      expect(ledgerService.append).not.toHaveBeenCalled();
    });

    it('rechaza si el instrumento está deshabilitado (isActive false)', async () => {
      instrumentRepo.findTenantInstrumentById.mockResolvedValue(
        fakeTenantInstrument({ isActive: false }),
      );
      await expect(service.buy({ userId } as any, buyDto())).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rechaza fuera de horario de mercado', async () => {
      instrumentRepo.findTenantInstrumentById.mockResolvedValue(fakeTenantInstrument());
      (isMarketOpen as jest.Mock).mockReturnValue(false);
      await expect(service.buy({ userId } as any, buyDto())).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(ledgerService.append).not.toHaveBeenCalled();
    });

    it('rechaza con 409 si el precio se movió más de 0.5% y no ejecuta nada', async () => {
      instrumentRepo.findTenantInstrumentById.mockResolvedValue(fakeTenantInstrument());
      marketDataService.getQuote.mockResolvedValue({
        price: new Prisma.Decimal('160'),
        asOf: new Date(),
      });

      await expect(
        service.buy({ userId } as any, buyDto({ quotedPrice: 150 })),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(ledgerService.append).not.toHaveBeenCalled();
      expect(orderRepo.create).not.toHaveBeenCalled();
      expect(holdingRepo.upsertBuy).not.toHaveBeenCalled();
    });

    it('ejecuta la compra: debita el ledger, crea la orden y actualiza el holding', async () => {
      instrumentRepo.findTenantInstrumentById.mockResolvedValue(fakeTenantInstrument());
      marketDataService.getQuote.mockResolvedValue({
        price: new Prisma.Decimal('150'),
        asOf: new Date(),
      });
      ledgerService.append.mockResolvedValue({ id: 'entry-1' });

      const order = await service.buy(
        { userId } as any,
        buyDto({ amountUsd: 300, quotedPrice: 150 }),
      );

      expect(ledgerService.append).toHaveBeenCalledWith(
        expect.objectContaining({ userId, type: 'BUY', refType: 'Order' }),
      );
      const amountArg = ledgerService.append.mock.calls[0][0].amount;
      expect(new Prisma.Decimal(amountArg).toString()).toBe('-300');

      expect(order.quantity.toString()).toBe('2'); // 300 / 150
      expect(order.side).toBe(OrderSide.BUY);
      expect(holdingRepo.upsertBuy).toHaveBeenCalledWith(
        userId,
        instrumentId,
        expect.anything(),
        expect.anything(),
      );
      expect(auditRecorder.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'ORDER_EXECUTED' }),
      );
    });

    it('si el saldo es insuficiente, el ledger rechaza y no se crea la orden ni el holding', async () => {
      instrumentRepo.findTenantInstrumentById.mockResolvedValue(fakeTenantInstrument());
      marketDataService.getQuote.mockResolvedValue({
        price: new Prisma.Decimal('150'),
        asOf: new Date(),
      });
      ledgerService.append.mockRejectedValue(
        new ConflictException('Saldo disponible insuficiente'),
      );

      await expect(service.buy({ userId } as any, buyDto())).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(orderRepo.create).not.toHaveBeenCalled();
      expect(holdingRepo.upsertBuy).not.toHaveBeenCalled();
    });
  });

  describe('liquidateAllHoldings', () => {
    it('devuelve 0 y no audita si no hay holdings', async () => {
      holdingRepo.findAllForUser.mockResolvedValue([]);
      const total = await service.liquidateAllHoldings(userId);
      expect(total.toString()).toBe('0');
      expect(auditRecorder.record).not.toHaveBeenCalled();
    });

    it('vende todas las posiciones, acredita el producido y borra los holdings', async () => {
      holdingRepo.findAllForUser.mockResolvedValue([
        {
          instrumentId,
          quantity: new Prisma.Decimal('10'),
          instrument: { symbol: 'AAPL', assetClass: ContractType.STOCKS },
        },
      ]);
      marketDataService.getQuote.mockResolvedValue({
        price: new Prisma.Decimal('150'),
        asOf: new Date(),
      });

      const total = await service.liquidateAllHoldings(userId);

      expect(total.toString()).toBe('1500');
      expect(ledgerService.append).toHaveBeenCalledWith(
        expect.objectContaining({ userId, type: 'SELL', refType: 'Order' }),
      );
      expect(orderRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ side: OrderSide.SELL }),
      );
      expect(holdingRepo.deleteForUser).toHaveBeenCalledWith(userId, instrumentId);
      expect(auditRecorder.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'HOLDINGS_LIQUIDATED' }),
      );
    });
  });

  describe('getPortfolio', () => {
    it('incluye posiciones con cotización cuando está disponible', async () => {
      userRepo.findById.mockResolvedValue({ cashBalanceUsd: new Prisma.Decimal('500') });
      holdingRepo.findAllForUser.mockResolvedValue([
        {
          quantity: new Prisma.Decimal('10'),
          avgCostUsd: new Prisma.Decimal('100'),
          instrument: { symbol: 'AAPL', name: 'Apple' },
        },
      ]);
      marketDataService.getQuote.mockResolvedValue({
        price: new Prisma.Decimal('150'),
        asOf: new Date(),
      });

      const portfolio = await service.getPortfolio(userId);

      expect(portfolio.cashBalanceUsd).toBe('500');
      expect(portfolio.positions[0].marketValueUsd).toBe('1500');
      expect(portfolio.positions[0].returnPct).toBe('50'); // (1500-1000)/1000 * 100
      expect(portfolio.totalValueUsd).toBe('2000'); // 500 cash + 1500 posiciones
    });

    it('si la cotización falla, la posición se muestra igual sin valor de mercado', async () => {
      userRepo.findById.mockResolvedValue({ cashBalanceUsd: new Prisma.Decimal('0') });
      holdingRepo.findAllForUser.mockResolvedValue([
        {
          quantity: new Prisma.Decimal('10'),
          avgCostUsd: new Prisma.Decimal('100'),
          instrument: { symbol: 'AAPL', name: 'Apple' },
        },
      ]);
      marketDataService.getQuote.mockRejectedValue(new Error('sin FINNHUB_API_KEY'));

      const portfolio = await service.getPortfolio(userId);

      expect(portfolio.positions[0].marketValueUsd).toBeNull();
      expect(portfolio.positions[0].currentPrice).toBeNull();
    });
  });

  describe('scoping de asesor/admin', () => {
    it('getPortfolioForAdvisorClient lanza NotFoundException si el cliente no está asignado', async () => {
      userRepo.findByIdForAdvisor.mockResolvedValue(null);
      await expect(service.getPortfolioForAdvisorClient(advisorId, userId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('getPortfolioForAdmin lanza NotFoundException si el cliente no existe', async () => {
      userRepo.findById.mockResolvedValue(null);
      await expect(service.getPortfolioForAdmin(userId)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});

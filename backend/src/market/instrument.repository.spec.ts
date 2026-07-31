import { ContractType } from '@prisma/client';
import { InstrumentRepository } from './instrument.repository';

describe('InstrumentRepository', () => {
  const tenantId = '018f0000-0000-7000-8000-000000000001';

  let tx: any;
  let tenantContext: any;
  let repo: InstrumentRepository;

  beforeEach(() => {
    tx = {
      instrument: { findUnique: jest.fn(), create: jest.fn((args: any) => args.data) },
      tenantInstrument: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn((args: any) => args.data),
        update: jest.fn((args: any) => ({ id: args.where.id, ...args.data })),
      },
    };
    tenantContext = {
      getTx: jest.fn().mockReturnValue(tx),
      getTenantId: jest.fn().mockReturnValue(tenantId),
    };
    repo = new InstrumentRepository(tenantContext);
  });

  describe('findOrCreateBySymbol', () => {
    it('devuelve el existente si ya hay un Instrument con ese symbol (dedup global, §9.1)', async () => {
      const existing = { id: 'instr-1', symbol: 'AAPL' };
      tx.instrument.findUnique.mockResolvedValue(existing);

      const result = await repo.findOrCreateBySymbol({
        symbol: 'AAPL',
        name: 'Apple',
        assetClass: ContractType.STOCKS,
      });

      expect(result).toBe(existing);
      expect(tx.instrument.create).not.toHaveBeenCalled();
    });

    it('crea uno nuevo si no existe', async () => {
      tx.instrument.findUnique.mockResolvedValue(null);
      await repo.findOrCreateBySymbol({
        symbol: 'MSFT',
        name: 'Microsoft',
        assetClass: ContractType.STOCKS,
      });
      expect(tx.instrument.create).toHaveBeenCalled();
      expect(tx.instrument.create.mock.calls[0][0].data.symbol).toBe('MSFT');
    });
  });

  describe('upsertTenantInstrument', () => {
    it('crea el TenantInstrument si no existe para este tenant', async () => {
      tx.tenantInstrument.findUnique.mockResolvedValue(null);
      await repo.upsertTenantInstrument('instr-1', true);
      expect(tx.tenantInstrument.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ tenantId, instrumentId: 'instr-1', isActive: true }),
        }),
      );
    });

    it('reactiva/actualiza el existente en vez de duplicar', async () => {
      tx.tenantInstrument.findUnique.mockResolvedValue({
        id: 'ti-1',
        tenantId,
        instrumentId: 'instr-1',
        isActive: false,
      });
      await repo.upsertTenantInstrument('instr-1', true);
      expect(tx.tenantInstrument.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'ti-1' }, data: { isActive: true } }),
      );
      expect(tx.tenantInstrument.create).not.toHaveBeenCalled();
    });
  });

  describe('listForTenant', () => {
    it('filtra por isActive cuando se pasa', async () => {
      tx.tenantInstrument.findMany.mockResolvedValue([]);
      await repo.listForTenant({ isActive: true });
      expect(tx.tenantInstrument.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
    });
  });

  describe('findActiveBySymbol', () => {
    it('busca por symbol del instrumento relacionado y solo activos', async () => {
      await repo.findActiveBySymbol('AAPL');
      expect(tx.tenantInstrument.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true, instrument: { symbol: 'AAPL' } } }),
      );
    });
  });
});

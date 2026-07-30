import { TenantContextService } from './tenant-context.service';

describe('TenantContextService', () => {
  let prisma: any;
  let cls: any;
  let service: TenantContextService;
  let fakeTx: any;

  beforeEach(() => {
    fakeTx = { $executeRawUnsafe: jest.fn().mockResolvedValue(undefined) };
    prisma = {
      $transaction: jest.fn((callback: (tx: unknown) => Promise<unknown>) => callback(fakeTx)),
    };
    cls = { set: jest.fn(), get: jest.fn() };
    service = new TenantContextService(prisma, cls);
  });

  it('run() setea app.tenant_id vía set_config parametrizado (no interpolación de string)', async () => {
    await service.run('tenant-1', async () => 'resultado');

    expect(fakeTx.$executeRawUnsafe).toHaveBeenCalledWith(
      `SELECT set_config('app.tenant_id', $1, true)`,
      'tenant-1',
    );
  });

  it('run() guarda tenantId y tx en el store CLS antes de correr el work', async () => {
    await service.run('tenant-1', async () => undefined);

    expect(cls.set).toHaveBeenCalledWith('tenantId', 'tenant-1');
    expect(cls.set).toHaveBeenCalledWith('tx', fakeTx);
  });

  it('run() devuelve lo que resuelve work()', async () => {
    const result = await service.run('tenant-1', async () => ({ ok: true }));
    expect(result).toEqual({ ok: true });
  });

  it('getTx() lanza si no hay contexto activo', () => {
    cls.get.mockReturnValue(undefined);
    expect(() => service.getTx()).toThrow(/No hay contexto de tenant activo/);
  });

  it('getTenantId() lanza si no hay tenantId en el CLS', () => {
    cls.get.mockReturnValue(undefined);
    expect(() => service.getTenantId()).toThrow(/No hay tenantId/);
  });

  it('getTx()/getTenantId() devuelven lo guardado en el CLS', () => {
    cls.get.mockImplementation((key: string) => (key === 'tx' ? fakeTx : 'tenant-1'));
    expect(service.getTx()).toBe(fakeTx);
    expect(service.getTenantId()).toBe('tenant-1');
  });
});

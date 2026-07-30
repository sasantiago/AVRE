import { AuditQueryService } from './audit-query.service';

describe('AuditQueryService', () => {
  let tx: any;
  let tenantContext: any;
  let service: AuditQueryService;

  beforeEach(() => {
    tx = { auditLog: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) } };
    tenantContext = { getTx: jest.fn().mockReturnValue(tx) };
    service = new AuditQueryService(tenantContext);
  });

  it('pagina con page=1/pageSize=25 por defecto', async () => {
    await service.list({});
    expect(tx.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 25, orderBy: { createdAt: 'desc' } }),
    );
  });

  it('calcula el offset correcto para páginas siguientes', async () => {
    await service.list({ page: 3, pageSize: 10 });
    expect(tx.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 10 }));
  });

  it('filtra por action y actorUserId cuando se pasan', async () => {
    await service.list({ action: 'LOGIN_SUCCESS', actorUserId: 'u1' });
    expect(tx.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ action: 'LOGIN_SUCCESS', actorUserId: 'u1' }) }),
    );
  });

  it('arma el rango de fechas createdAt solo si viene from u to', async () => {
    const from = new Date('2026-01-01');
    await service.list({ from });
    expect(tx.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ createdAt: { gte: from, lte: undefined } }) }),
    );
  });

  it('devuelve items/total/page/pageSize', async () => {
    tx.auditLog.findMany.mockResolvedValue([{ id: '1' }]);
    tx.auditLog.count.mockResolvedValue(1);
    const result = await service.list({});
    expect(result).toEqual({ items: [{ id: '1' }], total: 1, page: 1, pageSize: 25 });
  });
});

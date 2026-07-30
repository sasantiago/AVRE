import { AuditService } from './audit.service';

describe('AuditService', () => {
  it('escribe el AuditLog en la transacción activa del tenant actual', async () => {
    const tx = { auditLog: { create: jest.fn().mockResolvedValue({}) } };
    const tenantContext = {
      getTx: jest.fn().mockReturnValue(tx),
      getTenantId: jest.fn().mockReturnValue('tenant-1'),
    };
    const service = new AuditService(tenantContext as any);

    await service.record({ actorUserId: 'u1', action: 'LOGIN_SUCCESS', metadata: { ip: '1.2.3.4' } });

    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tenantId: 'tenant-1',
        actorUserId: 'u1',
        action: 'LOGIN_SUCCESS',
        metadata: { ip: '1.2.3.4' },
      }),
    });
  });
});

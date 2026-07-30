import { InternalServerErrorException } from '@nestjs/common';
import { TenantsService } from './tenants.service';

describe('TenantsService', () => {
  let prisma: any;
  let config: any;
  let service: TenantsService;

  beforeEach(() => {
    prisma = { tenant: { findUnique: jest.fn() } };
    config = { get: jest.fn().mockReturnValue('avre-default') };
    service = new TenantsService(prisma, config);
  });

  it('lanza si DEFAULT_TENANT_SLUG no está configurado', async () => {
    config.get.mockReturnValue(undefined);
    await expect(service.resolveDefaultTenantId()).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('lanza si el tenant por defecto no existe (falta correr el seed)', async () => {
    prisma.tenant.findUnique.mockResolvedValue(null);
    await expect(service.resolveDefaultTenantId()).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });

  it('devuelve el id del tenant por defecto', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1', slug: 'avre-default' });
    await expect(service.resolveDefaultTenantId()).resolves.toBe('tenant-1');
    expect(prisma.tenant.findUnique).toHaveBeenCalledWith({ where: { slug: 'avre-default' } });
  });
});

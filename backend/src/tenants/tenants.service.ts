import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

// La tabla Tenant no lleva tenant_id (es la raíz), así que se consulta directo con
// PrismaService — no hace falta TenantContextService acá.
@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async resolveDefaultTenantId(): Promise<string> {
    const slug = this.config.get<string>('DEFAULT_TENANT_SLUG');
    if (!slug) {
      throw new InternalServerErrorException('DEFAULT_TENANT_SLUG no está configurado');
    }
    const tenant = await this.prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) {
      throw new InternalServerErrorException(
        `No existe el tenant por defecto (slug="${slug}") — correr el seed primero`,
      );
    }
    return tenant.id;
  }
}

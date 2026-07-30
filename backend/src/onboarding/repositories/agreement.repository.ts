import { Injectable } from '@nestjs/common';
import { DiscretionaryAgreement } from '@prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';

@Injectable()
export class AgreementRepository {
  constructor(private readonly tenantContext: TenantContextService) {}

  async findActive(): Promise<DiscretionaryAgreement | null> {
    return this.tenantContext.getTx().discretionaryAgreement.findFirst({
      where: { isActive: true },
      orderBy: { publishedAt: 'desc' },
    });
  }

  async findById(id: string): Promise<DiscretionaryAgreement | null> {
    return this.tenantContext.getTx().discretionaryAgreement.findUnique({ where: { id } });
  }
}

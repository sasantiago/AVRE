import { Injectable } from '@nestjs/common';
import { AgreementAcceptance } from '@prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { generateId } from '../../common/utils/uuid';

export interface CreateAgreementAcceptanceInput {
  tenantId: string;
  userId: string;
  agreementVersionId: string;
  ipAddress: string;
  userAgent: string;
}

@Injectable()
export class AgreementAcceptanceRepository {
  constructor(private readonly tenantContext: TenantContextService) {}

  async create(input: CreateAgreementAcceptanceInput): Promise<AgreementAcceptance> {
    return this.tenantContext.getTx().agreementAcceptance.create({
      data: {
        id: generateId(),
        tenantId: input.tenantId,
        userId: input.userId,
        agreementVersionId: input.agreementVersionId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  }
}

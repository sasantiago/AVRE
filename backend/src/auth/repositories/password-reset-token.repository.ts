import { Injectable } from '@nestjs/common';
import { PasswordResetToken } from '@prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { generateId } from '../../common/utils/uuid';

export interface CreatePasswordResetTokenInput {
  tenantId: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

@Injectable()
export class PasswordResetTokenRepository {
  constructor(private readonly tenantContext: TenantContextService) {}

  async create(input: CreatePasswordResetTokenInput): Promise<PasswordResetToken> {
    return this.tenantContext.getTx().passwordResetToken.create({
      data: {
        id: generateId(),
        tenantId: input.tenantId,
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      },
    });
  }

  async findByTokenHash(tokenHash: string): Promise<PasswordResetToken | null> {
    return this.tenantContext.getTx().passwordResetToken.findFirst({ where: { tokenHash } });
  }

  async markUsed(id: string): Promise<void> {
    await this.tenantContext.getTx().passwordResetToken.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }
}

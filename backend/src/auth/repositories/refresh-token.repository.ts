import { Injectable } from '@nestjs/common';
import { RefreshToken } from '@prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { generateId } from '../../common/utils/uuid';

export interface CreateRefreshTokenInput {
  tenantId: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

@Injectable()
export class RefreshTokenRepository {
  constructor(private readonly tenantContext: TenantContextService) {}

  async create(input: CreateRefreshTokenInput): Promise<RefreshToken> {
    return this.tenantContext.getTx().refreshToken.create({
      data: {
        id: generateId(),
        tenantId: input.tenantId,
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
      },
    });
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.tenantContext.getTx().refreshToken.findFirst({ where: { tokenHash } });
  }

  async markReplaced(id: string, replacedByTokenId: string): Promise<void> {
    await this.tenantContext.getTx().refreshToken.update({
      where: { id },
      data: { revokedAt: new Date(), replacedByTokenId },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.tenantContext.getTx().refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

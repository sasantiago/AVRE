import { Injectable } from '@nestjs/common';
import { TotpSecret } from '@prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { EncryptedPayload } from '../../common/utils/crypto.util';
import { generateId } from '../../common/utils/uuid';

export interface UpsertTotpSecretInput {
  tenantId: string;
  userId: string;
  payload: EncryptedPayload;
}

@Injectable()
export class TotpSecretRepository {
  constructor(private readonly tenantContext: TenantContextService) {}

  async findByUserId(userId: string): Promise<TotpSecret | null> {
    return this.tenantContext.getTx().totpSecret.findUnique({ where: { userId } });
  }

  async upsert(input: UpsertTotpSecretInput): Promise<TotpSecret> {
    const tx = this.tenantContext.getTx();
    return tx.totpSecret.upsert({
      where: { userId: input.userId },
      create: {
        id: generateId(),
        tenantId: input.tenantId,
        userId: input.userId,
        secretCiphertext: input.payload.ciphertext,
        secretIv: input.payload.iv,
        secretAuthTag: input.payload.authTag,
      },
      update: {
        secretCiphertext: input.payload.ciphertext,
        secretIv: input.payload.iv,
        secretAuthTag: input.payload.authTag,
      },
    });
  }
}

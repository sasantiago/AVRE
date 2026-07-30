import { Prisma } from '@prisma/client';

export interface TenantClsStore {
  tenantId?: string;
  tx?: Prisma.TransactionClient;
  [key: string]: unknown;
  [key: symbol]: unknown;
}

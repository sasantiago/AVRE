import { ConflictException, Injectable } from '@nestjs/common';
import { LedgerEntry, LedgerEntryType, Prisma, User } from '@prisma/client';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { generateId } from '../common/utils/uuid';

export interface AppendLedgerEntryInput {
  userId: string;
  type: LedgerEntryType;
  // Con signo: positivo acredita cashBalanceUsd, negativo lo debita (§5.1).
  amount: Prisma.Decimal.Value;
  refType?: string;
  refId?: string;
}

@Injectable()
export class LedgerRepository {
  constructor(private readonly tenantContext: TenantContextService) {}

  // Único punto de mutación de User.cashBalanceUsd en todo el sistema (§5.1,
  // §11.2 "cualquier rol intentando escribir cashBalanceUsd directamente").
  // El asiento y el update de saldo van en la misma transacción de tenant
  // (TenantContextService.run() ya envuelve todo el request), y balanceAfter
  // se toma del resultado real del update — nunca se recalcula aparte.
  async appendEntry(input: AppendLedgerEntryInput): Promise<LedgerEntry> {
    const tx = this.tenantContext.getTx();
    const tenantId = this.tenantContext.getTenantId();
    const amount = new Prisma.Decimal(input.amount);

    const user = amount.isNegative()
      ? await this.debitIfSufficient(input.userId, amount.abs())
      : await tx.user.update({
          where: { id: input.userId },
          data: { cashBalanceUsd: { increment: amount } },
        });

    return tx.ledgerEntry.create({
      data: {
        id: generateId(),
        tenantId,
        userId: input.userId,
        type: input.type,
        amount,
        refType: input.refType,
        refId: input.refId,
        balanceAfter: user.cashBalanceUsd,
      },
    });
  }

  // Update condicional (cashBalanceUsd >= amount): evita saldo negativo por una
  // carrera entre dos débitos concurrentes del mismo cliente (§5.3).
  private async debitIfSufficient(userId: string, positiveAmount: Prisma.Decimal): Promise<User> {
    const tx = this.tenantContext.getTx();
    const result = await tx.user.updateMany({
      where: { id: userId, cashBalanceUsd: { gte: positiveAmount } },
      data: { cashBalanceUsd: { decrement: positiveAmount } },
    });
    if (result.count === 0) {
      throw new ConflictException('Saldo disponible insuficiente');
    }
    return tx.user.findUniqueOrThrow({ where: { id: userId } });
  }

  // Suma de asientos de un tipo para un cliente — ej. "capital" (§3.3, §7.3) es
  // la suma de asientos DEPOSIT. Funciona aunque todavía no exista ningún
  // asiento (devuelve 0). `since` acota al "período del acuerdo" (§7.3) — sin
  // pasarlo, es la suma de toda la vida del cliente.
  async sumAmountByUserAndType(
    userId: string,
    type: LedgerEntryType,
    since?: Date,
  ): Promise<Prisma.Decimal> {
    const result = await this.tenantContext.getTx().ledgerEntry.aggregate({
      where: { userId, type, ...(since ? { createdAt: { gte: since } } : {}) },
      _sum: { amount: true },
    });
    return result._sum.amount ?? new Prisma.Decimal(0);
  }

  async listForUser(userId: string): Promise<LedgerEntry[]> {
    return this.tenantContext.getTx().ledgerEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

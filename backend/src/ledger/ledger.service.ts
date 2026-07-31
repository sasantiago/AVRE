import { Inject, Injectable } from '@nestjs/common';
import { LedgerEntry, LedgerEntryType, Prisma } from '@prisma/client';
import { AUDIT_RECORDER, IAuditRecorder } from '../audit/audit.types';
import { AppendLedgerEntryInput, LedgerRepository } from './ledger.repository';

@Injectable()
export class LedgerService {
  constructor(
    private readonly ledgerRepo: LedgerRepository,
    @Inject(AUDIT_RECORDER) private readonly auditRecorder: IAuditRecorder,
  ) {}

  // Punto de entrada para los módulos de negocio (depósitos, órdenes, retiros —
  // próximas etapas): un asiento por movimiento, nunca una mutación directa de
  // cashBalanceUsd.
  async append(input: AppendLedgerEntryInput): Promise<LedgerEntry> {
    return this.ledgerRepo.appendEntry(input);
  }

  async getBalanceHistory(userId: string): Promise<LedgerEntry[]> {
    return this.ledgerRepo.listForUser(userId);
  }

  async getCapital(userId: string, since?: Date): Promise<Prisma.Decimal> {
    return this.ledgerRepo.sumAmountByUserAndType(userId, LedgerEntryType.DEPOSIT, since);
  }

  // Corrección manual (§5.1: "una corrección se hace con un asiento ADJUSTMENT
  // de signo contrario") — siempre queda auditada con quién y por qué.
  async createAdjustment(input: {
    actorUserId: string;
    userId: string;
    amount: Prisma.Decimal.Value;
    reason: string;
  }): Promise<LedgerEntry> {
    const entry = await this.ledgerRepo.appendEntry({
      userId: input.userId,
      type: LedgerEntryType.ADJUSTMENT,
      amount: input.amount,
    });
    await this.auditRecorder.record({
      actorUserId: input.actorUserId,
      action: 'LEDGER_ADJUSTMENT_CREATED',
      targetType: 'LedgerEntry',
      targetId: entry.id,
      metadata: { userId: input.userId, amount: entry.amount.toString(), reason: input.reason },
    });
    return entry;
  }
}

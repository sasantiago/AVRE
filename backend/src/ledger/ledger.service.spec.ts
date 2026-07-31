import { LedgerEntryType } from '@prisma/client';
import { LedgerService } from './ledger.service';

describe('LedgerService', () => {
  const userId = '018f0000-0000-7000-8000-000000000002';
  const actorUserId = '018f0000-0000-7000-8000-000000000001';

  let ledgerRepo: any;
  let auditRecorder: any;
  let service: LedgerService;

  beforeEach(() => {
    ledgerRepo = {
      appendEntry: jest.fn(),
      listForUser: jest.fn(),
      sumAmountByUserAndType: jest.fn(),
    };
    auditRecorder = { record: jest.fn().mockResolvedValue(undefined) };
    service = new LedgerService(ledgerRepo, auditRecorder);
  });

  it('append delega directo en el repositorio', async () => {
    ledgerRepo.appendEntry.mockResolvedValue({ id: 'entry-1' });
    const input = { userId, type: LedgerEntryType.DEPOSIT, amount: '100' };
    const result = await service.append(input);
    expect(ledgerRepo.appendEntry).toHaveBeenCalledWith(input);
    expect(result).toEqual({ id: 'entry-1' });
  });

  it('getBalanceHistory delega en listForUser', async () => {
    await service.getBalanceHistory(userId);
    expect(ledgerRepo.listForUser).toHaveBeenCalledWith(userId);
  });

  it('getCapital suma los asientos DEPOSIT del cliente', async () => {
    await service.getCapital(userId);
    expect(ledgerRepo.sumAmountByUserAndType).toHaveBeenCalledWith(
      userId,
      LedgerEntryType.DEPOSIT,
      undefined,
    );
  });

  it('getCapital acota por fecha cuando se pasa since (§7.3, capital "del período")', async () => {
    const since = new Date('2026-01-01');
    await service.getCapital(userId, since);
    expect(ledgerRepo.sumAmountByUserAndType).toHaveBeenCalledWith(
      userId,
      LedgerEntryType.DEPOSIT,
      since,
    );
  });

  it('createAdjustment crea un asiento ADJUSTMENT y audita con el motivo', async () => {
    ledgerRepo.appendEntry.mockResolvedValue({ id: 'adj-1', amount: { toString: () => '-25' } });

    await service.createAdjustment({
      actorUserId,
      userId,
      amount: '-25',
      reason: 'corrección manual',
    });

    expect(ledgerRepo.appendEntry).toHaveBeenCalledWith({
      userId,
      type: LedgerEntryType.ADJUSTMENT,
      amount: '-25',
    });
    expect(auditRecorder.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId,
        action: 'LEDGER_ADJUSTMENT_CREATED',
        targetType: 'LedgerEntry',
        targetId: 'adj-1',
        metadata: expect.objectContaining({ userId, amount: '-25', reason: 'corrección manual' }),
      }),
    );
  });
});

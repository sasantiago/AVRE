import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ChainNetwork, DepositStatus, LedgerEntryType, Prisma } from '@prisma/client';
import { DepositService } from './deposit.service';

describe('DepositService', () => {
  const userId = '018f0000-0000-7000-8000-000000000002';
  const advisorId = '018f0000-0000-7000-8000-000000000003';
  const depositId = '018f0000-0000-7000-8000-000000000004';
  const client = { userId, tenantId: 't1', role: 'CLIENT' };
  const advisor = { userId: advisorId, tenantId: 't1', role: 'ADVISOR' };
  const admin = { userId: 'admin-1', tenantId: 't1', role: 'ADMIN' };

  let depositRepo: any;
  let verifierRegistry: any;
  let verifier: any;
  let ledgerService: any;
  let userRepo: any;
  let config: any;
  let auditRecorder: any;
  let emailSender: any;
  let service: DepositService;

  const envMap: Record<string, string> = {
    DEPOSIT_WALLET_TRON_TRC20: 'Tplatform',
    DEPOSIT_WALLET_POLYGON: '0xplatform',
    DEPOSIT_REQUEST_TTL_HOURS: '24',
    DEPOSIT_MIN_CONFIRMATIONS_TRON: '20',
  };

  const baseDeposit = (overrides = {}) => ({
    id: depositId,
    userId,
    chain: ChainNetwork.TRON_TRC20,
    toAddress: 'Tplatform',
    declaredAmountToken: new Prisma.Decimal('100'),
    txHash: null,
    status: DepositStatus.PENDING_TX,
    verifiedAmountUsd: null,
    sourceWalletAddress: null,
    confirmations: null,
    expiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    depositRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findByChainAndTxHash: jest.fn(),
      listForClient: jest.fn(),
      listQueueForTenant: jest.fn(),
      findLastApprovedForUser: jest.fn(),
      applyTxHashSubmission: jest.fn(),
      applyVerificationResult: jest.fn(),
      approve: jest.fn(),
      reject: jest.fn(),
    };
    verifier = { verify: jest.fn() };
    verifierRegistry = { get: jest.fn().mockReturnValue(verifier) };
    ledgerService = { append: jest.fn() };
    userRepo = { findById: jest.fn(), findByIdForAdvisor: jest.fn() };
    config = { get: jest.fn((key: string) => envMap[key]) };
    auditRecorder = { record: jest.fn().mockResolvedValue(undefined) };
    emailSender = { send: jest.fn().mockResolvedValue(undefined) };

    service = new DepositService(
      depositRepo,
      verifierRegistry,
      ledgerService,
      userRepo,
      config,
      auditRecorder,
      emailSender,
    );
  });

  describe('create', () => {
    it('rechaza si no hay wallet configurada para la red', async () => {
      config.get.mockImplementation((k: string) =>
        k === 'DEPOSIT_WALLET_TRON_TRC20' ? undefined : envMap[k],
      );
      await expect(
        service.create(client as any, { chain: ChainNetwork.TRON_TRC20, declaredAmountToken: 10 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('crea con la wallet de la plataforma y expiresAt en el futuro', async () => {
      depositRepo.create.mockResolvedValue(baseDeposit());
      await service.create(client as any, {
        chain: ChainNetwork.TRON_TRC20,
        declaredAmountToken: 10,
      });
      const arg = depositRepo.create.mock.calls[0][0];
      expect(arg.toAddress).toBe('Tplatform');
      expect(arg.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('submitTxHash', () => {
    it('lanza NotFoundException si el depósito no es del cliente', async () => {
      depositRepo.findById.mockResolvedValue(baseDeposit({ userId: 'otro-cliente' }));
      await expect(
        service.submitTxHash(client as any, depositId, 'a'.repeat(64)),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rechaza si el depósito no está PENDING_TX', async () => {
      depositRepo.findById.mockResolvedValue(baseDeposit({ status: DepositStatus.PENDING_REVIEW }));
      await expect(
        service.submitTxHash(client as any, depositId, 'a'.repeat(64)),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza formato de hash inválido sin llamar al verificador (§6.4)', async () => {
      depositRepo.findById.mockResolvedValue(baseDeposit());
      await expect(
        service.submitTxHash(client as any, depositId, 'hash-invalido'),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(verifier.verify).not.toHaveBeenCalled();
    });

    it('rechaza con 409 si el hash ya fue reclamado por otro depósito', async () => {
      depositRepo.findById.mockResolvedValue(baseDeposit());
      depositRepo.findByChainAndTxHash.mockResolvedValue(baseDeposit({ id: 'otro-deposito' }));
      await expect(
        service.submitTxHash(client as any, depositId, 'a'.repeat(64)),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('guarda el hash y dispara la verificación', async () => {
      depositRepo.findById.mockResolvedValue(baseDeposit());
      depositRepo.findByChainAndTxHash.mockResolvedValue(null);
      const pending = baseDeposit({
        status: DepositStatus.PENDING_CONFIRMATIONS,
        txHash: 'a'.repeat(64),
      });
      depositRepo.applyTxHashSubmission.mockResolvedValue(pending);
      verifier.verify.mockResolvedValue({
        success: true,
        verifiedAmountToken: new Prisma.Decimal('100'),
        sourceAddress: 'Tsource',
        confirmations: 25,
        rawPrimary: {},
        rawSecondary: {},
      });
      depositRepo.applyVerificationResult.mockResolvedValue(
        baseDeposit({ status: DepositStatus.PENDING_REVIEW }),
      );

      await service.submitTxHash(client as any, depositId, 'a'.repeat(64));

      expect(depositRepo.applyTxHashSubmission).toHaveBeenCalledWith(depositId, 'a'.repeat(64));
      expect(verifier.verify).toHaveBeenCalled();
    });
  });

  describe('runVerification (a través de getOwn)', () => {
    const pendingConfirmations = () =>
      baseDeposit({ status: DepositStatus.PENDING_CONFIRMATIONS, txHash: 'a'.repeat(64) });

    it('pasa a FAILED si la verificación no es consistente, notifica y audita', async () => {
      depositRepo.findById.mockResolvedValue(pendingConfirmations());
      verifier.verify.mockResolvedValue({
        success: false,
        confirmations: 0,
        failureReason: 'contrato no coincide',
        rawPrimary: {},
        rawSecondary: {},
      });
      depositRepo.applyVerificationResult.mockResolvedValue(
        baseDeposit({ status: DepositStatus.FAILED }),
      );
      userRepo.findById.mockResolvedValue({ id: userId, email: 'cliente@test.com' });

      await service.getOwn(client as any, depositId);

      expect(depositRepo.applyVerificationResult).toHaveBeenCalledWith(
        depositId,
        expect.objectContaining({
          status: DepositStatus.FAILED,
          rejectionReason: 'contrato no coincide',
        }),
      );
      expect(emailSender.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'cliente@test.com' }),
      );
      expect(auditRecorder.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DEPOSIT_VERIFICATION_FAILED' }),
      );
    });

    it('se queda en PENDING_CONFIRMATIONS si las confirmaciones son insuficientes (TRON)', async () => {
      depositRepo.findById.mockResolvedValue(pendingConfirmations());
      verifier.verify.mockResolvedValue({
        success: true,
        verifiedAmountToken: new Prisma.Decimal('100'),
        sourceAddress: 'Tsource',
        confirmations: 5, // < 20 requeridas
        rawPrimary: {},
        rawSecondary: {},
      });
      depositRepo.applyVerificationResult.mockResolvedValue(pendingConfirmations());

      await service.getOwn(client as any, depositId);

      expect(depositRepo.applyVerificationResult).toHaveBeenCalledWith(
        depositId,
        expect.objectContaining({ status: DepositStatus.PENDING_CONFIRMATIONS }),
      );
      expect(auditRecorder.record).not.toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DEPOSIT_VERIFIED' }),
      );
    });

    it('pasa a PENDING_REVIEW cuando hay confirmaciones suficientes', async () => {
      depositRepo.findById.mockResolvedValue(pendingConfirmations());
      verifier.verify.mockResolvedValue({
        success: true,
        verifiedAmountToken: new Prisma.Decimal('100'),
        sourceAddress: 'Tsource',
        confirmations: 25,
        rawPrimary: {},
        rawSecondary: {},
      });
      depositRepo.applyVerificationResult.mockResolvedValue(
        baseDeposit({
          status: DepositStatus.PENDING_REVIEW,
          verifiedAmountUsd: new Prisma.Decimal('100'),
        }),
      );

      await service.getOwn(client as any, depositId);

      expect(depositRepo.applyVerificationResult).toHaveBeenCalledWith(
        depositId,
        expect.objectContaining({
          status: DepositStatus.PENDING_REVIEW,
          verifiedAmountUsd: expect.any(Prisma.Decimal),
          sourceWalletAddress: 'Tsource',
        }),
      );
      expect(auditRecorder.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DEPOSIT_VERIFIED' }),
      );
    });
  });

  describe('listQueue — alertas', () => {
    it('marca sourceWalletChangedWarning cuando la wallet de origen difiere del último depósito aprobado', async () => {
      const deposit = baseDeposit({
        status: DepositStatus.PENDING_REVIEW,
        sourceWalletAddress: 'Tnueva',
        verifiedAmountUsd: new Prisma.Decimal('100'),
      });
      depositRepo.listQueueForTenant.mockResolvedValue([deposit]);
      depositRepo.findLastApprovedForUser.mockResolvedValue(
        baseDeposit({ id: 'anterior', sourceWalletAddress: 'Tvieja' }),
      );

      const [result] = await service.listQueueForAdmin();
      expect(result.sourceWalletChangedWarning).toBe(true);
    });

    it('marca amountMismatchWarning cuando declarado y verificado difieren más del 1%', async () => {
      const deposit = baseDeposit({
        status: DepositStatus.PENDING_REVIEW,
        declaredAmountToken: new Prisma.Decimal('100'),
        verifiedAmountUsd: new Prisma.Decimal('80'),
      });
      depositRepo.listQueueForTenant.mockResolvedValue([deposit]);
      depositRepo.findLastApprovedForUser.mockResolvedValue(null);

      const [result] = await service.listQueueForAdmin();
      expect(result.amountMismatchWarning).toBe(true);
    });

    it('listQueueForAdvisor filtra por advisorId', async () => {
      depositRepo.listQueueForTenant.mockResolvedValue([]);
      await service.listQueueForAdvisor(advisorId);
      expect(depositRepo.listQueueForTenant).toHaveBeenCalledWith({
        status: DepositStatus.PENDING_REVIEW,
        advisorId,
      });
    });
  });

  describe('approve', () => {
    it('lanza NotFoundException si el depósito no existe', async () => {
      depositRepo.findById.mockResolvedValue(null);
      await expect(service.approve(admin as any, depositId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('un asesor no puede aprobar el depósito de un cliente que no tiene asignado', async () => {
      depositRepo.findById.mockResolvedValue(baseDeposit({ status: DepositStatus.PENDING_REVIEW }));
      userRepo.findByIdForAdvisor.mockResolvedValue(null);
      await expect(service.approve(advisor as any, depositId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(depositRepo.approve).not.toHaveBeenCalled();
    });

    it('aprueba, acredita en el ledger y audita', async () => {
      const deposit = baseDeposit({
        status: DepositStatus.PENDING_REVIEW,
        verifiedAmountUsd: new Prisma.Decimal('100'),
      });
      depositRepo.findById.mockResolvedValue(deposit);
      depositRepo.approve.mockResolvedValue({ ...deposit, status: DepositStatus.APPROVED });
      ledgerService.append.mockResolvedValue({
        amount: new Prisma.Decimal('100'),
        balanceAfter: new Prisma.Decimal('100'),
      });
      userRepo.findById.mockResolvedValue({ id: userId, email: 'cliente@test.com' });

      await service.approve(admin as any, depositId);

      expect(ledgerService.append).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          type: LedgerEntryType.DEPOSIT,
          refType: 'Deposit',
          refId: depositId,
        }),
      );
      expect(auditRecorder.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DEPOSIT_APPROVED' }),
      );
      expect(emailSender.send).toHaveBeenCalled();
    });
  });

  describe('reject', () => {
    it('rechaza con motivo, audita y notifica', async () => {
      const deposit = baseDeposit({ status: DepositStatus.PENDING_REVIEW });
      depositRepo.findById.mockResolvedValue(deposit);
      depositRepo.reject.mockResolvedValue({ ...deposit, status: DepositStatus.REJECTED });
      userRepo.findById.mockResolvedValue({ id: userId, email: 'cliente@test.com' });

      await service.reject(admin as any, depositId, 'monto no coincide');

      expect(depositRepo.reject).toHaveBeenCalledWith(depositId, admin.userId, 'monto no coincide');
      expect(auditRecorder.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'DEPOSIT_REJECTED' }),
      );
      expect(emailSender.send).toHaveBeenCalled();
    });
  });
});

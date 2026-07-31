import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  AgreementStatus,
  ChainNetwork,
  Prisma,
  WithdrawalStatus,
  WithdrawalType,
} from '@prisma/client';
import { WithdrawalService } from './withdrawal.service';

describe('WithdrawalService', () => {
  const userId = '018f0000-0000-7000-8000-000000000002';
  const advisorId = '018f0000-0000-7000-8000-000000000003';
  const withdrawalId = '018f0000-0000-7000-8000-000000000004';
  const agreementId = '018f0000-0000-7000-8000-000000000005';

  const client = { userId, tenantId: 't1', role: 'CLIENT' };
  const advisor = { userId: advisorId, tenantId: 't1', role: 'ADVISOR' };
  const admin = { userId: 'admin-1', tenantId: 't1', role: 'ADMIN' };

  let withdrawalRepo: any;
  let agreementRepo: any;
  let agreementService: any;
  let ledgerService: any;
  let userRepo: any;
  let orderService: any;
  let verifierRegistry: any;
  let verifier: any;
  let auditRecorder: any;
  let emailSender: any;
  let service: WithdrawalService;

  const fakeUser = (overrides = {}) => ({
    id: userId,
    email: 'cliente@test.com',
    cashBalanceUsd: new Prisma.Decimal('1000'),
    withdrawalWalletAddress: 'Twallet',
    withdrawalWalletNetwork: ChainNetwork.TRON_TRC20,
    withdrawalWalletUpdatedAt: new Date(Date.now() - 72 * 3_600_000), // hace 72h, ya destrabado
    ...overrides,
  });

  const fakeAgreement = (overrides = {}) => ({
    id: agreementId,
    clientId: userId,
    status: AgreementStatus.ACTIVE,
    startDate: new Date('2026-01-01'),
    earlyWithdrawalMaxPct: new Prisma.Decimal('20'),
    earlyExitPenaltyPct: new Prisma.Decimal('10'),
    ...overrides,
  });

  const fakeWithdrawal = (overrides = {}) => ({
    id: withdrawalId,
    userId,
    type: WithdrawalType.PARTIAL,
    status: WithdrawalStatus.PENDING_REVIEW,
    requestedAmountUsd: new Prisma.Decimal('100'),
    agreementId,
    agreementStatusAtRequest: AgreementStatus.ACTIVE,
    finalAmountUsd: new Prisma.Decimal('100'),
    penaltyUsd: new Prisma.Decimal('0'),
    destinationWalletAddress: 'Twallet',
    destinationWalletNetwork: ChainNetwork.TRON_TRC20,
    outboundTxHash: null,
    ...overrides,
  });

  beforeEach(() => {
    withdrawalRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findActiveForClient: jest.fn(),
      listForClient: jest.fn(),
      listQueueForTenant: jest.fn(),
      approve: jest.fn(),
      reject: jest.fn(),
      cancel: jest.fn(),
      markProcessing: jest.fn(),
      markCompleted: jest.fn(),
      markFailed: jest.fn(),
    };
    agreementRepo = { findActiveForClient: jest.fn(), updateStatus: jest.fn() };
    agreementService = { getPeriodCapital: jest.fn().mockResolvedValue(new Prisma.Decimal('500')) };
    ledgerService = { append: jest.fn(), createAdjustment: jest.fn() };
    userRepo = { findById: jest.fn(), findByIdForAdvisor: jest.fn() };
    orderService = { liquidateAllHoldings: jest.fn().mockResolvedValue(new Prisma.Decimal(0)) };
    verifier = { verify: jest.fn() };
    verifierRegistry = { get: jest.fn().mockReturnValue(verifier) };
    auditRecorder = { record: jest.fn().mockResolvedValue(undefined) };
    emailSender = { send: jest.fn().mockResolvedValue(undefined) };

    service = new WithdrawalService(
      withdrawalRepo,
      agreementRepo,
      agreementService,
      ledgerService,
      userRepo,
      orderService,
      verifierRegistry,
      auditRecorder,
      emailSender,
    );
  });

  describe('create — validaciones comunes', () => {
    it('lanza NotFoundException si el usuario no existe', async () => {
      userRepo.findById.mockResolvedValue(null);
      await expect(
        service.create(client as any, { type: WithdrawalType.PARTIAL }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rechaza sin wallet de retiro registrada', async () => {
      userRepo.findById.mockResolvedValue(fakeUser({ withdrawalWalletAddress: null }));
      await expect(
        service.create(client as any, { type: WithdrawalType.PARTIAL }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza si la wallet cambió hace menos de 48h', async () => {
      userRepo.findById.mockResolvedValue(
        fakeUser({ withdrawalWalletUpdatedAt: new Date(Date.now() - 3_600_000) }),
      );
      await expect(
        service.create(client as any, { type: WithdrawalType.PARTIAL }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza si ya hay un retiro activo', async () => {
      userRepo.findById.mockResolvedValue(fakeUser());
      withdrawalRepo.findActiveForClient.mockResolvedValue(fakeWithdrawal());
      await expect(
        service.create(client as any, { type: WithdrawalType.PARTIAL }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza si no hay un acuerdo de gestión activo', async () => {
      userRepo.findById.mockResolvedValue(fakeUser());
      withdrawalRepo.findActiveForClient.mockResolvedValue(null);
      agreementRepo.findActiveForClient.mockResolvedValue(null);
      await expect(
        service.create(client as any, { type: WithdrawalType.PARTIAL }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('create — PARTIAL', () => {
    beforeEach(() => {
      userRepo.findById.mockResolvedValue(fakeUser());
      withdrawalRepo.findActiveForClient.mockResolvedValue(null);
      agreementRepo.findActiveForClient.mockResolvedValue(fakeAgreement());
    });

    it('rechaza si el acuerdo no está ACTIVE', async () => {
      agreementRepo.findActiveForClient.mockResolvedValue(
        fakeAgreement({ status: AgreementStatus.FULFILLED }),
      );
      await expect(
        service.create(client as any, { type: WithdrawalType.PARTIAL, requestedAmountUsd: 50 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza si supera el earlyWithdrawalMaxPct del capital', async () => {
      // capital=500, 20% = 100 máximo
      await expect(
        service.create(client as any, { type: WithdrawalType.PARTIAL, requestedAmountUsd: 150 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rechaza si supera el saldo disponible', async () => {
      agreementService.getPeriodCapital.mockResolvedValue(new Prisma.Decimal('100000'));
      await expect(
        service.create(client as any, { type: WithdrawalType.PARTIAL, requestedAmountUsd: 5000 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('crea la solicitud, asienta WITHDRAWAL negativo y audita', async () => {
      withdrawalRepo.create.mockResolvedValue(fakeWithdrawal());
      await service.create(client as any, { type: WithdrawalType.PARTIAL, requestedAmountUsd: 80 });

      expect(withdrawalRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: WithdrawalType.PARTIAL, penaltyUsd: 0 }),
      );
      expect(ledgerService.append).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'WITHDRAWAL', refType: 'Withdrawal' }),
      );
      const amountArg = ledgerService.append.mock.calls[0][0].amount;
      expect(new Prisma.Decimal(amountArg).toString()).toBe('-80');
      expect(auditRecorder.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'WITHDRAWAL_REQUESTED' }),
      );
      expect(emailSender.send).toHaveBeenCalled();
    });
  });

  describe('create — FINAL', () => {
    beforeEach(() => {
      userRepo.findById.mockResolvedValue(fakeUser({ cashBalanceUsd: new Prisma.Decimal('1000') }));
      withdrawalRepo.findActiveForClient.mockResolvedValue(null);
    });

    it('acuerdo ACTIVE (Escenario B): NO calcula penalidad — queda "a definir" y reserva el saldo completo', async () => {
      agreementRepo.findActiveForClient.mockResolvedValue(
        fakeAgreement({ status: AgreementStatus.ACTIVE }),
      );
      withdrawalRepo.create.mockResolvedValue(
        fakeWithdrawal({ type: WithdrawalType.FINAL, penaltyUsd: null, finalAmountUsd: null }),
      );

      await service.create(client as any, { type: WithdrawalType.FINAL });

      // Se liquidan las posiciones abiertas antes de leer el saldo (§7.3, cierre
      // del pendiente con el módulo de órdenes).
      expect(orderService.liquidateAllHoldings).toHaveBeenCalledWith(userId);

      const created = withdrawalRepo.create.mock.calls[0][0];
      expect(created.penaltyUsd).toBeNull();
      expect(created.finalAmountUsd).toBeNull();

      // Un solo asiento por el saldo completo — el desglose se define en approve().
      expect(ledgerService.append).toHaveBeenCalledTimes(1);
      const amountArg = ledgerService.append.mock.calls[0][0].amount;
      expect(new Prisma.Decimal(amountArg).toString()).toBe('-1000');
    });

    it('acuerdo ACTIVE: devuelve el contacto de WhatsApp del asesor asignado', async () => {
      agreementRepo.findActiveForClient.mockResolvedValue(
        fakeAgreement({ status: AgreementStatus.ACTIVE }),
      );
      withdrawalRepo.create.mockResolvedValue(
        fakeWithdrawal({ type: WithdrawalType.FINAL, penaltyUsd: null, finalAmountUsd: null }),
      );
      // mockImplementation en vez de una cadena de mockResolvedValueOnce: no
      // depende del orden exacto de llamadas a findById (cliente vs asesor),
      // solo del id pedido — más robusto a cambios internos del service.
      const advisorRecord = {
        id: advisorId,
        fullName: 'Asesor Test',
        phoneNumber: '+5491122334455',
      };
      const clientRecord = fakeUser({ cashBalanceUsd: new Prisma.Decimal('1000'), advisorId });
      userRepo.findById.mockImplementation((id: string) =>
        Promise.resolve(id === advisorId ? advisorRecord : clientRecord),
      );

      const result: any = await service.create(client as any, { type: WithdrawalType.FINAL });

      expect(result.advisorContact).toEqual({
        fullName: 'Asesor Test',
        whatsappLink: 'https://wa.me/5491122334455',
      });
      expect(result.notice).toBeDefined();
    });

    it('acuerdo FULFILLED (Escenario C, retirar todo): sin penalidad, un solo asiento', async () => {
      agreementRepo.findActiveForClient.mockResolvedValue(
        fakeAgreement({ status: AgreementStatus.FULFILLED }),
      );
      withdrawalRepo.create.mockResolvedValue(fakeWithdrawal({ type: WithdrawalType.FINAL }));

      await service.create(client as any, { type: WithdrawalType.FINAL });

      const created = withdrawalRepo.create.mock.calls[0][0];
      expect(new Prisma.Decimal(created.penaltyUsd).toString()).toBe('0');
      expect(new Prisma.Decimal(created.finalAmountUsd).toString()).toBe('1000');
      expect(ledgerService.append).toHaveBeenCalledTimes(1);
    });

    it('rechaza si el acuerdo ya está BREACHED/RENEWED/CLOSED', async () => {
      agreementRepo.findActiveForClient.mockResolvedValue(
        fakeAgreement({ status: AgreementStatus.CLOSED }),
      );
      await expect(
        service.create(client as any, { type: WithdrawalType.FINAL }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('approve', () => {
    it('lanza NotFoundException si no existe', async () => {
      withdrawalRepo.findById.mockResolvedValue(null);
      await expect(service.approve(admin as any, withdrawalId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('un asesor no puede aprobar el retiro de un cliente no asignado', async () => {
      withdrawalRepo.findById.mockResolvedValue(fakeWithdrawal());
      userRepo.findByIdForAdvisor.mockResolvedValue(null);
      await expect(service.approve(advisor as any, withdrawalId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(withdrawalRepo.approve).not.toHaveBeenCalled();
    });

    it('FINAL con agreementStatusAtRequest ACTIVE transiciona el acuerdo a BREACHED', async () => {
      const withdrawal = fakeWithdrawal({
        type: WithdrawalType.FINAL,
        agreementStatusAtRequest: AgreementStatus.ACTIVE,
      });
      withdrawalRepo.findById.mockResolvedValue(withdrawal);
      withdrawalRepo.approve.mockResolvedValue(withdrawal);

      await service.approve(admin as any, withdrawalId);

      expect(agreementRepo.updateStatus).toHaveBeenCalledWith(
        agreementId,
        AgreementStatus.BREACHED,
      );
    });

    it('FINAL con agreementStatusAtRequest FULFILLED transiciona el acuerdo a CLOSED', async () => {
      const withdrawal = fakeWithdrawal({
        type: WithdrawalType.FINAL,
        agreementStatusAtRequest: AgreementStatus.FULFILLED,
      });
      withdrawalRepo.findById.mockResolvedValue(withdrawal);
      withdrawalRepo.approve.mockResolvedValue(withdrawal);

      await service.approve(admin as any, withdrawalId);

      expect(agreementRepo.updateStatus).toHaveBeenCalledWith(agreementId, AgreementStatus.CLOSED);
    });

    it('con penalidad "a definir" (penaltyUsd null), exige finalAmountUsd para aprobar', async () => {
      const withdrawal = fakeWithdrawal({
        type: WithdrawalType.FINAL,
        penaltyUsd: null,
        finalAmountUsd: null,
        requestedAmountUsd: new Prisma.Decimal('1000'),
      });
      withdrawalRepo.findById.mockResolvedValue(withdrawal);

      await expect(service.approve(admin as any, withdrawalId)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(withdrawalRepo.approve).not.toHaveBeenCalled();
    });

    it('con penalidad "a definir", aprueba con el finalAmountUsd acordado y deriva la penalidad', async () => {
      const withdrawal = fakeWithdrawal({
        type: WithdrawalType.FINAL,
        penaltyUsd: null,
        finalAmountUsd: null,
        requestedAmountUsd: new Prisma.Decimal('1000'),
        agreementStatusAtRequest: AgreementStatus.ACTIVE,
      });
      withdrawalRepo.findById.mockResolvedValue(withdrawal);
      withdrawalRepo.approve.mockResolvedValue({
        ...withdrawal,
        finalAmountUsd: new Prisma.Decimal('900'),
        penaltyUsd: new Prisma.Decimal('100'),
      });

      await service.approve(admin as any, withdrawalId, 900);

      expect(withdrawalRepo.approve).toHaveBeenCalledWith(
        withdrawalId,
        admin.userId,
        expect.objectContaining({
          finalAmountUsd: expect.anything(),
          penaltyUsd: expect.anything(),
        }),
      );
      const [, , negotiated] = withdrawalRepo.approve.mock.calls[0];
      expect(new Prisma.Decimal(negotiated.finalAmountUsd).toString()).toBe('900');
      expect(new Prisma.Decimal(negotiated.penaltyUsd).toString()).toBe('100');
    });

    it('rechaza un finalAmountUsd negociado por encima del monto reservado', async () => {
      const withdrawal = fakeWithdrawal({
        type: WithdrawalType.FINAL,
        penaltyUsd: null,
        finalAmountUsd: null,
        requestedAmountUsd: new Prisma.Decimal('1000'),
      });
      withdrawalRepo.findById.mockResolvedValue(withdrawal);

      await expect(service.approve(admin as any, withdrawalId, 5000)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('PARTIAL no toca el estado del acuerdo', async () => {
      const withdrawal = fakeWithdrawal({ type: WithdrawalType.PARTIAL });
      withdrawalRepo.findById.mockResolvedValue(withdrawal);
      withdrawalRepo.approve.mockResolvedValue(withdrawal);

      await service.approve(admin as any, withdrawalId);

      expect(agreementRepo.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('reject / cancel — reversión de la reserva', () => {
    it('reject revierte monto + penalidad con un ADJUSTMENT', async () => {
      const withdrawal = fakeWithdrawal({
        finalAmountUsd: new Prisma.Decimal('900'),
        penaltyUsd: new Prisma.Decimal('100'),
      });
      withdrawalRepo.findById.mockResolvedValue(withdrawal);
      withdrawalRepo.reject.mockResolvedValue(withdrawal);

      await service.reject(admin as any, withdrawalId, 'no corresponde');

      expect(ledgerService.createAdjustment).toHaveBeenCalledWith(
        expect.objectContaining({ userId, amount: expect.anything() }),
      );
      const amountArg = ledgerService.createAdjustment.mock.calls[0][0].amount;
      expect(new Prisma.Decimal(amountArg).toString()).toBe('1000'); // 900 + 100
    });

    it('cancel lanza NotFoundException si el retiro no es del cliente', async () => {
      withdrawalRepo.findById.mockResolvedValue(fakeWithdrawal({ userId: 'otro-cliente' }));
      await expect(service.cancel(client as any, withdrawalId)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('markProcessing', () => {
    it('lanza NotFoundException si no existe', async () => {
      withdrawalRepo.findById.mockResolvedValue(null);
      await expect(service.markProcessing(withdrawalId, '0'.repeat(64))).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rechaza formato de hash inválido para la red', async () => {
      withdrawalRepo.findById.mockResolvedValue(fakeWithdrawal());
      await expect(service.markProcessing(withdrawalId, 'hash-invalido')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('getOwn — reintenta verificación mientras PROCESSING', () => {
    it('marca COMPLETED cuando el verificador confirma la transferencia de salida', async () => {
      const withdrawal = fakeWithdrawal({
        status: WithdrawalStatus.PROCESSING,
        outboundTxHash: 'a'.repeat(64),
      });
      withdrawalRepo.findById.mockResolvedValue(withdrawal);
      verifier.verify.mockResolvedValue({
        success: true,
        confirmations: 25,
        rawPrimary: {},
        rawSecondary: {},
      });
      withdrawalRepo.markCompleted.mockResolvedValue({
        ...withdrawal,
        status: WithdrawalStatus.COMPLETED,
      });
      userRepo.findById.mockResolvedValue(fakeUser());

      await service.getOwn(client as any, withdrawalId);

      expect(withdrawalRepo.markCompleted).toHaveBeenCalledWith(withdrawalId);
      expect(auditRecorder.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'WITHDRAWAL_COMPLETED' }),
      );
    });

    it('marca FAILED y revierte la reserva si el verificador rechaza la transferencia', async () => {
      const withdrawal = fakeWithdrawal({
        status: WithdrawalStatus.PROCESSING,
        outboundTxHash: 'a'.repeat(64),
      });
      withdrawalRepo.findById.mockResolvedValue(withdrawal);
      verifier.verify.mockResolvedValue({
        success: false,
        confirmations: 0,
        failureReason: 'no coincide el destino',
        rawPrimary: {},
        rawSecondary: {},
      });
      withdrawalRepo.markFailed.mockResolvedValue({
        ...withdrawal,
        status: WithdrawalStatus.FAILED,
      });
      userRepo.findById.mockResolvedValue(fakeUser());

      await service.getOwn(client as any, withdrawalId);

      expect(withdrawalRepo.markFailed).toHaveBeenCalledWith(withdrawalId);
      expect(ledgerService.createAdjustment).toHaveBeenCalled();
    });
  });

  describe('listQueue — alerta de wallet cambiada en 30 días (§7.6)', () => {
    it('marca walletChangedRecentlyWarning si la wallet cambió hace menos de 30 días', async () => {
      withdrawalRepo.listQueueForTenant.mockResolvedValue([fakeWithdrawal()]);
      userRepo.findById.mockResolvedValue(
        fakeUser({ withdrawalWalletUpdatedAt: new Date(Date.now() - 5 * 86_400_000) }),
      );

      const [result] = await service.listQueueForAdmin();
      expect(result.walletChangedRecentlyWarning).toBe(true);
    });

    it('no marca la alerta si la wallet cambió hace más de 30 días', async () => {
      withdrawalRepo.listQueueForTenant.mockResolvedValue([fakeWithdrawal()]);
      userRepo.findById.mockResolvedValue(
        fakeUser({ withdrawalWalletUpdatedAt: new Date(Date.now() - 60 * 86_400_000) }),
      );

      const [result] = await service.listQueueForAdmin();
      expect(result.walletChangedRecentlyWarning).toBe(false);
    });
  });
});

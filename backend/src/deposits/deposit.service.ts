import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChainNetwork, Deposit, DepositStatus, Prisma } from '@prisma/client';
import { AUDIT_RECORDER, IAuditRecorder } from '../audit/audit.types';
import { UserRepository } from '../auth/repositories/user.repository';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { EMAIL_SENDER, IEmailSender } from '../auth/email/email-sender.interface';
import { LedgerService } from '../ledger/ledger.service';
import { LedgerEntryType } from '@prisma/client';
import { ApplyVerificationInput, DepositRepository, ListQueueFilter } from './deposit.repository';
import { CreateDepositDto } from './dto/create-deposit.dto';
import { DepositVerifierRegistry } from './verifiers/deposit-verifier.registry';

// Exportado: WithdrawalService (§7.4) valida el mismo formato de hash para la
// transferencia de salida, sin duplicar los regex.
export const TX_HASH_FORMAT: Record<ChainNetwork, RegExp> = {
  [ChainNetwork.TRON_TRC20]: /^[0-9a-fA-F]{64}$/,
  [ChainNetwork.POLYGON]: /^0x[0-9a-fA-F]{64}$/,
};

export interface DepositWithAlerts extends Deposit {
  sourceWalletChangedWarning: boolean;
  amountMismatchWarning: boolean;
}

@Injectable()
export class DepositService {
  constructor(
    private readonly depositRepo: DepositRepository,
    private readonly verifierRegistry: DepositVerifierRegistry,
    private readonly ledgerService: LedgerService,
    private readonly userRepo: UserRepository,
    private readonly config: ConfigService,
    @Inject(AUDIT_RECORDER) private readonly auditRecorder: IAuditRecorder,
    @Inject(EMAIL_SENDER) private readonly emailSender: IEmailSender,
  ) {}

  async create(actor: AuthenticatedUser, dto: CreateDepositDto): Promise<Deposit> {
    const toAddress = this.getPlatformWallet(dto.chain);
    const ttlHours = Number(this.config.get<string>('DEPOSIT_REQUEST_TTL_HOURS') ?? '24');
    return this.depositRepo.create({
      userId: actor.userId,
      chain: dto.chain,
      toAddress,
      declaredAmountToken: dto.declaredAmountToken,
      expiresAt: new Date(Date.now() + ttlHours * 60 * 60 * 1000),
    });
  }

  async getOwn(actor: AuthenticatedUser, depositId: string): Promise<Deposit> {
    const deposit = await this.getOwnedByClient(actor.userId, depositId);
    return deposit.status === DepositStatus.PENDING_CONFIRMATIONS
      ? this.runVerification(deposit)
      : deposit;
  }

  async listOwn(actor: AuthenticatedUser): Promise<Deposit[]> {
    const deposits = await this.depositRepo.listForClient(actor.userId);
    return Promise.all(
      deposits.map((d) =>
        d.status === DepositStatus.PENDING_CONFIRMATIONS ? this.runVerification(d) : d,
      ),
    );
  }

  // Sin cron (§13.2): el hash local se valida antes de tocar ninguna API externa
  // (§6.4), y la verificación se dispara una vez acá y se reintenta en cada
  // lectura posterior mientras siga PENDING_CONFIRMATIONS (getOwn/listOwn).
  async submitTxHash(
    actor: AuthenticatedUser,
    depositId: string,
    txHash: string,
  ): Promise<Deposit> {
    const deposit = await this.getOwnedByClient(actor.userId, depositId);
    if (deposit.status !== DepositStatus.PENDING_TX) {
      throw new BadRequestException(
        deposit.status === DepositStatus.EXPIRED
          ? 'La solicitud venció — creá un depósito nuevo'
          : 'Esta solicitud ya tiene un hash cargado',
      );
    }
    const format = TX_HASH_FORMAT[deposit.chain];
    if (!format.test(txHash)) {
      throw new BadRequestException(`Formato de hash inválido para ${deposit.chain}`);
    }

    const existing = await this.depositRepo.findByChainAndTxHash(deposit.chain, txHash);
    if (existing) {
      throw new ConflictException('Ese hash ya fue reclamado en otro depósito');
    }

    const updated = await this.depositRepo.applyTxHashSubmission(depositId, txHash);
    return this.runVerification(updated);
  }

  private async runVerification(deposit: Deposit): Promise<Deposit> {
    if (deposit.status !== DepositStatus.PENDING_CONFIRMATIONS || !deposit.txHash) {
      return deposit;
    }

    const verifier = this.verifierRegistry.get(deposit.chain);
    const result = await verifier.verify({
      txHash: deposit.txHash,
      toAddress: deposit.toAddress,
      declaredAmountToken: deposit.declaredAmountToken,
    });
    const snapshot = {
      primary: result.rawPrimary,
      secondary: result.rawSecondary,
    } as Prisma.InputJsonValue;

    if (!result.success) {
      const updated = await this.depositRepo.applyVerificationResult(deposit.id, {
        status: DepositStatus.FAILED,
        confirmations: result.confirmations,
        verifierSnapshot: snapshot,
        rejectionReason: result.failureReason,
      });
      await this.notifyClient(
        deposit.userId,
        'Depósito fallido en verificación',
        `No pudimos verificar tu depósito on-chain. Causa: ${result.failureReason}`,
      );
      await this.auditRecorder.record({
        action: 'DEPOSIT_VERIFICATION_FAILED',
        targetType: 'Deposit',
        targetId: deposit.id,
        metadata: { reason: result.failureReason },
      });
      return updated;
    }

    const requiredConfirmations =
      deposit.chain === ChainNetwork.TRON_TRC20
        ? Number(this.config.get<string>('DEPOSIT_MIN_CONFIRMATIONS_TRON') ?? '20')
        : 0;

    const base: Pick<ApplyVerificationInput, 'confirmations' | 'verifierSnapshot'> = {
      confirmations: result.confirmations,
      verifierSnapshot: snapshot,
    };

    if (result.confirmations < requiredConfirmations) {
      return this.depositRepo.applyVerificationResult(deposit.id, {
        ...base,
        status: DepositStatus.PENDING_CONFIRMATIONS,
      });
    }

    const updated = await this.depositRepo.applyVerificationResult(deposit.id, {
      ...base,
      status: DepositStatus.PENDING_REVIEW,
      verifiedAmountUsd: result.verifiedAmountToken,
      sourceWalletAddress: result.sourceAddress,
    });
    await this.auditRecorder.record({
      action: 'DEPOSIT_VERIFIED',
      targetType: 'Deposit',
      targetId: deposit.id,
      metadata: {
        confirmations: result.confirmations,
        verifiedAmountUsd: result.verifiedAmountToken?.toString(),
      },
    });
    return updated;
  }

  async listQueueForAdvisor(advisorId: string): Promise<DepositWithAlerts[]> {
    return this.buildQueueWithAlerts({ status: DepositStatus.PENDING_REVIEW, advisorId });
  }

  async listQueueForAdmin(): Promise<DepositWithAlerts[]> {
    return this.buildQueueWithAlerts({ status: DepositStatus.PENDING_REVIEW });
  }

  private async buildQueueWithAlerts(filter: ListQueueFilter): Promise<DepositWithAlerts[]> {
    const deposits = await this.depositRepo.listQueueForTenant(filter);
    return Promise.all(
      deposits.map(async (deposit) => {
        const lastApproved = await this.depositRepo.findLastApprovedForUser(
          deposit.userId,
          deposit.id,
        );
        const sourceWalletChangedWarning = Boolean(
          lastApproved?.sourceWalletAddress &&
          deposit.sourceWalletAddress &&
          lastApproved.sourceWalletAddress !== deposit.sourceWalletAddress,
        );
        const declared = new Prisma.Decimal(deposit.declaredAmountToken);
        const verified = deposit.verifiedAmountUsd
          ? new Prisma.Decimal(deposit.verifiedAmountUsd)
          : null;
        const amountMismatchWarning = Boolean(
          verified &&
          !declared.isZero() &&
          declared.sub(verified).abs().div(declared).greaterThan('0.01'),
        );
        return { ...deposit, sourceWalletChangedWarning, amountMismatchWarning };
      }),
    );
  }

  async approve(actor: AuthenticatedUser, depositId: string): Promise<Deposit> {
    const deposit = await this.getForReview(actor, depositId);
    const updated = await this.depositRepo.approve(depositId, actor.userId);

    const entry = await this.ledgerService.append({
      userId: deposit.userId,
      type: LedgerEntryType.DEPOSIT,
      amount: updated.verifiedAmountUsd!,
      refType: 'Deposit',
      refId: deposit.id,
    });

    await this.auditRecorder.record({
      actorUserId: actor.userId,
      action: 'DEPOSIT_APPROVED',
      targetType: 'Deposit',
      targetId: depositId,
      metadata: { amount: entry.amount.toString(), balanceAfter: entry.balanceAfter.toString() },
    });
    await this.notifyClient(
      deposit.userId,
      'Depósito aprobado',
      `Tu depósito de ${entry.amount.toString()} USD fue aprobado. Saldo disponible: ${entry.balanceAfter.toString()} USD.`,
    );
    return updated;
  }

  async reject(actor: AuthenticatedUser, depositId: string, reason: string): Promise<Deposit> {
    const deposit = await this.getForReview(actor, depositId);
    const updated = await this.depositRepo.reject(depositId, actor.userId, reason);

    await this.auditRecorder.record({
      actorUserId: actor.userId,
      action: 'DEPOSIT_REJECTED',
      targetType: 'Deposit',
      targetId: depositId,
      metadata: { reason },
    });
    await this.notifyClient(
      deposit.userId,
      'Depósito rechazado',
      `Tu depósito fue rechazado. Motivo: ${reason}`,
    );
    return updated;
  }

  private async getForReview(actor: AuthenticatedUser, depositId: string): Promise<Deposit> {
    const deposit = await this.depositRepo.findById(depositId);
    if (!deposit) {
      throw new NotFoundException('Depósito no encontrado');
    }
    if (actor.role === 'ADVISOR') {
      const client = await this.userRepo.findByIdForAdvisor(deposit.userId, actor.userId);
      if (!client) {
        throw new NotFoundException('Depósito no encontrado');
      }
    }
    return deposit;
  }

  private async getOwnedByClient(userId: string, depositId: string): Promise<Deposit> {
    const deposit = await this.depositRepo.findById(depositId);
    if (!deposit || deposit.userId !== userId) {
      throw new NotFoundException('Depósito no encontrado');
    }
    return deposit;
  }

  private getPlatformWallet(chain: ChainNetwork): string {
    const key =
      chain === ChainNetwork.TRON_TRC20 ? 'DEPOSIT_WALLET_TRON_TRC20' : 'DEPOSIT_WALLET_POLYGON';
    const wallet = this.config.get<string>(key);
    if (!wallet) {
      throw new BadRequestException(`No hay wallet de depósito configurada para ${chain}`);
    }
    return wallet;
  }

  private async notifyClient(userId: string, subject: string, text: string): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) return;
    await this.emailSender.send({
      to: user.email,
      subject: `${subject} — AVRE Capital Group`,
      text,
    });
  }
}

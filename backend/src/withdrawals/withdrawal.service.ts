import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  AgreementStatus,
  LedgerEntryType,
  ManagementAgreement,
  Prisma,
  User,
  Withdrawal,
  WithdrawalStatus,
  WithdrawalType,
} from '@prisma/client';
import { AgreementRepository } from '../agreements/agreement.repository';
import { AgreementService } from '../agreements/agreement.service';
import { AUDIT_RECORDER, IAuditRecorder } from '../audit/audit.types';
import { UserRepository } from '../auth/repositories/user.repository';
import { EMAIL_SENDER, IEmailSender } from '../auth/email/email-sender.interface';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { TX_HASH_FORMAT } from '../deposits/deposit.service';
import { DepositVerifierRegistry } from '../deposits/verifiers/deposit-verifier.registry';
import { LedgerService } from '../ledger/ledger.service';
import { OrderService } from '../orders/order.service';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { ListQueueFilter, WithdrawalRepository } from './withdrawal.repository';

const WALLET_CHANGE_LOCK_HOURS = 48; // §7.5 #1 — bloqueo duro, impide crear la solicitud.
const WALLET_CHANGE_WARNING_DAYS = 30; // §7.6 — alerta blanda, solo visual en la cola.

export interface WithdrawalWithAlerts extends Withdrawal {
  walletChangedRecentlyWarning: boolean;
}

export interface AdvisorContact {
  fullName: string;
  whatsappLink: string;
}

export interface WithdrawalWithAdvisorContact extends Withdrawal {
  advisorContact: AdvisorContact | null;
  notice?: string;
}

@Injectable()
export class WithdrawalService {
  constructor(
    private readonly withdrawalRepo: WithdrawalRepository,
    private readonly agreementRepo: AgreementRepository,
    private readonly agreementService: AgreementService,
    private readonly ledgerService: LedgerService,
    private readonly userRepo: UserRepository,
    private readonly orderService: OrderService,
    private readonly verifierRegistry: DepositVerifierRegistry,
    @Inject(AUDIT_RECORDER) private readonly auditRecorder: IAuditRecorder,
    @Inject(EMAIL_SENDER) private readonly emailSender: IEmailSender,
  ) {}

  async create(
    actor: AuthenticatedUser,
    dto: CreateWithdrawalDto,
  ): Promise<Withdrawal | WithdrawalWithAdvisorContact> {
    const user = await this.userRepo.findById(actor.userId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    this.assertWalletReady(user);

    const existingActive = await this.withdrawalRepo.findActiveForClient(actor.userId);
    if (existingActive) {
      throw new BadRequestException('Ya tenés una solicitud de retiro en curso (§7.5 #4)');
    }

    const agreement = await this.agreementRepo.findActiveForClient(actor.userId);
    if (!agreement) {
      throw new BadRequestException('No tenés un acuerdo de gestión activo');
    }

    return dto.type === WithdrawalType.PARTIAL
      ? this.createPartial(user, agreement, dto)
      : this.createFinal(user, agreement);
  }

  private async createPartial(
    user: User,
    agreement: ManagementAgreement,
    dto: CreateWithdrawalDto,
  ): Promise<Withdrawal> {
    if (agreement.status !== AgreementStatus.ACTIVE) {
      throw new BadRequestException('El retiro parcial solo aplica con el acuerdo ACTIVE (§7.1)');
    }
    if (!dto.requestedAmountUsd) {
      throw new BadRequestException('requestedAmountUsd es obligatorio para un retiro parcial');
    }

    const requested = new Prisma.Decimal(dto.requestedAmountUsd);
    const capital = await this.agreementService.getPeriodCapital(agreement);
    const maxWithdrawable = capital.mul(
      new Prisma.Decimal(agreement.earlyWithdrawalMaxPct).div(100),
    );

    if (requested.greaterThan(maxWithdrawable)) {
      throw new BadRequestException(
        `El monto supera lo permitido (${agreement.earlyWithdrawalMaxPct.toString()}% del capital = ${maxWithdrawable.toFixed(2)} USD)`,
      );
    }
    if (requested.greaterThan(user.cashBalanceUsd)) {
      throw new BadRequestException('El monto supera el saldo disponible');
    }

    const withdrawal = await this.withdrawalRepo.create({
      userId: user.id,
      type: WithdrawalType.PARTIAL,
      requestedAmountUsd: requested,
      agreementId: agreement.id,
      agreementStatusAtRequest: agreement.status,
      capitalUsd: capital,
      gainsUsd: 0,
      penaltyUsd: 0,
      finalAmountUsd: requested,
      destinationWalletAddress: user.withdrawalWalletAddress!,
      destinationWalletNetwork: user.withdrawalWalletNetwork!,
    });

    await this.ledgerService.append({
      userId: user.id,
      type: LedgerEntryType.WITHDRAWAL,
      amount: requested.negated(),
      refType: 'Withdrawal',
      refId: withdrawal.id,
    });

    await this.auditAndNotifyCreated(user, withdrawal);
    return withdrawal;
  }

  // Siempre "todo el saldo" (§7.1) — el cliente no elige el monto en un retiro
  // definitivo. Antes de leer el saldo, se liquidan todas las posiciones
  // abiertas (§7.3, §8 "Liquidación") para que cashBalanceUsd refleje de
  // verdad el saldo consolidado (capital + ganancias), no solo el efectivo
  // no invertido.
  //
  // La penalidad por salida anticipada (Escenario B) NO se calcula con un
  // porcentaje automático — esos números todavía no están definidos comercialmente.
  // En vez de inventar una cifra, la solicitud se crea con el monto reservado pero
  // penaltyUsd/finalAmountUsd en null ("a definir"), y el asesor asignado (o el
  // admin, si no tiene) se pone en contacto con el cliente para acordarlo antes
  // de aprobar. El monto final lo carga el revisor en approve() (ver ApproveWithdrawalDto).
  private async createFinal(
    user: User,
    agreement: ManagementAgreement,
  ): Promise<Withdrawal | WithdrawalWithAdvisorContact> {
    await this.orderService.liquidateAllHoldings(user.id);
    const refreshedUser = await this.userRepo.findById(user.id);
    const balance = new Prisma.Decimal(refreshedUser?.cashBalanceUsd ?? user.cashBalanceUsd);
    const capital = await this.agreementService.getPeriodCapital(agreement);
    const gains = balance.sub(capital);

    const isAnticipated = agreement.status === AgreementStatus.ACTIVE;
    if (!isAnticipated && agreement.status !== AgreementStatus.FULFILLED) {
      // Escenario C solo soporta hoy la opción "retirar todo" (ver plan —
      // renovar queda para la próxima etapa). BREACHED/RENEWED/CLOSED no
      // tienen nada pendiente de retirar.
      throw new BadRequestException('No hay nada para retirar bajo el estado actual del acuerdo');
    }

    const withdrawal = await this.withdrawalRepo.create({
      userId: user.id,
      type: WithdrawalType.FINAL,
      requestedAmountUsd: balance,
      agreementId: agreement.id,
      agreementStatusAtRequest: agreement.status,
      capitalUsd: capital,
      gainsUsd: gains,
      // Escenario C ("cumplido, retirar todo"): sin penalidad, todo definido de
      // una. Escenario B (anticipado): ambos quedan null, a definir con el asesor.
      penaltyUsd: isAnticipated ? null : 0,
      finalAmountUsd: isAnticipated ? null : balance,
      destinationWalletAddress: user.withdrawalWalletAddress!,
      destinationWalletNetwork: user.withdrawalWalletNetwork!,
    });

    // La reserva es siempre por el saldo completo — el desglose entre "lo que
    // recibe" y "la penalidad" se define recién en la aprobación (§7.3: el
    // monto queda reservado al crear la solicitud, no hace falta saber ya el
    // desglose exacto para eso).
    await this.ledgerService.append({
      userId: user.id,
      type: LedgerEntryType.WITHDRAWAL,
      amount: balance.negated(),
      refType: 'Withdrawal',
      refId: withdrawal.id,
    });

    if (!isAnticipated) {
      await this.auditAndNotifyCreated(user, withdrawal);
      return withdrawal;
    }

    // Escenario B: aviso cálido, sin cifras inventadas, y contacto directo del
    // asesor por WhatsApp para coordinar el monto.
    const advisorContact = await this.getAdvisorContact(user.id);
    const notice =
      'Este retiro cierra tu acuerdo antes del plazo comprometido, así que va a tener una ' +
      'penalidad por salida anticipada. Todavía no tenemos el monto exacto: tu asesor te va a ' +
      'escribir para verlo juntos antes de aprobar el retiro.';

    await this.auditRecorder.record({
      actorUserId: user.id,
      action: 'WITHDRAWAL_REQUESTED',
      targetType: 'Withdrawal',
      targetId: withdrawal.id,
      metadata: { type: withdrawal.type, pendingPenaltyNegotiation: true },
    });
    await this.notify(
      user.id,
      'Recibimos tu solicitud de retiro',
      `${notice}${advisorContact ? ` Podés escribirle directamente: ${advisorContact.whatsappLink}` : ''}`,
    );

    return { ...withdrawal, advisorContact, notice };
  }

  async getOwn(actor: AuthenticatedUser, id: string): Promise<Withdrawal> {
    const withdrawal = await this.getOwnedByClient(actor.userId, id);
    return withdrawal.status === WithdrawalStatus.PROCESSING
      ? this.checkCompletion(withdrawal)
      : withdrawal;
  }

  async listOwn(actor: AuthenticatedUser): Promise<Withdrawal[]> {
    const list = await this.withdrawalRepo.listForClient(actor.userId);
    return Promise.all(
      list.map((w) => (w.status === WithdrawalStatus.PROCESSING ? this.checkCompletion(w) : w)),
    );
  }

  async cancel(actor: AuthenticatedUser, id: string): Promise<Withdrawal> {
    await this.getOwnedByClient(actor.userId, id); // 404 si no existe o no es del cliente
    const updated = await this.withdrawalRepo.cancel(id);
    await this.reverseReservation(updated, actor.userId);
    await this.auditRecorder.record({
      actorUserId: actor.userId,
      action: 'WITHDRAWAL_CANCELLED',
      targetType: 'Withdrawal',
      targetId: id,
    });
    return updated;
  }

  async listQueueForAdvisor(advisorId: string): Promise<WithdrawalWithAlerts[]> {
    return this.buildQueueWithAlerts({ status: WithdrawalStatus.PENDING_REVIEW, advisorId });
  }

  async listQueueForAdmin(): Promise<WithdrawalWithAlerts[]> {
    return this.buildQueueWithAlerts({ status: WithdrawalStatus.PENDING_REVIEW });
  }

  // finalAmountUsd es obligatorio solo cuando la solicitud quedó con la
  // penalidad "a definir" (retiro definitivo anticipado, ver createFinal) — es
  // lo que el asesor acordó con el cliente por WhatsApp antes de aprobar.
  async approve(
    actor: AuthenticatedUser,
    id: string,
    negotiatedFinalAmountUsd?: number,
  ): Promise<Withdrawal> {
    const withdrawal = await this.getForReview(actor, id);

    let negotiated:
      { finalAmountUsd: Prisma.Decimal.Value; penaltyUsd: Prisma.Decimal.Value } | undefined;
    if (withdrawal.type === WithdrawalType.FINAL && withdrawal.penaltyUsd === null) {
      if (negotiatedFinalAmountUsd === undefined) {
        throw new BadRequestException(
          'Este retiro tiene la penalidad a definir — indicá finalAmountUsd (lo acordado con el cliente) para aprobar',
        );
      }
      const finalAmount = new Prisma.Decimal(negotiatedFinalAmountUsd);
      const reserved = new Prisma.Decimal(withdrawal.requestedAmountUsd);
      if (finalAmount.isNegative() || finalAmount.greaterThan(reserved)) {
        throw new BadRequestException('finalAmountUsd debe estar entre 0 y el monto reservado');
      }
      negotiated = { finalAmountUsd: finalAmount, penaltyUsd: reserved.sub(finalAmount) };
    }

    const updated = await this.withdrawalRepo.approve(id, actor.userId, negotiated);

    if (updated.type === WithdrawalType.FINAL && updated.agreementId) {
      const nextStatus =
        updated.agreementStatusAtRequest === AgreementStatus.ACTIVE
          ? AgreementStatus.BREACHED
          : AgreementStatus.CLOSED;
      await this.agreementRepo.updateStatus(updated.agreementId, nextStatus);
    }

    await this.auditRecorder.record({
      actorUserId: actor.userId,
      action: 'WITHDRAWAL_APPROVED',
      targetType: 'Withdrawal',
      targetId: id,
    });
    await this.notify(
      withdrawal.userId,
      'Retiro aprobado',
      'Tu solicitud de retiro fue aprobada. Te avisamos cuando se complete la transferencia.',
    );
    return updated;
  }

  async reject(actor: AuthenticatedUser, id: string, reason: string): Promise<Withdrawal> {
    const withdrawal = await this.getForReview(actor, id);
    const updated = await this.withdrawalRepo.reject(id, actor.userId, reason);
    await this.reverseReservation(updated, actor.userId);
    await this.auditRecorder.record({
      actorUserId: actor.userId,
      action: 'WITHDRAWAL_REJECTED',
      targetType: 'Withdrawal',
      targetId: id,
      metadata: { reason },
    });
    await this.notify(
      withdrawal.userId,
      'Retiro rechazado',
      `Tu solicitud de retiro fue rechazada. Motivo: ${reason}`,
    );
    return updated;
  }

  // Solo ADMIN (§7.4: el operador que ejecuta la transferencia manualmente).
  async markProcessing(id: string, outboundTxHash: string): Promise<Withdrawal> {
    const withdrawal = await this.withdrawalRepo.findById(id);
    if (!withdrawal) {
      throw new NotFoundException('Retiro no encontrado');
    }
    const format = TX_HASH_FORMAT[withdrawal.destinationWalletNetwork];
    if (!format.test(outboundTxHash)) {
      throw new BadRequestException(
        `Formato de hash inválido para ${withdrawal.destinationWalletNetwork}`,
      );
    }
    return this.withdrawalRepo.markProcessing(id, outboundTxHash);
  }

  // Re-verifica el hash de salida con el mismo verificador de depósitos (§7.4).
  // Una sola pasada por lectura: si todavía no propagó, esta llamada la marcaría
  // FAILED en vez de reintentar — limitación conocida, igual criterio que ya
  // aceptamos en DepositService.runVerification.
  private async checkCompletion(withdrawal: Withdrawal): Promise<Withdrawal> {
    if (!withdrawal.outboundTxHash) {
      return withdrawal;
    }
    const verifier = this.verifierRegistry.get(withdrawal.destinationWalletNetwork);
    const result = await verifier.verify({
      txHash: withdrawal.outboundTxHash,
      toAddress: withdrawal.destinationWalletAddress,
      declaredAmountToken: withdrawal.finalAmountUsd!,
    });

    if (result.success) {
      const updated = await this.withdrawalRepo.markCompleted(withdrawal.id);
      await this.auditRecorder.record({
        action: 'WITHDRAWAL_COMPLETED',
        targetType: 'Withdrawal',
        targetId: withdrawal.id,
      });
      await this.notify(
        withdrawal.userId,
        'Retiro completado',
        `Tu retiro se completó. Hash de salida: ${withdrawal.outboundTxHash}`,
      );
      return updated;
    }

    const updated = await this.withdrawalRepo.markFailed(withdrawal.id);
    await this.reverseReservation(updated, withdrawal.userId);
    await this.auditRecorder.record({
      action: 'WITHDRAWAL_FAILED',
      targetType: 'Withdrawal',
      targetId: withdrawal.id,
      metadata: { reason: result.failureReason },
    });
    await this.notify(
      withdrawal.userId,
      'Retiro fallido',
      `La transferencia de salida no pudo confirmarse. Causa: ${result.failureReason}`,
    );
    return updated;
  }

  // Revierte la reserva del ledger (monto + penalidad si la había) con un
  // ADJUSTMENT positivo (§5.1) — usado en reject/cancel/fail.
  private async reverseReservation(withdrawal: Withdrawal, actorUserId: string): Promise<void> {
    const total = new Prisma.Decimal(withdrawal.finalAmountUsd ?? 0).add(
      withdrawal.penaltyUsd ?? 0,
    );
    if (total.isZero()) return;
    await this.ledgerService.createAdjustment({
      actorUserId,
      userId: withdrawal.userId,
      amount: total,
      reason: `Reversión de reserva del retiro ${withdrawal.id}`,
    });
  }

  private async buildQueueWithAlerts(filter: ListQueueFilter): Promise<WithdrawalWithAlerts[]> {
    const withdrawals = await this.withdrawalRepo.listQueueForTenant(filter);
    return Promise.all(
      withdrawals.map(async (w) => {
        const client = await this.userRepo.findById(w.userId);
        const walletChangedRecentlyWarning = Boolean(
          client?.withdrawalWalletUpdatedAt &&
          (Date.now() - client.withdrawalWalletUpdatedAt.getTime()) / 86_400_000 <
            WALLET_CHANGE_WARNING_DAYS,
        );
        return { ...w, walletChangedRecentlyWarning };
      }),
    );
  }

  private assertWalletReady(user: User): void {
    if (!user.withdrawalWalletAddress || !user.withdrawalWalletNetwork) {
      throw new BadRequestException(
        'No tenés una wallet de retiro registrada — configurala en tu perfil primero',
      );
    }
    if (user.withdrawalWalletUpdatedAt) {
      const hoursSinceChange = (Date.now() - user.withdrawalWalletUpdatedAt.getTime()) / 3_600_000;
      if (hoursSinceChange < WALLET_CHANGE_LOCK_HOURS) {
        throw new BadRequestException(
          `Cambiaste tu wallet de retiro hace menos de ${WALLET_CHANGE_LOCK_HOURS}h — esperá antes de solicitar un retiro (§7.5 #1)`,
        );
      }
    }
  }

  private async getForReview(actor: AuthenticatedUser, id: string): Promise<Withdrawal> {
    const withdrawal = await this.withdrawalRepo.findById(id);
    if (!withdrawal) {
      throw new NotFoundException('Retiro no encontrado');
    }
    if (actor.role === 'ADVISOR') {
      const client = await this.userRepo.findByIdForAdvisor(withdrawal.userId, actor.userId);
      if (!client) {
        throw new NotFoundException('Retiro no encontrado');
      }
    }
    return withdrawal;
  }

  private async getOwnedByClient(userId: string, id: string): Promise<Withdrawal> {
    const withdrawal = await this.withdrawalRepo.findById(id);
    if (!withdrawal || withdrawal.userId !== userId) {
      throw new NotFoundException('Retiro no encontrado');
    }
    return withdrawal;
  }

  private async auditAndNotifyCreated(user: User, withdrawal: Withdrawal): Promise<void> {
    await this.auditRecorder.record({
      actorUserId: user.id,
      action: 'WITHDRAWAL_REQUESTED',
      targetType: 'Withdrawal',
      targetId: withdrawal.id,
      metadata: { type: withdrawal.type, finalAmountUsd: withdrawal.finalAmountUsd?.toString() },
    });
    await this.notify(
      user.id,
      'Solicitud de retiro recibida',
      `Recibimos tu solicitud de retiro por ${withdrawal.finalAmountUsd?.toString()} USD. Te avisamos cuando sea revisada.`,
    );
  }

  // Contacto directo del asesor asignado (o null si el cliente no tiene uno) —
  // reusa el phoneNumber ya existente en el perfil (§2.1), sin agregar un campo
  // nuevo. wa.me solo necesita el número en dígitos, sin "+".
  private async getAdvisorContact(clientId: string): Promise<AdvisorContact | null> {
    const client = await this.userRepo.findById(clientId);
    if (!client?.advisorId) return null;
    const advisor = await this.userRepo.findById(client.advisorId);
    if (!advisor?.phoneNumber) return null;
    return {
      fullName: advisor.fullName,
      whatsappLink: this.buildWhatsAppLink(advisor.phoneNumber),
    };
  }

  private buildWhatsAppLink(phoneNumber: string): string {
    return `https://wa.me/${phoneNumber.replace(/[^0-9]/g, '')}`;
  }

  private async notify(userId: string, subject: string, text: string): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) return;
    await this.emailSender.send({
      to: user.email,
      subject: `${subject} — AVRE Capital Group`,
      text,
    });
  }
}

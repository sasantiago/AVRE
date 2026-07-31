import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ManagementAgreement, Prisma } from '@prisma/client';
import { UserRepository } from '../auth/repositories/user.repository';
import { LedgerService } from '../ledger/ledger.service';
import { PACKAGE_TERMS } from './agreement.constants';
import { AgreementRepository, ListAgreementsFilter } from './agreement.repository';
import { CreateAgreementDto } from './dto/create-agreement.dto';
import { UpdateAgreementTermsDto } from './dto/update-agreement-terms.dto';

export interface AgreementProgress {
  agreement: ManagementAgreement;
  daysElapsed: number;
  daysTotal: number;
  // String (no number) a propósito: es un monto en USD, nunca se serializa como
  // float (§5.2).
  withdrawableTodayUsd: string;
}

const MS_PER_DAY = 86_400_000;

@Injectable()
export class AgreementService {
  constructor(
    private readonly agreementRepo: AgreementRepository,
    private readonly ledgerService: LedgerService,
    private readonly userRepo: UserRepository,
  ) {}

  async create(dto: CreateAgreementDto): Promise<ManagementAgreement> {
    const client = await this.userRepo.findById(dto.clientId);
    if (!client) {
      throw new BadRequestException('El cliente indicado no existe');
    }
    const existing = await this.agreementRepo.findActiveForClient(dto.clientId);
    if (existing) {
      throw new BadRequestException('El cliente ya tiene un acuerdo de gestión ACTIVE');
    }

    const defaults = PACKAGE_TERMS[dto.packageType];
    return this.agreementRepo.create({
      clientId: dto.clientId,
      packageType: dto.packageType,
      startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
      termMonths: dto.termMonths ?? defaults.termMonths,
      earlyWithdrawalMaxPct: dto.earlyWithdrawalMaxPct ?? defaults.earlyWithdrawalMaxPct,
      earlyExitPenaltyPct: dto.earlyExitPenaltyPct ?? defaults.earlyExitPenaltyPct,
    });
  }

  async updateTerms(id: string, dto: UpdateAgreementTermsDto): Promise<ManagementAgreement> {
    await this.findById(id); // 404 si no existe
    return this.agreementRepo.updateTerms(id, {
      termMonths: dto.termMonths,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      earlyWithdrawalMaxPct: dto.earlyWithdrawalMaxPct,
      earlyExitPenaltyPct: dto.earlyExitPenaltyPct,
    });
  }

  async findById(id: string): Promise<ManagementAgreement> {
    const agreement = await this.agreementRepo.findById(id);
    if (!agreement) {
      throw new NotFoundException('Acuerdo de gestión no encontrado');
    }
    return agreement;
  }

  async listForTenant(filter: ListAgreementsFilter): Promise<ManagementAgreement[]> {
    return this.agreementRepo.listForTenant(filter);
  }

  async getProgress(agreementId: string): Promise<AgreementProgress> {
    return this.buildProgress(await this.findById(agreementId));
  }

  async getOwnWithProgress(clientId: string): Promise<AgreementProgress> {
    const agreement = await this.agreementRepo.findActiveForClient(clientId);
    if (!agreement) {
      throw new NotFoundException('No hay un acuerdo de gestión activo para este cliente');
    }
    return this.buildProgress(agreement);
  }

  // Scoping de asesor (§4.2, mismo patrón que UserRepository.findByIdForAdvisor):
  // 404 si el cliente no está asignado a este asesor, nunca 403 (no delata
  // existencia de clientes ajenos).
  async getForAdvisorClient(advisorId: string, clientId: string): Promise<AgreementProgress> {
    const client = await this.userRepo.findByIdForAdvisor(clientId, advisorId);
    if (!client) {
      throw new NotFoundException('Cliente no encontrado');
    }
    return this.getOwnWithProgress(clientId);
  }

  // Capital "del período del acuerdo" (§3.3, §7.3): suma de asientos DEPOSIT
  // desde agreement.startDate — no el historial completo del cliente. Pública
  // porque WithdrawalService (§7) necesita exactamente el mismo número para
  // calcular cuánto puede retirar, sin duplicar el criterio de "desde cuándo".
  async getPeriodCapital(agreement: ManagementAgreement): Promise<Prisma.Decimal> {
    return this.ledgerService.getCapital(agreement.clientId, agreement.startDate);
  }

  private async buildProgress(agreement: ManagementAgreement): Promise<AgreementProgress> {
    const start = agreement.startDate.getTime();
    const end = agreement.endDate.getTime();
    const daysTotal = Math.max(1, Math.round((end - start) / MS_PER_DAY));
    const daysElapsed = Math.min(
      daysTotal,
      Math.max(0, Math.round((Date.now() - start) / MS_PER_DAY)),
    );

    const capital = await this.getPeriodCapital(agreement);
    const pct = new Prisma.Decimal(agreement.earlyWithdrawalMaxPct).div(100);

    return {
      agreement,
      daysElapsed,
      daysTotal,
      withdrawableTodayUsd: capital.mul(pct).toFixed(8),
    };
  }
}

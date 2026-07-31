import { Injectable } from '@nestjs/common';
import { AgreementStatus, ClientPackage, ManagementAgreement, Prisma } from '@prisma/client';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { generateId } from '../common/utils/uuid';

export interface CreateAgreementInput {
  clientId: string;
  packageType: ClientPackage;
  startDate: Date;
  termMonths: number;
  earlyWithdrawalMaxPct: Prisma.Decimal.Value;
  earlyExitPenaltyPct: Prisma.Decimal.Value;
  renewedFromId?: string;
}

export interface UpdateAgreementTermsInput {
  termMonths?: number;
  endDate?: Date;
  earlyWithdrawalMaxPct?: Prisma.Decimal.Value;
  earlyExitPenaltyPct?: Prisma.Decimal.Value;
}

export interface ListAgreementsFilter {
  clientId?: string;
  advisorId?: string;
  status?: AgreementStatus;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

@Injectable()
export class AgreementRepository {
  constructor(private readonly tenantContext: TenantContextService) {}

  async create(input: CreateAgreementInput): Promise<ManagementAgreement> {
    return this.tenantContext.getTx().managementAgreement.create({
      data: {
        id: generateId(),
        tenantId: this.tenantContext.getTenantId(),
        clientId: input.clientId,
        packageType: input.packageType,
        startDate: input.startDate,
        termMonths: input.termMonths,
        endDate: addMonths(input.startDate, input.termMonths),
        earlyWithdrawalMaxPct: input.earlyWithdrawalMaxPct,
        earlyExitPenaltyPct: input.earlyExitPenaltyPct,
        renewedFromId: input.renewedFromId,
      },
    });
  }

  async findById(id: string): Promise<ManagementAgreement | null> {
    const agreement = await this.tenantContext.getTx().managementAgreement.findUnique({
      where: { id },
    });
    return agreement ? this.applyLazyFulfillment(agreement) : null;
  }

  // A lo sumo un acuerdo ACTIVE por cliente (índice único parcial en la base,
  // ver prisma/manual-sql/001-rls-and-triggers.sql).
  async findActiveForClient(clientId: string): Promise<ManagementAgreement | null> {
    const agreement = await this.tenantContext.getTx().managementAgreement.findFirst({
      where: { clientId, status: AgreementStatus.ACTIVE },
    });
    return agreement ? this.applyLazyFulfillment(agreement) : null;
  }

  async listForTenant(filter: ListAgreementsFilter): Promise<ManagementAgreement[]> {
    return this.tenantContext.getTx().managementAgreement.findMany({
      where: {
        clientId: filter.clientId,
        status: filter.status,
        ...(filter.advisorId ? { client: { advisorId: filter.advisorId } } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateTerms(id: string, input: UpdateAgreementTermsInput): Promise<ManagementAgreement> {
    return this.tenantContext.getTx().managementAgreement.update({ where: { id }, data: input });
  }

  async updateStatus(id: string, status: AgreementStatus): Promise<ManagementAgreement> {
    return this.tenantContext
      .getTx()
      .managementAgreement.update({ where: { id }, data: { status } });
  }

  // Cierra el acuerdo anterior (RENEWED) y crea el nuevo encadenado (§3.1, §7.2
  // Escenario C). No expuesto todavía por ningún endpoint — lo usa la etapa de
  // Withdrawal cuando se implemente el flujo de renovación.
  async renew(
    previousId: string,
    input: Omit<CreateAgreementInput, 'renewedFromId'>,
  ): Promise<ManagementAgreement> {
    const tx = this.tenantContext.getTx();
    await tx.managementAgreement.update({
      where: { id: previousId },
      data: { status: AgreementStatus.RENEWED },
    });
    return this.create({ ...input, renewedFromId: previousId });
  }

  // Transición a FULFILLED request-driven (§13.2 del doc Fase 3: sin cron
  // confiable en el free tier de hosting, todo lo temporal se evalúa al leer).
  private async applyLazyFulfillment(agreement: ManagementAgreement): Promise<ManagementAgreement> {
    if (agreement.status === AgreementStatus.ACTIVE && agreement.endDate.getTime() <= Date.now()) {
      return this.tenantContext.getTx().managementAgreement.update({
        where: { id: agreement.id },
        data: { status: AgreementStatus.FULFILLED },
      });
    }
    return agreement;
  }
}

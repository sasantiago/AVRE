import { Injectable } from '@nestjs/common';
import { AgreementStatus, Prisma, Role } from '@prisma/client';
import { UserRepository } from '../auth/repositories/user.repository';
import { MetricsQueryDto } from './dto/metrics-query.dto';
import { DepositTimestamp, MetricsRepository } from './metrics.repository';

const DEFAULT_DEPOSIT_WINDOW_DAYS = 30;
const DEFAULT_AGREEMENT_WINDOW_DAYS = 90;
const MS_PER_DAY = 86_400_000;

// "Acuerdos que alcanzaron FULFILLED" (denominador de renovación) y "total de
// acuerdos cerrados" (denominador de salidas anticipadas) — no persistimos un
// timestamp de "llegó a FULFILLED" por separado, así que el status actual es
// el proxy: los tres estados de cada lista implican haber pasado por ahí
// (ver Contexto del plan de esta etapa).
const RENEWAL_DENOMINATOR_STATUSES: AgreementStatus[] = [
  AgreementStatus.FULFILLED,
  AgreementStatus.RENEWED,
  AgreementStatus.CLOSED,
];
const EARLY_EXIT_DENOMINATOR_STATUSES: AgreementStatus[] = [
  AgreementStatus.BREACHED,
  AgreementStatus.CLOSED,
  AgreementStatus.RENEWED,
];

export interface MetricsBundle {
  capitalRaisedUsd: string;
  avgTicketUsd: string;
  avgFundingFrequencyDays: string | null;
  newClientsThisMonth: number;
  renewalRatePct: string;
  earlyExitRatePct: string;
}

export interface AdvisorMetrics extends MetricsBundle {
  advisorId: string;
  advisorName: string;
}

export interface MetricsResponse {
  depositWindowDays: number;
  agreementWindowDays: number;
  tenantTotals: MetricsBundle;
  byAdvisor: AdvisorMetrics[];
}

@Injectable()
export class MetricsService {
  constructor(
    private readonly metricsRepo: MetricsRepository,
    private readonly userRepo: UserRepository,
  ) {}

  async getMetrics(query: MetricsQueryDto): Promise<MetricsResponse> {
    const depositWindowDays = query.days ?? DEFAULT_DEPOSIT_WINDOW_DAYS;
    const agreementWindowDays = query.days ?? DEFAULT_AGREEMENT_WINDOW_DAYS;
    const depositSince = new Date(Date.now() - depositWindowDays * MS_PER_DAY);
    const agreementSince = new Date(Date.now() - agreementWindowDays * MS_PER_DAY);
    const monthStart = startOfCurrentMonth();

    const tenantTotals = await this.buildBundle(depositSince, agreementSince, monthStart);

    const advisors = await this.userRepo.findAllByTenant({ role: Role.ADVISOR });
    const byAdvisor = await Promise.all(
      advisors.map(async (advisor) => ({
        advisorId: advisor.id,
        advisorName: advisor.fullName,
        ...(await this.buildBundle(depositSince, agreementSince, monthStart, advisor.id)),
      })),
    );

    return { depositWindowDays, agreementWindowDays, tenantTotals, byAdvisor };
  }

  private async buildBundle(
    depositSince: Date,
    agreementSince: Date,
    monthStart: Date,
    advisorId?: string,
  ): Promise<MetricsBundle> {
    const [
      capitalRaised,
      buyStats,
      deposits,
      renewedCount,
      renewalDenominator,
      breachedCount,
      earlyExitDenominator,
    ] = await Promise.all([
      this.metricsRepo.sumApprovedDepositsSince(depositSince, advisorId),
      this.metricsRepo.getBuyOrderStatsSince(depositSince, advisorId),
      this.metricsRepo.listApprovedDepositTimestamps(advisorId),
      this.metricsRepo.countAgreementsByStatusSince(
        [AgreementStatus.RENEWED],
        agreementSince,
        advisorId,
      ),
      this.metricsRepo.countAgreementsByStatusSince(
        RENEWAL_DENOMINATOR_STATUSES,
        agreementSince,
        advisorId,
      ),
      this.metricsRepo.countAgreementsByStatusSince(
        [AgreementStatus.BREACHED],
        agreementSince,
        advisorId,
      ),
      this.metricsRepo.countAgreementsByStatusSince(
        EARLY_EXIT_DENOMINATOR_STATUSES,
        agreementSince,
        advisorId,
      ),
    ]);

    const avgTicket =
      buyStats.count > 0 ? buyStats.totalUsd.div(buyStats.count) : new Prisma.Decimal(0);
    const avgFundingFrequencyDays = computeAvgFundingFrequencyDays(deposits);

    return {
      capitalRaisedUsd: capitalRaised.toFixed(2),
      avgTicketUsd: avgTicket.toFixed(2),
      avgFundingFrequencyDays: avgFundingFrequencyDays ? avgFundingFrequencyDays.toFixed(2) : null,
      newClientsThisMonth: computeNewClientsSince(deposits, monthStart),
      renewalRatePct: pct(renewedCount, renewalDenominator),
      earlyExitRatePct: pct(breachedCount, earlyExitDenominator),
    };
  }
}

function pct(numerator: number, denominator: number): string {
  if (denominator === 0) return '0.00';
  return ((numerator / denominator) * 100).toFixed(2);
}

function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

// "Frecuencia de fondeo por cliente" (§10): promedio de días entre depósitos
// aprobados consecutivos, por cliente — y luego promediado entre clientes (los
// que tienen menos de 2 depósitos no aportan, no hay "frecuencia" con un solo dato).
export function computeAvgFundingFrequencyDays(
  deposits: DepositTimestamp[],
): Prisma.Decimal | null {
  const byUser = new Map<string, Date[]>();
  for (const d of deposits) {
    const list = byUser.get(d.userId) ?? [];
    list.push(d.createdAt);
    byUser.set(d.userId, list);
  }

  const perClientAverages: Prisma.Decimal[] = [];
  for (const dates of byUser.values()) {
    if (dates.length < 2) continue;
    const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
    let totalGapDays = 0;
    for (let i = 1; i < sorted.length; i++) {
      totalGapDays += (sorted[i].getTime() - sorted[i - 1].getTime()) / MS_PER_DAY;
    }
    perClientAverages.push(new Prisma.Decimal(totalGapDays / (sorted.length - 1)));
  }

  if (perClientAverages.length === 0) return null;
  const total = perClientAverages.reduce((sum, avg) => sum.add(avg), new Prisma.Decimal(0));
  return total.div(perClientAverages.length);
}

// "Clientes nuevos" (§10): clientes cuyo PRIMER depósito aprobado de toda su
// historia cae dentro de la ventana (mes calendario actual, no configurable).
export function computeNewClientsSince(deposits: DepositTimestamp[], since: Date): number {
  const firstDepositByUser = new Map<string, Date>();
  for (const d of deposits) {
    const existing = firstDepositByUser.get(d.userId);
    if (!existing || d.createdAt < existing) {
      firstDepositByUser.set(d.userId, d.createdAt);
    }
  }
  let count = 0;
  for (const firstDate of firstDepositByUser.values()) {
    if (firstDate >= since) count++;
  }
  return count;
}

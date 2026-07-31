import { Prisma } from '@prisma/client';
import {
  computeAvgFundingFrequencyDays,
  computeNewClientsSince,
  MetricsService,
} from './metrics.service';

const DAY = 86_400_000;

describe('computeAvgFundingFrequencyDays', () => {
  it('devuelve null si no hay depósitos', () => {
    expect(computeAvgFundingFrequencyDays([])).toBeNull();
  });

  it('devuelve null si ningún cliente tiene 2 o más depósitos', () => {
    const result = computeAvgFundingFrequencyDays([
      { userId: 'u1', createdAt: new Date('2026-01-01') },
      { userId: 'u2', createdAt: new Date('2026-01-05') },
    ]);
    expect(result).toBeNull();
  });

  it('calcula el promedio de días entre depósitos consecutivos de un cliente', () => {
    const result = computeAvgFundingFrequencyDays([
      { userId: 'u1', createdAt: new Date(Date.UTC(2026, 0, 1)) },
      { userId: 'u1', createdAt: new Date(Date.UTC(2026, 0, 11)) }, // +10 días
      { userId: 'u1', createdAt: new Date(Date.UTC(2026, 0, 21)) }, // +10 días
    ]);
    expect(result?.toString()).toBe('10');
  });

  it('promedia entre clientes distintos (no todo el pool junto)', () => {
    const result = computeAvgFundingFrequencyDays([
      // u1: un solo gap de 10 días
      { userId: 'u1', createdAt: new Date(Date.UTC(2026, 0, 1)) },
      { userId: 'u1', createdAt: new Date(Date.UTC(2026, 0, 11)) },
      // u2: un solo gap de 20 días
      { userId: 'u2', createdAt: new Date(Date.UTC(2026, 0, 1)) },
      { userId: 'u2', createdAt: new Date(Date.UTC(2026, 0, 21)) },
    ]);
    // promedio de promedios: (10 + 20) / 2 = 15, no (10+20)/1gap=30
    expect(result?.toString()).toBe('15');
  });

  it('no depende del orden de entrada (ordena internamente)', () => {
    const result = computeAvgFundingFrequencyDays([
      { userId: 'u1', createdAt: new Date(Date.UTC(2026, 0, 11)) },
      { userId: 'u1', createdAt: new Date(Date.UTC(2026, 0, 1)) },
    ]);
    expect(result?.toString()).toBe('10');
  });
});

describe('computeNewClientsSince', () => {
  const since = new Date(Date.UTC(2026, 6, 1)); // 1 de julio

  it('cuenta un cliente cuyo PRIMER depósito cae en la ventana', () => {
    const count = computeNewClientsSince(
      [{ userId: 'u1', createdAt: new Date(Date.UTC(2026, 6, 15)) }],
      since,
    );
    expect(count).toBe(1);
  });

  it('no cuenta un cliente cuyo primer depósito fue ANTES de la ventana, aunque tenga otro depósito adentro', () => {
    const count = computeNewClientsSince(
      [
        { userId: 'u1', createdAt: new Date(Date.UTC(2026, 5, 1)) }, // primero, antes de la ventana
        { userId: 'u1', createdAt: new Date(Date.UTC(2026, 6, 15)) }, // segundo, dentro
      ],
      since,
    );
    expect(count).toBe(0);
  });

  it('cuenta exactamente en el borde de la ventana (inclusive)', () => {
    const count = computeNewClientsSince([{ userId: 'u1', createdAt: since }], since);
    expect(count).toBe(1);
  });
});

describe('MetricsService', () => {
  const advisorId = '018f0000-0000-7000-8000-000000000001';

  let metricsRepo: any;
  let userRepo: any;
  let service: MetricsService;

  beforeEach(() => {
    metricsRepo = {
      sumApprovedDepositsSince: jest.fn().mockResolvedValue(new Prisma.Decimal(0)),
      getBuyOrderStatsSince: jest
        .fn()
        .mockResolvedValue({ totalUsd: new Prisma.Decimal(0), count: 0 }),
      listApprovedDepositTimestamps: jest.fn().mockResolvedValue([]),
      countAgreementsByStatusSince: jest.fn().mockResolvedValue(0),
    };
    userRepo = { findAllByTenant: jest.fn().mockResolvedValue([]) };
    service = new MetricsService(metricsRepo, userRepo);
  });

  it('devuelve tenantTotals sin filtro de asesor', async () => {
    await service.getMetrics({});
    expect(metricsRepo.sumApprovedDepositsSince).toHaveBeenCalledWith(expect.any(Date), undefined);
  });

  it('arma byAdvisor con un registro por cada ADVISOR, scopeado a su advisorId', async () => {
    userRepo.findAllByTenant.mockResolvedValue([{ id: advisorId, fullName: 'Asesor Uno' }]);

    const result = await service.getMetrics({});

    expect(userRepo.findAllByTenant).toHaveBeenCalledWith({ role: 'ADVISOR' });
    expect(result.byAdvisor).toHaveLength(1);
    expect(result.byAdvisor[0]).toMatchObject({ advisorId, advisorName: 'Asesor Uno' });
    expect(metricsRepo.sumApprovedDepositsSince).toHaveBeenCalledWith(expect.any(Date), advisorId);
  });

  it('avgTicketUsd = totalUsd/count, o 0.00 si no hubo órdenes', async () => {
    metricsRepo.getBuyOrderStatsSince.mockResolvedValue({
      totalUsd: new Prisma.Decimal('1000'),
      count: 4,
    });
    const result = await service.getMetrics({});
    expect(result.tenantTotals.avgTicketUsd).toBe('250.00');
  });

  it('renewalRatePct y earlyExitRatePct se calculan a partir de los conteos', async () => {
    metricsRepo.countAgreementsByStatusSince.mockImplementation(async (statuses: string[]) => {
      if (statuses.includes('RENEWED') && statuses.length === 1) return 2; // numerador renovación
      if (statuses.includes('BREACHED') && statuses.length === 1) return 1; // numerador salida anticipada
      if (statuses.includes('FULFILLED')) return 4; // denominador renovación
      if (statuses.includes('CLOSED') && statuses.includes('BREACHED')) return 5; // denominador salida
      return 0;
    });

    const result = await service.getMetrics({});

    expect(result.tenantTotals.renewalRatePct).toBe('50.00'); // 2/4
    expect(result.tenantTotals.earlyExitRatePct).toBe('20.00'); // 1/5
  });

  it('renewalRatePct es 0.00 (no NaN) cuando el denominador es 0', async () => {
    const result = await service.getMetrics({});
    expect(result.tenantTotals.renewalRatePct).toBe('0.00');
  });

  it('el query param days sobrepasa las ventanas de depósito y de acuerdo a la vez', async () => {
    const before = Date.now();
    await service.getMetrics({ days: 7 });

    const depositSince = metricsRepo.sumApprovedDepositsSince.mock.calls[0][0];
    const agreementSinceCall = metricsRepo.countAgreementsByStatusSince.mock.calls[0][1];

    const expectedDepositSince = before - 7 * DAY;
    expect(Math.abs((depositSince as Date).getTime() - expectedDepositSince)).toBeLessThan(2000);
    expect(Math.abs((agreementSinceCall as Date).getTime() - expectedDepositSince)).toBeLessThan(
      2000,
    );
  });
});

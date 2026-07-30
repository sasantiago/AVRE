import { ForbiddenException } from '@nestjs/common';
import { AgreementAcceptedGuard } from './agreement-accepted.guard';

describe('AgreementAcceptedGuard', () => {
  const makeContext = (user?: Record<string, unknown>) => ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as any;

  it('rechaza si no hay usuario autenticado en el request', async () => {
    const onboardingService = { hasAcceptedActiveAgreement: jest.fn() };
    const tenantContext = { run: jest.fn() };
    const guard = new AgreementAcceptedGuard(onboardingService as any, tenantContext as any);

    await expect(guard.canActivate(makeContext(undefined))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('bloquea si el usuario no aceptó la versión vigente', async () => {
    const onboardingService = { hasAcceptedActiveAgreement: jest.fn().mockResolvedValue(false) };
    const tenantContext = { run: jest.fn((_t, work) => work()) };
    const guard = new AgreementAcceptedGuard(onboardingService as any, tenantContext as any);

    await expect(
      guard.canActivate(makeContext({ userId: 'u1', tenantId: 't1' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('permite el paso si el usuario aceptó la versión vigente', async () => {
    const onboardingService = { hasAcceptedActiveAgreement: jest.fn().mockResolvedValue(true) };
    const tenantContext = { run: jest.fn((_t, work) => work()) };
    const guard = new AgreementAcceptedGuard(onboardingService as any, tenantContext as any);

    await expect(
      guard.canActivate(makeContext({ userId: 'u1', tenantId: 't1' })),
    ).resolves.toBe(true);
    expect(tenantContext.run).toHaveBeenCalledWith('t1', expect.any(Function));
  });
});

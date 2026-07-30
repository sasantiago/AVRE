import { UnauthorizedException } from '@nestjs/common';
import { of } from 'rxjs';
import { TenantContextInterceptor } from './tenant-context.interceptor';

describe('TenantContextInterceptor', () => {
  const makeContext = (user?: Record<string, unknown>) => ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  });
  const nextHandle = { handle: () => of('handler-result') };

  it('rechaza el request si no hay tenantId en el usuario autenticado', async () => {
    const tenantContext = { run: jest.fn() };
    const interceptor = new TenantContextInterceptor(tenantContext as any);

    expect(() =>
      interceptor.intercept(makeContext({ userId: 'u1' }) as any, nextHandle as any),
    ).toThrow(UnauthorizedException);
    expect(tenantContext.run).not.toHaveBeenCalled();
  });

  it('abre el contexto de tenant con el tenantId correcto del JWT', async () => {
    const tenantContext = { run: jest.fn((tenantId, work) => work()) };
    const interceptor = new TenantContextInterceptor(tenantContext as any);

    const obs = interceptor.intercept(
      makeContext({ userId: 'u1', tenantId: 'tenant-abc' }) as any,
      nextHandle as any,
    );
    const result = await obs.toPromise();

    expect(tenantContext.run).toHaveBeenCalledWith('tenant-abc', expect.any(Function));
    expect(result).toBe('handler-result');
  });
});

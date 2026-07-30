import { AccountStatus, Role } from '@prisma/client';
import { toSafeUser, toSafeUsers } from './user.presenter';

describe('user.presenter', () => {
  const user = {
    id: 'u1',
    tenantId: 't1',
    email: 'x@e2e.test',
    passwordHash: 'super-secret-hash',
    fullName: 'X',
    role: Role.CLIENT,
    totpEnabled: false,
    agreementAcceptedVersionId: null,
    advisorId: null,
    accountStatus: AccountStatus.ACTIVE,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('toSafeUser elimina passwordHash y conserva el resto', () => {
    const safe = toSafeUser(user);
    expect(safe).not.toHaveProperty('passwordHash');
    expect(safe.id).toBe('u1');
    expect(safe.email).toBe('x@e2e.test');
  });

  it('toSafeUsers aplica la misma limpieza a una lista', () => {
    const safe = toSafeUsers([user, { ...user, id: 'u2' }]);
    expect(safe).toHaveLength(2);
    expect(safe.every((u) => !('passwordHash' in u))).toBe(true);
  });
});

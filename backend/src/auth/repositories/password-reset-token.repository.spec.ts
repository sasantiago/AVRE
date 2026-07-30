import { PasswordResetTokenRepository } from './password-reset-token.repository';

describe('PasswordResetTokenRepository', () => {
  let tx: any;
  let tenantContext: any;
  let repo: PasswordResetTokenRepository;

  beforeEach(() => {
    tx = { passwordResetToken: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() } };
    tenantContext = { getTx: jest.fn().mockReturnValue(tx) };
    repo = new PasswordResetTokenRepository(tenantContext);
  });

  it('markUsed setea usedAt', async () => {
    await repo.markUsed('token-1');
    expect(tx.passwordResetToken.update).toHaveBeenCalledWith({
      where: { id: 'token-1' },
      data: { usedAt: expect.any(Date) },
    });
  });

  it('create persiste solo el hash del token, con expiresAt', async () => {
    const expiresAt = new Date(Date.now() + 60_000);
    await repo.create({ tenantId: 't1', userId: 'u1', tokenHash: 'hash', expiresAt });

    const arg = tx.passwordResetToken.create.mock.calls[0][0];
    expect(arg.data).toMatchObject({ tenantId: 't1', userId: 'u1', tokenHash: 'hash', expiresAt });
  });
});

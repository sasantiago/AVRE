import { RefreshTokenRepository } from './refresh-token.repository';

describe('RefreshTokenRepository', () => {
  let tx: any;
  let tenantContext: any;
  let repo: RefreshTokenRepository;

  beforeEach(() => {
    tx = {
      refreshToken: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    tenantContext = { getTx: jest.fn().mockReturnValue(tx) };
    repo = new RefreshTokenRepository(tenantContext);
  });

  it('markReplaced marca revokedAt y guarda el id del reemplazo', async () => {
    await repo.markReplaced('old-id', 'new-id');
    expect(tx.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'old-id' },
      data: { revokedAt: expect.any(Date), replacedByTokenId: 'new-id' },
    });
  });

  it('revokeAllForUser solo afecta tokens todavía no revocados', async () => {
    await repo.revokeAllForUser('user-1');
    expect(tx.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('findByTokenHash busca por el hash, nunca por el valor plano', async () => {
    await repo.findByTokenHash('hash-abc');
    expect(tx.refreshToken.findFirst).toHaveBeenCalledWith({ where: { tokenHash: 'hash-abc' } });
  });
});

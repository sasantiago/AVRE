import { TotpSecretRepository } from './totp-secret.repository';

describe('TotpSecretRepository', () => {
  let tx: any;
  let tenantContext: any;
  let repo: TotpSecretRepository;

  beforeEach(() => {
    tx = { totpSecret: { findUnique: jest.fn(), upsert: jest.fn() } };
    tenantContext = { getTx: jest.fn().mockReturnValue(tx) };
    repo = new TotpSecretRepository(tenantContext);
  });

  it('upsert guarda ciphertext/iv/authTag por separado, nunca el secreto en claro', async () => {
    await repo.upsert({
      tenantId: 't1',
      userId: 'u1',
      payload: { ciphertext: 'c', iv: 'i', authTag: 'a' },
    });

    const arg = tx.totpSecret.upsert.mock.calls[0][0];
    expect(arg.where).toEqual({ userId: 'u1' });
    expect(arg.create).toMatchObject({ secretCiphertext: 'c', secretIv: 'i', secretAuthTag: 'a' });
    expect(arg.update).toEqual({ secretCiphertext: 'c', secretIv: 'i', secretAuthTag: 'a' });
  });

  it('findByUserId busca por userId (unique)', async () => {
    await repo.findByUserId('u1');
    expect(tx.totpSecret.findUnique).toHaveBeenCalledWith({ where: { userId: 'u1' } });
  });
});

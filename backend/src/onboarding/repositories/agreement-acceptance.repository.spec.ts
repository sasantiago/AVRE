import { AgreementAcceptanceRepository } from './agreement-acceptance.repository';

describe('AgreementAcceptanceRepository', () => {
  let tx: any;
  let tenantContext: any;
  let repo: AgreementAcceptanceRepository;

  beforeEach(() => {
    tx = { agreementAcceptance: { create: jest.fn() } };
    tenantContext = { getTx: jest.fn().mockReturnValue(tx) };
    repo = new AgreementAcceptanceRepository(tenantContext);
  });

  it('create persiste ip/user-agent tal cual se le pasan (capturados server-side por el caller)', async () => {
    await repo.create({
      tenantId: 't1',
      userId: 'u1',
      agreementVersionId: 'a1',
      ipAddress: '203.0.113.5',
      userAgent: 'jest-agent',
    });

    const arg = tx.agreementAcceptance.create.mock.calls[0][0];
    expect(arg.data).toMatchObject({
      tenantId: 't1',
      userId: 'u1',
      agreementVersionId: 'a1',
      ipAddress: '203.0.113.5',
      userAgent: 'jest-agent',
    });
    expect(typeof arg.data.id).toBe('string');
  });
});

import { AgreementRepository } from './agreement.repository';

describe('AgreementRepository', () => {
  let tx: any;
  let tenantContext: any;
  let repo: AgreementRepository;

  beforeEach(() => {
    tx = { discretionaryAgreement: { findFirst: jest.fn(), findUnique: jest.fn() } };
    tenantContext = { getTx: jest.fn().mockReturnValue(tx) };
    repo = new AgreementRepository(tenantContext);
  });

  it('findActive filtra isActive=true y toma la más reciente', async () => {
    await repo.findActive();
    expect(tx.discretionaryAgreement.findFirst).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { publishedAt: 'desc' },
    });
  });

  it('findById busca por id', async () => {
    await repo.findById('agreement-1');
    expect(tx.discretionaryAgreement.findUnique).toHaveBeenCalledWith({
      where: { id: 'agreement-1' },
    });
  });
});

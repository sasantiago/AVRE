import { AccountStatus, Role } from '@prisma/client';
import { UserRepository } from './user.repository';

describe('UserRepository', () => {
  let tx: any;
  let tenantContext: any;
  let repo: UserRepository;

  beforeEach(() => {
    tx = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    tenantContext = { getTx: jest.fn().mockReturnValue(tx) };
    repo = new UserRepository(tenantContext);
  });

  it('findByEmail busca por la clave compuesta tenantId_email', async () => {
    await repo.findByEmail('tenant-1', 'a@b.com');
    expect(tx.user.findUnique).toHaveBeenCalledWith({
      where: { tenantId_email: { tenantId: 'tenant-1', email: 'a@b.com' } },
    });
  });

  it('create genera un id y por defecto usa rol CLIENT', async () => {
    tx.user.create.mockResolvedValue({ id: 'new-id' });
    await repo.create({ tenantId: 't1', email: 'a@b.com', passwordHash: 'h', fullName: 'A' });

    const arg = tx.user.create.mock.calls[0][0];
    expect(typeof arg.data.id).toBe('string');
    expect(arg.data.role).toBe(Role.CLIENT);
  });

  it('create respeta un rol explícito (usado por el seed, no por register)', async () => {
    await repo.create({
      tenantId: 't1',
      email: 'admin@b.com',
      passwordHash: 'h',
      fullName: 'Admin',
      role: Role.ADMIN,
    });
    expect(tx.user.create.mock.calls[0][0].data.role).toBe(Role.ADMIN);
  });

  it('setAgreementAcceptedVersion actualiza el flag denormalizado', async () => {
    await repo.setAgreementAcceptedVersion('u1', 'agreement-v2');
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { agreementAcceptedVersionId: 'agreement-v2' },
    });
  });

  it('findAllByTenant filtra por rol cuando se pasa', async () => {
    await repo.findAllByTenant({ role: Role.ADVISOR });
    expect(tx.user.findMany).toHaveBeenCalledWith({
      where: { role: Role.ADVISOR },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('updateRole actualiza el rol del usuario', async () => {
    await repo.updateRole('u1', Role.ADVISOR);
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { role: Role.ADVISOR } });
  });

  it('updateAdvisor acepta null para desasignar', async () => {
    await repo.updateAdvisor('client-1', null);
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'client-1' },
      data: { advisorId: null },
    });
  });

  it('updateAccountStatus actualiza el estado de cuenta', async () => {
    await repo.updateAccountStatus('client-1', AccountStatus.DELINQUENT);
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'client-1' },
      data: { accountStatus: AccountStatus.DELINQUENT },
    });
  });

  it('findByAdvisor solo trae CLIENTes de ese asesor', async () => {
    await repo.findByAdvisor('adv-1');
    expect(tx.user.findMany).toHaveBeenCalledWith({
      where: { advisorId: 'adv-1', role: Role.CLIENT },
      orderBy: { createdAt: 'desc' },
    });
  });

  it('findByIdForAdvisor scopea por id + advisorId + role CLIENT', async () => {
    await repo.findByIdForAdvisor('client-1', 'adv-1');
    expect(tx.user.findFirst).toHaveBeenCalledWith({
      where: { id: 'client-1', advisorId: 'adv-1', role: Role.CLIENT },
    });
  });
});

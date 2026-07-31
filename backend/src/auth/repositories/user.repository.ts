import { Injectable } from '@nestjs/common';
import {
  AccountStatus,
  ChainNetwork,
  ClientPackage,
  ContractType,
  Role,
  User,
} from '@prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { generateId } from '../../common/utils/uuid';

export interface UpdateProfileInput {
  country?: string | null;
  phoneNumber?: string | null;
  withdrawalWalletAddress?: string | null;
  withdrawalWalletNetwork?: ChainNetwork | null;
  // Se setea junto con withdrawalWalletAddress cuando cambia — nunca de forma
  // independiente (ver ProfileService, que es el único caller que la toca).
  withdrawalWalletUpdatedAt?: Date;
  contractType?: ContractType | null;
  clientPackage?: ClientPackage | null;
  avatarUrl?: string | null;
}

export interface CreateUserInput {
  tenantId: string;
  email: string;
  passwordHash: string;
  fullName: string;
  role?: Role;
}

export interface ListUsersFilter {
  role?: Role;
}

@Injectable()
export class UserRepository {
  constructor(private readonly tenantContext: TenantContextService) {}

  async findByEmail(tenantId: string, email: string): Promise<User | null> {
    return this.tenantContext.getTx().user.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.tenantContext.getTx().user.findUnique({ where: { id } });
  }

  async create(input: CreateUserInput): Promise<User> {
    return this.tenantContext.getTx().user.create({
      data: {
        id: generateId(),
        tenantId: input.tenantId,
        email: input.email,
        passwordHash: input.passwordHash,
        fullName: input.fullName,
        role: input.role ?? Role.CLIENT,
      },
    });
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.tenantContext.getTx().user.update({ where: { id: userId }, data: { passwordHash } });
  }

  async setTotpEnabled(userId: string, enabled: boolean): Promise<void> {
    await this.tenantContext.getTx().user.update({
      where: { id: userId },
      data: { totpEnabled: enabled },
    });
  }

  async setAgreementAcceptedVersion(userId: string, agreementVersionId: string): Promise<void> {
    await this.tenantContext.getTx().user.update({
      where: { id: userId },
      data: { agreementAcceptedVersionId: agreementVersionId },
    });
  }

  async findAllByTenant(filter: ListUsersFilter = {}): Promise<User[]> {
    return this.tenantContext.getTx().user.findMany({
      where: { role: filter.role },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateRole(userId: string, role: Role): Promise<User> {
    return this.tenantContext.getTx().user.update({ where: { id: userId }, data: { role } });
  }

  async updateAdvisor(userId: string, advisorId: string | null): Promise<User> {
    return this.tenantContext.getTx().user.update({ where: { id: userId }, data: { advisorId } });
  }

  async updateAccountStatus(userId: string, accountStatus: AccountStatus): Promise<User> {
    return this.tenantContext
      .getTx()
      .user.update({ where: { id: userId }, data: { accountStatus } });
  }

  // Cartera del asesor — scoping de negocio explícito (no RLS, ver comentario en schema.prisma).
  async findByAdvisor(advisorId: string): Promise<User[]> {
    return this.tenantContext.getTx().user.findMany({
      where: { advisorId, role: Role.CLIENT },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByIdForAdvisor(id: string, advisorId: string): Promise<User | null> {
    return this.tenantContext
      .getTx()
      .user.findFirst({ where: { id, advisorId, role: Role.CLIENT } });
  }

  // Perfil ampliado (Fase 3, §2): país, teléfono, wallet de retiro, tipo de
  // contrato, paquete comercial. NUNCA acepta cashBalanceUsd — esa columna solo
  // la muta LedgerRepository.appendEntry (§5.1, §11.2 caso "cualquier rol
  // intentando escribir cashBalanceUsd directamente").
  async updateProfile(userId: string, input: UpdateProfileInput): Promise<User> {
    return this.tenantContext.getTx().user.update({ where: { id: userId }, data: input });
  }
}

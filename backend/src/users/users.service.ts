import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccountStatus, Role } from '@prisma/client';
import { AUDIT_RECORDER, IAuditRecorder } from '../audit/audit.types';
import { assertAvatarSize, assertWalletFieldsPaired } from '../profile/profile.validation';
import { hashPassword } from '../common/utils/password.util';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { UserRepository } from '../auth/repositories/user.repository';
import { AdminUpdateProfileDto } from './dto/admin-update-profile.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { SafeUser, toSafeUser, toSafeUsers } from './user.presenter';

@Injectable()
export class UsersService {
  constructor(
    private readonly userRepo: UserRepository,
    @Inject(AUDIT_RECORDER) private readonly auditRecorder: IAuditRecorder,
  ) {}

  // Única vía (fuera del seed) para crear ADMIN/ADVISOR — POST /auth/register
  // solo puede crear CLIENT.
  async createUser(actor: AuthenticatedUser, dto: CreateUserDto): Promise<SafeUser> {
    const existing = await this.userRepo.findByEmail(actor.tenantId, dto.email);
    if (existing) {
      throw new ConflictException('El email ya está registrado');
    }
    const passwordHash = await hashPassword(dto.password);
    const user = await this.userRepo.create({
      tenantId: actor.tenantId,
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      role: dto.role,
    });
    await this.auditRecorder.record({
      actorUserId: actor.userId,
      action: 'USER_CREATED_BY_ADMIN',
      targetType: 'User',
      targetId: user.id,
      metadata: { role: dto.role },
    });
    return toSafeUser(user);
  }

  async listUsers(filter: QueryUsersDto): Promise<SafeUser[]> {
    const users = await this.userRepo.findAllByTenant({ role: filter.role });
    return toSafeUsers(users);
  }

  async updateRole(actor: AuthenticatedUser, userId: string, role: Role): Promise<SafeUser> {
    const user = await this.userRepo.updateRole(userId, role);
    await this.auditRecorder.record({
      actorUserId: actor.userId,
      action: 'USER_ROLE_CHANGED',
      targetType: 'User',
      targetId: userId,
      metadata: { role },
    });
    return toSafeUser(user);
  }

  async assignAdvisor(
    actor: AuthenticatedUser,
    userId: string,
    advisorId: string | null | undefined,
  ): Promise<SafeUser> {
    const resolvedAdvisorId = advisorId ?? null;
    if (resolvedAdvisorId) {
      const advisor = await this.userRepo.findById(resolvedAdvisorId);
      if (!advisor || advisor.role !== Role.ADVISOR) {
        throw new BadRequestException('El asesor indicado no existe o no tiene rol ADVISOR');
      }
    }
    const user = await this.userRepo.updateAdvisor(userId, resolvedAdvisorId);
    await this.auditRecorder.record({
      actorUserId: actor.userId,
      action: 'USER_ADVISOR_ASSIGNED',
      targetType: 'User',
      targetId: userId,
      metadata: { advisorId: resolvedAdvisorId },
    });
    return toSafeUser(user);
  }

  async updateAccountStatus(
    actor: AuthenticatedUser,
    userId: string,
    accountStatus: AccountStatus,
  ): Promise<SafeUser> {
    const user = await this.userRepo.updateAccountStatus(userId, accountStatus);
    await this.auditRecorder.record({
      actorUserId: actor.userId,
      action: 'USER_ACCOUNT_STATUS_CHANGED',
      targetType: 'User',
      targetId: userId,
      metadata: { accountStatus },
    });
    return toSafeUser(user);
  }

  // Edición de perfil admin-only (§2.2): contractType/clientPackage/wallet de
  // retiro sobre cualquier usuario del tenant. cashBalanceUsd no está en el DTO
  // ni acá ni en ningún otro lado — solo LedgerRepository.appendEntry la muta.
  async updateProfile(
    actor: AuthenticatedUser,
    userId: string,
    dto: AdminUpdateProfileDto,
  ): Promise<SafeUser> {
    assertWalletFieldsPaired(dto);
    if (dto.avatarUrl !== undefined) {
      assertAvatarSize(dto.avatarUrl);
    }

    const current = await this.userRepo.findById(userId);
    if (!current) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const walletChanged =
      dto.withdrawalWalletAddress !== undefined &&
      dto.withdrawalWalletAddress !== current.withdrawalWalletAddress;

    const updated = await this.userRepo.updateProfile(userId, {
      country: dto.country,
      phoneNumber: dto.phoneNumber,
      avatarUrl: dto.avatarUrl,
      withdrawalWalletAddress: dto.withdrawalWalletAddress,
      withdrawalWalletNetwork: dto.withdrawalWalletNetwork,
      contractType: dto.contractType,
      clientPackage: dto.clientPackage,
      ...(walletChanged ? { withdrawalWalletUpdatedAt: new Date() } : {}),
    });

    if (walletChanged) {
      await this.auditRecorder.record({
        actorUserId: actor.userId,
        action: 'WITHDRAWAL_WALLET_CHANGED',
        targetType: 'User',
        targetId: userId,
        metadata: {
          previousAddress: current.withdrawalWalletAddress,
          newAddress: dto.withdrawalWalletAddress,
          network: dto.withdrawalWalletNetwork,
        },
      });
    }
    if (dto.contractType !== undefined && dto.contractType !== current.contractType) {
      await this.auditRecorder.record({
        actorUserId: actor.userId,
        action: 'CONTRACT_TYPE_CHANGED',
        targetType: 'User',
        targetId: userId,
        metadata: { previous: current.contractType, next: dto.contractType },
      });
    }
    if (dto.clientPackage !== undefined && dto.clientPackage !== current.clientPackage) {
      await this.auditRecorder.record({
        actorUserId: actor.userId,
        action: 'CLIENT_PACKAGE_CHANGED',
        targetType: 'User',
        targetId: userId,
        metadata: { previous: current.clientPackage, next: dto.clientPackage },
      });
    }

    return toSafeUser(updated);
  }

  async getAdvisorPortfolio(advisorId: string): Promise<SafeUser[]> {
    const clients = await this.userRepo.findByAdvisor(advisorId);
    return toSafeUsers(clients);
  }

  async getAdvisorClientDetail(advisorId: string, clientId: string): Promise<SafeUser> {
    const client = await this.userRepo.findByIdForAdvisor(clientId, advisorId);
    if (!client) {
      throw new NotFoundException('Cliente no encontrado');
    }
    return toSafeUser(client);
  }
}

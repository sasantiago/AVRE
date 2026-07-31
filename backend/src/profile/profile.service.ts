import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AUDIT_RECORDER, IAuditRecorder } from '../audit/audit.types';
import { UserRepository } from '../auth/repositories/user.repository';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { SafeUser, toSafeUser } from '../users/user.presenter';
import { UpdateOwnProfileDto } from './dto/update-own-profile.dto';
import { assertAvatarSize, assertWalletFieldsPaired } from './profile.validation';

@Injectable()
export class ProfileService {
  constructor(
    private readonly userRepo: UserRepository,
    @Inject(AUDIT_RECORDER) private readonly auditRecorder: IAuditRecorder,
  ) {}

  async getOwn(actor: AuthenticatedUser): Promise<SafeUser> {
    const user = await this.userRepo.findById(actor.userId);
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return toSafeUser(user);
  }

  async updateOwn(actor: AuthenticatedUser, dto: UpdateOwnProfileDto): Promise<SafeUser> {
    this.assertWalletFieldsAllowed(actor.role, dto);
    assertWalletFieldsPaired(dto);
    if (dto.avatarUrl !== undefined) {
      assertAvatarSize(dto.avatarUrl);
    }

    const current = await this.userRepo.findById(actor.userId);
    if (!current) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Cambio de wallet de retiro (§2.2): resetea el timestamp que la etapa de
    // retiros usa para el bloqueo antifraude de 48h, y queda en el audit log.
    const walletChanged =
      dto.withdrawalWalletAddress !== undefined &&
      dto.withdrawalWalletAddress !== current.withdrawalWalletAddress;

    const updated = await this.userRepo.updateProfile(actor.userId, {
      country: dto.country,
      phoneNumber: dto.phoneNumber,
      avatarUrl: dto.avatarUrl,
      withdrawalWalletAddress: dto.withdrawalWalletAddress,
      withdrawalWalletNetwork: dto.withdrawalWalletNetwork,
      ...(walletChanged ? { withdrawalWalletUpdatedAt: new Date() } : {}),
    });

    if (walletChanged) {
      await this.auditRecorder.record({
        actorUserId: actor.userId,
        action: 'WITHDRAWAL_WALLET_CHANGED',
        targetType: 'User',
        targetId: actor.userId,
        metadata: {
          previousAddress: current.withdrawalWalletAddress,
          newAddress: dto.withdrawalWalletAddress,
          network: dto.withdrawalWalletNetwork,
        },
      });
    }

    return toSafeUser(updated);
  }

  // Solo CLIENT tiene wallet de retiro (§2.1) — un ADVISOR (o el propio ADMIN
  // editándose a sí mismo vía este endpoint) que intente tocarla queda bloqueado.
  private assertWalletFieldsAllowed(role: string, dto: UpdateOwnProfileDto): void {
    const touchesWallet =
      dto.withdrawalWalletAddress !== undefined || dto.withdrawalWalletNetwork !== undefined;
    if (touchesWallet && role !== Role.CLIENT) {
      throw new ForbiddenException('Solo un CLIENT tiene wallet de retiro');
    }
  }
}

import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DiscretionaryAgreement } from '@prisma/client';
import { AUDIT_RECORDER, IAuditRecorder } from '../audit/audit.types';
import { UserRepository } from '../auth/repositories/user.repository';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { AgreementAcceptanceRepository } from './repositories/agreement-acceptance.repository';
import { AgreementRepository } from './repositories/agreement.repository';

export interface AcceptAgreementInput {
  userId: string;
  tenantId: string;
  ipAddress: string;
  userAgent: string;
}

@Injectable()
export class OnboardingService {
  constructor(
    private readonly agreementRepo: AgreementRepository,
    private readonly acceptanceRepo: AgreementAcceptanceRepository,
    private readonly userRepo: UserRepository,
    private readonly tenantContext: TenantContextService,
    @Inject(AUDIT_RECORDER) private readonly auditRecorder: IAuditRecorder,
  ) {}

  async getActiveAgreement(): Promise<DiscretionaryAgreement> {
    const agreement = await this.agreementRepo.findActive();
    if (!agreement) {
      throw new NotFoundException('No hay una versión activa del Acuerdo de Gestión Discrecional');
    }
    return agreement;
  }

  // Resuelve la versión activa server-side — nunca confía en un agreementVersionId
  // que pudiera venir del body del cliente.
  async acceptActiveAgreement(input: AcceptAgreementInput): Promise<void> {
    const agreement = await this.getActiveAgreement();

    if (!input.ipAddress) {
      throw new BadRequestException('No se pudo determinar la IP de origen');
    }

    await this.acceptanceRepo.create({
      tenantId: input.tenantId,
      userId: input.userId,
      agreementVersionId: agreement.id,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    await this.userRepo.setAgreementAcceptedVersion(input.userId, agreement.id);

    await this.auditRecorder.record({
      actorUserId: input.userId,
      action: 'AGREEMENT_ACCEPTED',
      targetType: 'DiscretionaryAgreement',
      targetId: agreement.id,
      metadata: { ipAddress: input.ipAddress, userAgent: input.userAgent, version: agreement.version },
    });
  }

  // Usado por AgreementAcceptedGuard: true si el usuario aceptó exactamente la
  // versión activa vigente (no solo "alguna" versión en el pasado).
  async hasAcceptedActiveAgreement(userId: string): Promise<boolean> {
    const [user, agreement] = await Promise.all([
      this.userRepo.findById(userId),
      this.agreementRepo.findActive(),
    ]);
    if (!user || !agreement) return false;
    return user.agreementAcceptedVersionId === agreement.id;
  }
}

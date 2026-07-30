import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role, User } from '@prisma/client';
import ms from 'ms';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { hashToken } from '../common/utils/crypto.util';
import { hashPassword, verifyPassword } from '../common/utils/password.util';
import { buildScopedToken, parseTenantIdFromScopedToken } from '../common/utils/scoped-token.util';
import { AUDIT_RECORDER, IAuditRecorder } from '../audit/audit.types';
import { TenantsService } from '../tenants/tenants.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import { UserRepository } from './repositories/user.repository';
import { TotpService } from './totp.service';

export interface RequestMeta {
  ip: string;
  userAgent: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface IssuedTokens extends TokenPair {
  refreshTokenRecordId: string;
}

export interface LoginResult {
  requiresTotp: boolean;
  tokens?: TokenPair;
  user?: { id: string; role: Role; tenantId: string };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly refreshTokenRepo: RefreshTokenRepository,
    private readonly tenantsService: TenantsService,
    private readonly tenantContext: TenantContextService,
    private readonly jwtService: JwtService,
    private readonly totpService: TotpService,
    @Inject(AUDIT_RECORDER) private readonly auditRecorder: IAuditRecorder,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<{ userId: string }> {
    const tenantId = await this.tenantsService.resolveDefaultTenantId();
    return this.tenantContext.run(tenantId, async () => {
      const existing = await this.userRepo.findByEmail(tenantId, dto.email);
      if (existing) {
        throw new ConflictException('El email ya está registrado');
      }
      const passwordHash = await hashPassword(dto.password);
      // Solo CLIENT — ADMIN/ADVISOR se crean por seed, no por este endpoint público.
      const user = await this.userRepo.create({
        tenantId,
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        role: Role.CLIENT,
      });
      return { userId: user.id };
    });
  }

  async login(dto: LoginDto, meta: RequestMeta): Promise<LoginResult> {
    const tenantId = await this.tenantsService.resolveDefaultTenantId();
    return this.tenantContext.run(tenantId, async () => {
      const user = await this.userRepo.findByEmail(tenantId, dto.email);
      if (!user || !(await verifyPassword(user.passwordHash, dto.password))) {
        await this.auditRecorder.record({
          action: 'LOGIN_FAILED',
          metadata: { email: dto.email, ip: meta.ip },
        });
        throw new UnauthorizedException('Credenciales inválidas');
      }

      if (user.totpEnabled) {
        if (!dto.totpCode) {
          return { requiresTotp: true };
        }
        const validTotp = await this.totpService.verifyCode(user.id, dto.totpCode);
        if (!validTotp) {
          await this.auditRecorder.record({
            actorUserId: user.id,
            action: 'LOGIN_FAILED',
            metadata: { ip: meta.ip, reason: 'totp' },
          });
          throw new UnauthorizedException('Código TOTP inválido');
        }
      }

      const tokens = await this.issueTokenPair(user);
      await this.auditRecorder.record({
        actorUserId: user.id,
        action: 'LOGIN_SUCCESS',
        metadata: { ip: meta.ip, userAgent: meta.userAgent },
      });
      return { requiresTotp: false, tokens, user: { id: user.id, role: user.role, tenantId } };
    });
  }

  async refresh(refreshTokenValue: string): Promise<TokenPair> {
    const tenantId = parseTenantIdFromScopedToken(refreshTokenValue);
    if (!tenantId) {
      throw new UnauthorizedException('Refresh token inválido');
    }

    return this.tenantContext.run(tenantId, async () => {
      const tokenHash = hashToken(refreshTokenValue);
      const record = await this.refreshTokenRepo.findByTokenHash(tokenHash);

      if (!record) {
        throw new UnauthorizedException('Refresh token inválido');
      }

      if (record.revokedAt) {
        const graceMs = Number(this.config.get<string>('REFRESH_TOKEN_REUSE_GRACE_MS') ?? 10000);
        const withinGrace =
          !!record.replacedByTokenId &&
          Date.now() - record.revokedAt.getTime() <= graceMs;

        if (!withinGrace) {
          // Reuse fuera de la ventana de gracia: posible robo del token — se revoca
          // toda la familia del usuario.
          await this.refreshTokenRepo.revokeAllForUser(record.userId);
          await this.auditRecorder.record({
            actorUserId: record.userId,
            action: 'REFRESH_TOKEN_REUSE_DETECTED',
          });
          throw new UnauthorizedException('Refresh token inválido');
        }
        // Dentro de la ventana de gracia (ej. dos pestañas refrescando casi al mismo
        // tiempo): no se trata como compromiso, se deja rotar de nuevo más abajo.
      } else if (record.expiresAt < new Date()) {
        throw new UnauthorizedException('Refresh token expirado');
      }

      const user = await this.userRepo.findById(record.userId);
      if (!user) {
        throw new UnauthorizedException('Refresh token inválido');
      }

      const tokens = await this.issueTokenPair(user);
      await this.refreshTokenRepo.markReplaced(record.id, tokens.refreshTokenRecordId);

      return tokens;
    });
  }

  async logout(refreshTokenValue: string): Promise<void> {
    const tenantId = parseTenantIdFromScopedToken(refreshTokenValue);
    if (!tenantId) return;

    await this.tenantContext.run(tenantId, async () => {
      const tokenHash = hashToken(refreshTokenValue);
      const record = await this.refreshTokenRepo.findByTokenHash(tokenHash);
      if (record) {
        await this.refreshTokenRepo.revokeAllForUser(record.userId);
      }
    });
  }

  private async issueTokenPair(user: User): Promise<IssuedTokens> {
    const accessToken = this.jwtService.sign({
      sub: user.id,
      tenantId: user.tenantId,
      role: user.role,
    });

    const refreshTokenValue = buildScopedToken(user.tenantId);
    const expiresInMs = ms(this.config.get<string>('REFRESH_TOKEN_EXPIRES_IN') ?? '7d');
    const record = await this.refreshTokenRepo.create({
      tenantId: user.tenantId,
      userId: user.id,
      tokenHash: hashToken(refreshTokenValue),
      expiresAt: new Date(Date.now() + expiresInMs),
    });

    return { accessToken, refreshToken: refreshTokenValue, refreshTokenRecordId: record.id };
  }
}

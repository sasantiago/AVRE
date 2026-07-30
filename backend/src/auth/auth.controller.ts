import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { CurrentUser, AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { AuthThrottlerGuard } from '../common/guards/auth-throttler.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import { RegisterDto } from './dto/register.dto';
import { TotpVerifyDto } from './dto/totp-verify.dto';
import { PasswordResetService } from './password-reset.service';
import { buildRefreshCookieOptions, getRefreshCookieName } from './refresh-cookie.util';
import { TotpService } from './totp.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly totpService: TotpService,
    private readonly passwordResetService: PasswordResetService,
    private readonly config: ConfigService,
  ) {}

  @Post('register')
  @UseGuards(AuthThrottlerGuard)
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthThrottlerGuard)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto, {
      ip: req.ip ?? '',
      userAgent: req.headers['user-agent'] ?? '',
    });

    if (result.requiresTotp || !result.tokens || !result.user) {
      return { requiresTotp: true };
    }

    res.cookie(
      getRefreshCookieName(this.config),
      result.tokens.refreshToken,
      buildRefreshCookieOptions(this.config),
    );

    return {
      requiresTotp: false,
      accessToken: result.tokens.accessToken,
      user: result.user,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthThrottlerGuard)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookieName = getRefreshCookieName(this.config);
    const refreshTokenValue = req.cookies?.[cookieName];
    if (!refreshTokenValue) {
      throw new UnauthorizedException('Falta refresh token');
    }

    const tokens = await this.authService.refresh(refreshTokenValue);

    res.cookie(cookieName, tokens.refreshToken, buildRefreshCookieOptions(this.config));

    return { accessToken: tokens.accessToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const cookieName = getRefreshCookieName(this.config);
    const refreshTokenValue = req.cookies?.[cookieName];
    if (refreshTokenValue) {
      await this.authService.logout(refreshTokenValue);
    }
    res.clearCookie(cookieName, { path: '/auth' });
  }

  @Post('totp/enroll')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(TenantContextInterceptor)
  async enrollTotp(@CurrentUser() user: AuthenticatedUser) {
    return this.totpService.enroll(user.tenantId, user.userId);
  }

  @Post('totp/verify')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(TenantContextInterceptor)
  async verifyTotp(@CurrentUser() user: AuthenticatedUser, @Body() dto: TotpVerifyDto) {
    await this.totpService.verifyAndEnable(user.userId, dto.code);
    return { totpEnabled: true };
  }

  @Post('password-reset/request')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthThrottlerGuard)
  async requestPasswordReset(@Body() dto: PasswordResetRequestDto) {
    await this.passwordResetService.requestReset(dto.email);
    // Mensaje idéntico exista o no el email — evita enumeración de usuarios.
    return { message: 'Si el email existe, vas a recibir instrucciones para restablecer tu contraseña.' };
  }

  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmPasswordReset(@Body() dto: PasswordResetConfirmDto) {
    await this.passwordResetService.confirmReset(dto.token, dto.newPassword);
    return { message: 'Contraseña actualizada.' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Role } from '@prisma/client';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserThrottlerGuard } from '../common/guards/user-throttler.guard';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { DepositService } from './deposit.service';
import { CreateDepositDto } from './dto/create-deposit.dto';
import { SubmitTxHashDto } from './dto/submit-tx-hash.dto';

@Controller('client/deposits')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor)
@Roles(Role.CLIENT)
export class ClientDepositsController {
  constructor(private readonly depositService: DepositService) {}

  @Post()
  async create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateDepositDto) {
    return this.depositService.create(actor, dto);
  }

  @Get()
  async list(@CurrentUser() actor: AuthenticatedUser) {
    return this.depositService.listOwn(actor);
  }

  @Get(':id')
  async detail(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.depositService.getOwn(actor, id);
  }

  // Rate limit propio (§6.4: 10 intentos por usuario por hora) — no comparte
  // configuración con el throttle de auth.
  @Patch(':id/tx-hash')
  @UseGuards(UserThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  async submitTxHash(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SubmitTxHashDto,
  ) {
    return this.depositService.submitTxHash(actor, id, dto.txHash);
  }
}

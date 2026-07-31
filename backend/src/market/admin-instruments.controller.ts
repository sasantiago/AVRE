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
import { Role } from '@prisma/client';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { CreateInstrumentDto } from './dto/create-instrument.dto';
import { UpdateInstrumentStatusDto } from './dto/update-instrument-status.dto';
import { MarketService } from './market.service';

// Gestión del catálogo de mercado (§9.2): el admin opera sobre TenantInstrument,
// nunca sobre Instrument directamente — MarketService hace find-or-create sobre
// el catálogo global por symbol de forma transparente.
@Controller('admin/instruments')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor)
@Roles(Role.ADMIN)
export class AdminInstrumentsController {
  constructor(private readonly marketService: MarketService) {}

  @Post()
  async enable(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateInstrumentDto) {
    return this.marketService.enableInstrument(actor, dto);
  }

  @Get()
  async list() {
    return this.marketService.listForAdmin();
  }

  // Baja lógica (§9.2) — nunca borrado físico.
  @Patch(':id')
  async setActive(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateInstrumentStatusDto,
  ) {
    return this.marketService.setActive(actor, id, dto.isActive);
  }
}

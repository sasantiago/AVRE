import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { AgreementService } from './agreement.service';
import { CreateAgreementDto } from './dto/create-agreement.dto';
import { QueryAgreementsDto } from './dto/query-agreements.dto';
import { UpdateAgreementTermsDto } from './dto/update-agreement-terms.dto';

// Gestión de acuerdos (§4.3): alta, edición de términos, listado sin scoping
// (ve todos los clientes/asesores del tenant).
@Controller('admin/agreements')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor)
@Roles(Role.ADMIN)
export class AdminAgreementsController {
  constructor(private readonly agreementService: AgreementService) {}

  @Post()
  async create(@Body() dto: CreateAgreementDto) {
    return this.agreementService.create(dto);
  }

  @Get()
  async list(@Query() query: QueryAgreementsDto) {
    return this.agreementService.listForTenant(query);
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    return this.agreementService.getProgress(id);
  }

  @Patch(':id')
  async updateTerms(@Param('id') id: string, @Body() dto: UpdateAgreementTermsDto) {
    return this.agreementService.updateTerms(id, dto);
  }
}

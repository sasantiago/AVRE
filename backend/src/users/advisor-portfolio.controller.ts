import { Controller, Get, Param, UseGuards, UseInterceptors } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { UsersService } from './users.service';

// Cartera del asesor logueado — sin acceso a clientes de otros asesores
// (scoping por advisorId, ver comentario en schema.prisma y users.service.ts).
@Controller('advisor/clients')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor)
@Roles(Role.ADVISOR)
export class AdvisorPortfolioController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async myClients(@CurrentUser() advisor: AuthenticatedUser) {
    return this.usersService.getAdvisorPortfolio(advisor.userId);
  }

  @Get(':id')
  async clientDetail(@CurrentUser() advisor: AuthenticatedUser, @Param('id') id: string) {
    return this.usersService.getAdvisorClientDetail(advisor.userId, id);
  }
}

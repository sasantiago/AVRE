import { Body, Controller, Get, Patch, UseGuards, UseInterceptors } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuthenticatedUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { TenantContextInterceptor } from '../common/interceptors/tenant-context.interceptor';
import { UpdateOwnProfileDto } from './dto/update-own-profile.dto';
import { ProfileService } from './profile.service';

// Autoservicio de perfil (§2, §2.2): cada rol ve y edita su propia fila. La
// edición de perfil de otro usuario (contractType/clientPackage incluidos) es
// admin-only y vive en AdminUsersController (backend/src/users/).
@Controller('profile')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(TenantContextInterceptor)
@Roles(Role.CLIENT, Role.ADVISOR, Role.ADMIN)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('me')
  async getOwn(@CurrentUser() actor: AuthenticatedUser) {
    return this.profileService.getOwn(actor);
  }

  @Patch('me')
  async updateOwn(@CurrentUser() actor: AuthenticatedUser, @Body() dto: UpdateOwnProfileDto) {
    return this.profileService.updateOwn(actor, dto);
  }
}

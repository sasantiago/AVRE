import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AdminUsersController } from './admin-users.controller';
import { AdvisorPortfolioController } from './advisor-portfolio.controller';
import { UsersService } from './users.service';

@Module({
  imports: [AuditModule, AuthModule],
  controllers: [AdminUsersController, AdvisorPortfolioController],
  providers: [UsersService],
})
export class UsersModule {}

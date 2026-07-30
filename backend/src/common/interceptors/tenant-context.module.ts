import { Global, Module } from '@nestjs/common';
import { TenantContextService } from '../tenant/tenant-context.service';
import { TenantContextInterceptor } from './tenant-context.interceptor';

@Global()
@Module({
  providers: [TenantContextService, TenantContextInterceptor],
  exports: [TenantContextService, TenantContextInterceptor],
})
export class TenantContextInterceptorModule {}

import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Cliente Prisma conectado como avre_app (DATABASE_URL) — sin BYPASSRLS.
// Nunca se usa MIGRATE_DATABASE_URL/avre_migrator en runtime.
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

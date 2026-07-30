import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantClsStore } from './tenant-cls.types';

// Pieza central del aislamiento multi-tenant (ver docs/adr/0001-rls-tenant-context.md).
//
// `run()` abre una única transacción Prisma para todo el trabajo que reciba, setea
// app.tenant_id vía set_config (parametrizado, no interpolación de string) para que las
// policies RLS de Postgres filtren automáticamente, y guarda la transacción activa en el
// store CLS para que los repositorios la usen vía getTx() en vez del PrismaClient global.
//
// Trade-off conocido: mantiene una transacción/conexión abierta durante todo el work()
// que se le pase (para requests HTTP, todo el ciclo del handler). Aceptable para el
// volumen esperado en estas fases; si el pool de conexiones se vuelve un cuello de
// botella, evaluar PgBouncer (ya previsto en la sección 9 del doc de requerimientos).
@Injectable()
export class TenantContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService<TenantClsStore>,
  ) {}

  async run<T>(tenantId: string, work: () => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.tenant_id', $1, true)`, tenantId);
      this.cls.set('tenantId', tenantId);
      this.cls.set('tx', tx);
      return work();
    });
  }

  getTx(): Prisma.TransactionClient {
    const tx = this.cls.get('tx');
    if (!tx) {
      throw new Error(
        'No hay contexto de tenant activo: falta TenantContextInterceptor o TenantContextService.run().',
      );
    }
    return tx;
  }

  getTenantId(): string {
    const tenantId = this.cls.get('tenantId');
    if (!tenantId) {
      throw new Error('No hay tenantId en el contexto CLS.');
    }
    return tenantId;
  }
}

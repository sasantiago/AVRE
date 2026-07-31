import { Injectable } from '@nestjs/common';
import { ContractType, Instrument, TenantInstrument } from '@prisma/client';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { generateId } from '../common/utils/uuid';

export interface CreateInstrumentInput {
  symbol: string;
  name: string;
  assetClass: ContractType;
  exchange?: string;
}

export type TenantInstrumentWithInstrument = TenantInstrument & { instrument: Instrument };

@Injectable()
export class InstrumentRepository {
  constructor(private readonly tenantContext: TenantContextService) {}

  // Instrument es catálogo GLOBAL (§9.1) — find-or-create por symbol evita
  // duplicar el registro entre tenants distintos.
  async findOrCreateBySymbol(input: CreateInstrumentInput): Promise<Instrument> {
    const tx = this.tenantContext.getTx();
    const existing = await tx.instrument.findUnique({ where: { symbol: input.symbol } });
    if (existing) return existing;
    return tx.instrument.create({
      data: {
        id: generateId(),
        symbol: input.symbol,
        name: input.name,
        assetClass: input.assetClass,
        exchange: input.exchange,
      },
    });
  }

  async findTenantInstrumentById(id: string): Promise<TenantInstrumentWithInstrument | null> {
    return this.tenantContext.getTx().tenantInstrument.findUnique({
      where: { id },
      include: { instrument: true },
    });
  }

  async findActiveBySymbol(symbol: string): Promise<TenantInstrumentWithInstrument | null> {
    return this.tenantContext.getTx().tenantInstrument.findFirst({
      where: { isActive: true, instrument: { symbol } },
      include: { instrument: true },
    });
  }

  // Crea el TenantInstrument si no existe, o reactiva/desactiva el que ya
  // había (§9.2: la baja siempre es lógica, nunca se borra la fila).
  async upsertTenantInstrument(
    instrumentId: string,
    isActive = true,
  ): Promise<TenantInstrumentWithInstrument> {
    const tx = this.tenantContext.getTx();
    const tenantId = this.tenantContext.getTenantId();
    const existing = await tx.tenantInstrument.findUnique({
      where: { tenantId_instrumentId: { tenantId, instrumentId } },
    });
    if (existing) {
      return tx.tenantInstrument.update({
        where: { id: existing.id },
        data: { isActive },
        include: { instrument: true },
      });
    }
    return tx.tenantInstrument.create({
      data: { id: generateId(), tenantId, instrumentId, isActive },
      include: { instrument: true },
    });
  }

  async setActive(
    tenantInstrumentId: string,
    isActive: boolean,
  ): Promise<TenantInstrumentWithInstrument> {
    return this.tenantContext.getTx().tenantInstrument.update({
      where: { id: tenantInstrumentId },
      data: { isActive },
      include: { instrument: true },
    });
  }

  async listForTenant(
    filter: { isActive?: boolean } = {},
  ): Promise<TenantInstrumentWithInstrument[]> {
    return this.tenantContext.getTx().tenantInstrument.findMany({
      where: { isActive: filter.isActive },
      include: { instrument: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}

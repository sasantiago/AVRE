import { Injectable } from '@nestjs/common';
import { Holding, Instrument, Prisma } from '@prisma/client';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { generateId } from '../common/utils/uuid';

export type HoldingWithInstrument = Holding & { instrument: Instrument };

@Injectable()
export class HoldingRepository {
  constructor(private readonly tenantContext: TenantContextService) {}

  async findAllForUser(userId: string): Promise<HoldingWithInstrument[]> {
    return this.tenantContext.getTx().holding.findMany({
      where: { userId },
      include: { instrument: true },
    });
  }

  async findOne(userId: string, instrumentId: string): Promise<Holding | null> {
    const tenantId = this.tenantContext.getTenantId();
    return this.tenantContext.getTx().holding.findUnique({
      where: { tenantId_userId_instrumentId: { tenantId, userId, instrumentId } },
    });
  }

  // Promedio ponderado (§8): newAvgCost = (oldQty*oldAvgCost + qty*price) / (oldQty+qty).
  async upsertBuy(
    userId: string,
    instrumentId: string,
    quantity: Prisma.Decimal,
    price: Prisma.Decimal,
  ): Promise<Holding> {
    const tx = this.tenantContext.getTx();
    const tenantId = this.tenantContext.getTenantId();
    const existing = await this.findOne(userId, instrumentId);

    if (!existing) {
      return tx.holding.create({
        data: { id: generateId(), tenantId, userId, instrumentId, quantity, avgCostUsd: price },
      });
    }

    const newQuantity = existing.quantity.add(quantity);
    const newAvgCost = existing.quantity
      .mul(existing.avgCostUsd)
      .add(quantity.mul(price))
      .div(newQuantity);

    return tx.holding.update({
      where: { id: existing.id },
      data: { quantity: newQuantity, avgCostUsd: newAvgCost },
    });
  }

  // Usado al liquidar por completo (retiro definitivo, §7.3) — la posición
  // queda en 0, no tiene sentido mantener la fila.
  async deleteForUser(userId: string, instrumentId: string): Promise<void> {
    const tenantId = this.tenantContext.getTenantId();
    await this.tenantContext.getTx().holding.delete({
      where: { tenantId_userId_instrumentId: { tenantId, userId, instrumentId } },
    });
  }
}

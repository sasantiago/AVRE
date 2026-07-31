import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContractType, LedgerEntryType, Order, OrderSide, Prisma } from '@prisma/client';
import { AUDIT_RECORDER, IAuditRecorder } from '../audit/audit.types';
import { UserRepository } from '../auth/repositories/user.repository';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { generateId } from '../common/utils/uuid';
import { InstrumentRepository } from '../market/instrument.repository';
import { MarketDataService } from '../market/market-data.service';
import { isMarketOpen } from '../market/market-hours.util';
import { LedgerService } from '../ledger/ledger.service';
import { BuyOrderDto } from './dto/buy-order.dto';
import { HoldingRepository, HoldingWithInstrument } from './holding.repository';
import { OrderRepository } from './order.repository';

// Tolerancia de precio del §8 — valor exacto del spec, no una cifra inventada.
const PRICE_TOLERANCE_PCT = new Prisma.Decimal('0.005');

export interface PortfolioPosition {
  instrumentSymbol: string;
  instrumentName: string;
  quantity: string;
  avgCostUsd: string;
  currentPrice: string | null;
  marketValueUsd: string | null;
  returnPct: string | null;
}

export interface Portfolio {
  cashBalanceUsd: string;
  positions: PortfolioPosition[];
  totalValueUsd: string;
}

@Injectable()
export class OrderService {
  constructor(
    private readonly orderRepo: OrderRepository,
    private readonly holdingRepo: HoldingRepository,
    private readonly instrumentRepo: InstrumentRepository,
    private readonly marketDataService: MarketDataService,
    private readonly ledgerService: LedgerService,
    private readonly userRepo: UserRepository,
    @Inject(AUDIT_RECORDER) private readonly auditRecorder: IAuditRecorder,
  ) {}

  // No requiere aprobación de asesor (§8) — a diferencia de depósitos/retiros.
  async buy(actor: AuthenticatedUser, dto: BuyOrderDto): Promise<Order> {
    const tenantInstrument = await this.instrumentRepo.findTenantInstrumentById(
      dto.tenantInstrumentId,
    );
    if (!tenantInstrument || !tenantInstrument.isActive) {
      throw new BadRequestException('Instrumento no habilitado para tu tenant');
    }
    const { instrument } = tenantInstrument;

    if (!isMarketOpen(instrument.assetClass)) {
      throw new BadRequestException(`Fuera de horario de mercado para ${instrument.symbol}`);
    }

    const quote = await this.fetchQuoteOrFail(instrument.symbol, instrument.assetClass);
    const quoted = new Prisma.Decimal(dto.quotedPrice);
    const diffPct = quote.price.sub(quoted).abs().div(quoted);
    if (diffPct.greaterThan(PRICE_TOLERANCE_PCT)) {
      throw new ConflictException({
        message:
          'El precio cambió más de un 0.5% desde que lo viste — confirmá de nuevo con el precio actualizado',
        newPrice: quote.price.toString(),
      });
    }

    const amountUsd = new Prisma.Decimal(dto.amountUsd);
    const quantity = amountUsd.div(quote.price);
    const orderId = generateId();

    // El asiento va primero: si el saldo no alcanza, LedgerRepository tira
    // ConflictException y no se crea ni la orden ni el holding (§5.3).
    await this.ledgerService.append({
      userId: actor.userId,
      type: LedgerEntryType.BUY,
      amount: amountUsd.negated(),
      refType: 'Order',
      refId: orderId,
    });

    const order = await this.orderRepo.create({
      id: orderId,
      userId: actor.userId,
      instrumentId: instrument.id,
      side: OrderSide.BUY,
      quantity,
      executionPrice: quote.price,
      totalUsd: amountUsd,
    });

    await this.holdingRepo.upsertBuy(actor.userId, instrument.id, quantity, quote.price);

    await this.auditRecorder.record({
      actorUserId: actor.userId,
      action: 'ORDER_EXECUTED',
      targetType: 'Order',
      targetId: order.id,
      metadata: {
        symbol: instrument.symbol,
        quantity: quantity.toString(),
        amountUsd: amountUsd.toString(),
      },
    });

    return order;
  }

  async listForClient(userId: string): Promise<Order[]> {
    return this.orderRepo.listForUser(userId);
  }

  // Sin FINNHUB_API_KEY (o si Finnhub no responde), la compra no debe reventar
  // con un 500 crudo — se traduce a un 400 con motivo claro, mismo criterio que
  // el resto de las integraciones externas de esta fase (TronGrid/TronScan/etc).
  private async fetchQuoteOrFail(symbol: string, assetClass: ContractType) {
    try {
      return await this.marketDataService.getQuote(symbol, assetClass);
    } catch (err) {
      throw new BadRequestException(
        `No se pudo obtener una cotización para comprar ${symbol}: ${(err as Error).message}`,
      );
    }
  }

  async getPortfolio(userId: string): Promise<Portfolio> {
    const [holdings, user] = await Promise.all([
      this.holdingRepo.findAllForUser(userId),
      this.userRepo.findById(userId),
    ]);
    const cashBalanceUsd = new Prisma.Decimal(user?.cashBalanceUsd ?? 0);

    const positions = await Promise.all(holdings.map((h) => this.buildPosition(h)));
    const positionsValue = positions.reduce(
      (sum, p) => (p.marketValueUsd ? sum.add(p.marketValueUsd) : sum),
      new Prisma.Decimal(0),
    );

    return {
      cashBalanceUsd: cashBalanceUsd.toString(),
      positions,
      totalValueUsd: cashBalanceUsd.add(positionsValue).toString(),
    };
  }

  // Scoping de asesor (§4.2, mismo patrón que en agreements/deposits/withdrawals):
  // 404 si el cliente no está asignado a este asesor.
  async getPortfolioForAdvisorClient(advisorId: string, clientId: string): Promise<Portfolio> {
    const client = await this.userRepo.findByIdForAdvisor(clientId, advisorId);
    if (!client) {
      throw new NotFoundException('Cliente no encontrado');
    }
    return this.getPortfolio(clientId);
  }

  async getPortfolioForAdmin(clientId: string): Promise<Portfolio> {
    const client = await this.userRepo.findById(clientId);
    if (!client) {
      throw new NotFoundException('Cliente no encontrado');
    }
    return this.getPortfolio(clientId);
  }

  private async buildPosition(holding: HoldingWithInstrument): Promise<PortfolioPosition> {
    try {
      const quote = await this.marketDataService.getQuote(
        holding.instrument.symbol,
        holding.instrument.assetClass,
      );
      const marketValue = holding.quantity.mul(quote.price);
      const costBasis = holding.quantity.mul(holding.avgCostUsd);
      const returnPct = costBasis.isZero()
        ? new Prisma.Decimal(0)
        : marketValue.sub(costBasis).div(costBasis).mul(100);
      return {
        instrumentSymbol: holding.instrument.symbol,
        instrumentName: holding.instrument.name,
        quantity: holding.quantity.toString(),
        avgCostUsd: holding.avgCostUsd.toString(),
        currentPrice: quote.price.toString(),
        marketValueUsd: marketValue.toString(),
        returnPct: returnPct.toString(),
      };
    } catch {
      // Sin cotización disponible (ej. sin FINNHUB_API_KEY) — se muestra la
      // posición igual, sin valor de mercado ni rendimiento.
      return {
        instrumentSymbol: holding.instrument.symbol,
        instrumentName: holding.instrument.name,
        quantity: holding.quantity.toString(),
        avgCostUsd: holding.avgCostUsd.toString(),
        currentPrice: null,
        marketValueUsd: null,
        returnPct: null,
      };
    }
  }

  // Venta total de todas las posiciones del cliente — disparada automáticamente
  // al confirmar un retiro definitivo (§7.3, §8 "Liquidación"). Devuelve el
  // producido total, que WithdrawalService suma al saldo antes de calcular el
  // monto final.
  async liquidateAllHoldings(userId: string): Promise<Prisma.Decimal> {
    const holdings = await this.holdingRepo.findAllForUser(userId);
    let total = new Prisma.Decimal(0);

    for (const holding of holdings) {
      const quote = await this.marketDataService.getQuote(
        holding.instrument.symbol,
        holding.instrument.assetClass,
      );
      const proceeds = holding.quantity.mul(quote.price);
      const orderId = generateId();

      await this.ledgerService.append({
        userId,
        type: LedgerEntryType.SELL,
        amount: proceeds,
        refType: 'Order',
        refId: orderId,
      });
      await this.orderRepo.create({
        id: orderId,
        userId,
        instrumentId: holding.instrumentId,
        side: OrderSide.SELL,
        quantity: holding.quantity,
        executionPrice: quote.price,
        totalUsd: proceeds,
      });
      await this.holdingRepo.deleteForUser(userId, holding.instrumentId);

      total = total.add(proceeds);
    }

    if (holdings.length > 0) {
      await this.auditRecorder.record({
        actorUserId: userId,
        action: 'HOLDINGS_LIQUIDATED',
        targetType: 'User',
        targetId: userId,
        metadata: { count: holdings.length, totalUsd: total.toString() },
      });
    }

    return total;
  }
}

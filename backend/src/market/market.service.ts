import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AUDIT_RECORDER, IAuditRecorder } from '../audit/audit.types';
import { AuthenticatedUser } from '../common/decorators/current-user.decorator';
import { CreateInstrumentDto } from './dto/create-instrument.dto';
import { InstrumentRepository, TenantInstrumentWithInstrument } from './instrument.repository';
import { MarketDataService } from './market-data.service';

export interface TenantInstrumentWithQuote extends TenantInstrumentWithInstrument {
  quote: { price: string; asOf: Date; changePct: number | null } | null;
  quoteError: string | null;
}

@Injectable()
export class MarketService {
  constructor(
    private readonly instrumentRepo: InstrumentRepository,
    private readonly marketDataService: MarketDataService,
    @Inject(AUDIT_RECORDER) private readonly auditRecorder: IAuditRecorder,
  ) {}

  async enableInstrument(
    actor: AuthenticatedUser,
    dto: CreateInstrumentDto,
  ): Promise<TenantInstrumentWithInstrument> {
    const instrument = await this.instrumentRepo.findOrCreateBySymbol(dto);
    const tenantInstrument = await this.instrumentRepo.upsertTenantInstrument(instrument.id, true);
    await this.auditRecorder.record({
      actorUserId: actor.userId,
      action: 'INSTRUMENT_ENABLED',
      targetType: 'TenantInstrument',
      targetId: tenantInstrument.id,
      metadata: { symbol: instrument.symbol },
    });
    return tenantInstrument;
  }

  async setActive(
    actor: AuthenticatedUser,
    tenantInstrumentId: string,
    isActive: boolean,
  ): Promise<TenantInstrumentWithInstrument> {
    const updated = await this.instrumentRepo.setActive(tenantInstrumentId, isActive);
    await this.auditRecorder.record({
      actorUserId: actor.userId,
      action: isActive ? 'INSTRUMENT_ENABLED' : 'INSTRUMENT_DISABLED',
      targetType: 'TenantInstrument',
      targetId: updated.id,
      metadata: { symbol: updated.instrument.symbol },
    });
    return updated;
  }

  async listForAdmin(): Promise<TenantInstrumentWithInstrument[]> {
    return this.instrumentRepo.listForTenant();
  }

  // Catálogo activo del tenant + cotización en vivo (§4.1: "catálogo de
  // instrumentos habilitados para su tenant, con cotización"). Si una
  // cotización puntual falla (ej. sin FINNHUB_API_KEY), no rompe el listado
  // completo — se informa por instrumento.
  async listForClient(): Promise<TenantInstrumentWithQuote[]> {
    const enabled = await this.instrumentRepo.listForTenant({ isActive: true });
    return Promise.all(enabled.map((ti) => this.attachQuote(ti)));
  }

  async getQuoteForClient(symbol: string): Promise<TenantInstrumentWithQuote> {
    const tenantInstrument = await this.instrumentRepo.findActiveBySymbol(symbol);
    if (!tenantInstrument) {
      throw new NotFoundException('Instrumento no encontrado o no habilitado para tu tenant');
    }
    return this.attachQuote(tenantInstrument);
  }

  private async attachQuote(
    ti: TenantInstrumentWithInstrument,
  ): Promise<TenantInstrumentWithQuote> {
    try {
      const quote = await this.marketDataService.getQuote(
        ti.instrument.symbol,
        ti.instrument.assetClass,
      );
      return {
        ...ti,
        quote: { price: quote.price.toString(), asOf: quote.asOf, changePct: quote.changePct },
        quoteError: null,
      };
    } catch (err) {
      return { ...ti, quote: null, quoteError: (err as Error).message };
    }
  }
}

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ContractType } from '@prisma/client';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from '../prisma/prisma.service';
import { TenantClsStore } from '../common/tenant/tenant-cls.types';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { InstrumentRepository } from './instrument.repository';
import { MarketDataService } from './market-data.service';

interface SymbolToRefresh {
  symbol: string;
  assetClass: ContractType;
}

// Mantiene la caché de cotizaciones (Redis, vía MarketDataService) fresca con
// un ciclo de fondo, en vez de que cada request de un cliente dispare su
// propia llamada a Finnhub. Con un catálogo de decenas de instrumentos, pedir
// todo "en vivo" en cada carga de /client/market rompe el límite del plan
// free de Finnhub (~60 req/min) apenas hay más de un puñado de símbolos —
// visto en producción con 85 instrumentos (todos fallando a la vez).
//
// El ciclo espacia los pedidos (MARKET_REFRESH_DELAY_MS, default 1200ms ≈
// 50 req/min, con margen bajo el límite) y arranca la vuelta siguiente apenas
// termina la anterior — el propio espaciado ya limita la tasa, no hace falta
// un intervalo fijo aparte. getQuote() en MarketDataService sigue intacto
// como fallback (si la caché expiró y este ciclo todavía no volvió a pasar
// por ese símbolo, la request del cliente pide directo, igual que antes).
@Injectable()
export class MarketQuoteRefreshService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MarketQuoteRefreshService.name);
  private stopped = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly instrumentRepo: InstrumentRepository,
    private readonly marketDataService: MarketDataService,
    private readonly config: ConfigService,
    private readonly cls: ClsService<TenantClsStore>,
  ) {}

  onModuleInit(): void {
    // Sin await a propósito: el loop corre en paralelo al arranque del
    // backend, no lo bloquea ni lo hace fallar si Finnhub está caído.
    void this.loop();
  }

  onModuleDestroy(): void {
    this.stopped = true;
  }

  private async loop(): Promise<void> {
    const delayMs = Number(this.config.get<string>('MARKET_REFRESH_DELAY_MS') ?? '1200');

    while (!this.stopped) {
      let symbols: SymbolToRefresh[] = [];
      try {
        symbols = await this.collectActiveSymbols();
      } catch (err) {
        this.logger.error(
          `No se pudo armar la lista de símbolos a refrescar: ${(err as Error).message}`,
        );
      }

      if (symbols.length === 0) {
        await this.sleep(delayMs * 10); // catálogo vacío — no tiene sentido reintentar cada segundo
        continue;
      }

      for (const { symbol, assetClass } of symbols) {
        if (this.stopped) break;
        try {
          await this.marketDataService.refreshAndCache(symbol, assetClass);
        } catch (err) {
          // Un símbolo que falla (rate limit, ticker inválido, etc.) no debe
          // cortar el ciclo para el resto — mismo criterio que attachQuote en
          // MarketService.
          this.logger.warn(`No se pudo refrescar ${symbol}: ${(err as Error).message}`);
        }
        await this.sleep(delayMs);
      }
    }
  }

  // Catálogo global (Instrument) + habilitación por tenant (TenantInstrument,
  // con RLS) — hay que recorrer cada tenant con su propio contexto para leer
  // qué tiene activo, igual que haría un request real de ese tenant.
  private async collectActiveSymbols(): Promise<SymbolToRefresh[]> {
    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    const bySymbol = new Map<string, ContractType>();

    for (const tenant of tenants) {
      // Fuera de un request HTTP no hay contexto CLS (lo arma el middleware
      // por request, ver app.module.ts) — hay que abrir uno propio acá antes
      // de que TenantContextService.run() intente escribir en él.
      await this.cls.run(async () => {
        await this.tenantContext.run(tenant.id, async () => {
          const active = await this.instrumentRepo.listForTenant({ isActive: true });
          for (const ti of active) {
            bySymbol.set(ti.instrument.symbol, ti.instrument.assetClass);
          }
        });
      });
    }

    return Array.from(bySymbol.entries()).map(([symbol, assetClass]) => ({ symbol, assetClass }));
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

import { ContractType } from '@prisma/client';
import { isMarketOpen } from './market-hours.util';

describe('isMarketOpen', () => {
  describe('STOCKS — L-V 9:30-16:00 America/New_York', () => {
    it('abierto justo al horario de apertura (09:30 ET, jueves)', () => {
      expect(isMarketOpen(ContractType.STOCKS, new Date('2026-07-30T13:30:00Z'))).toBe(true);
    });

    it('cerrado un minuto antes de abrir (09:29 ET)', () => {
      expect(isMarketOpen(ContractType.STOCKS, new Date('2026-07-30T13:29:00Z'))).toBe(false);
    });

    it('cerrado justo al horario de cierre (16:00 ET, el límite es exclusivo)', () => {
      expect(isMarketOpen(ContractType.STOCKS, new Date('2026-07-30T20:00:00Z'))).toBe(false);
    });

    it('abierto un minuto antes de cerrar (15:59 ET)', () => {
      expect(isMarketOpen(ContractType.STOCKS, new Date('2026-07-30T19:59:00Z'))).toBe(true);
    });

    it('cerrado el fin de semana sin importar la hora', () => {
      expect(isMarketOpen(ContractType.STOCKS, new Date('2026-08-01T15:00:00Z'))).toBe(false); // sábado 11:00 ET
    });
  });

  describe('FOREX — continuo excepto viernes 17:00 a domingo 17:00 ET', () => {
    it('abierto un minuto antes del cierre de viernes (16:59 ET)', () => {
      expect(isMarketOpen(ContractType.FOREX, new Date('2026-07-31T20:59:00Z'))).toBe(true);
    });

    it('cerrado justo al cierre de viernes (17:00 ET)', () => {
      expect(isMarketOpen(ContractType.FOREX, new Date('2026-07-31T21:00:00Z'))).toBe(false);
    });

    it('cerrado el sábado', () => {
      expect(isMarketOpen(ContractType.FOREX, new Date('2026-08-01T15:00:00Z'))).toBe(false);
    });

    it('cerrado el domingo antes de las 17:00 ET', () => {
      expect(isMarketOpen(ContractType.FOREX, new Date('2026-08-02T20:00:00Z'))).toBe(false); // domingo 16:00 ET
    });

    it('abierto el domingo desde las 17:00 ET', () => {
      expect(isMarketOpen(ContractType.FOREX, new Date('2026-08-02T21:00:00Z'))).toBe(true); // domingo 17:00 ET
    });

    it('abierto un lunes a media mañana', () => {
      expect(isMarketOpen(ContractType.FOREX, new Date('2026-08-03T12:00:00Z'))).toBe(true); // lunes 08:00 ET
    });
  });
});

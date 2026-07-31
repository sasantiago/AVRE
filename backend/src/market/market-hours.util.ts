import { ContractType } from '@prisma/client';

const NY_TZ = 'America/New_York';

// Sin librería de timezones nueva — Intl.DateTimeFormat con timeZone alcanza
// para un chequeo de horario simple. Sin calendario de feriados (limitación
// conocida y documentada, igual criterio que otras simplificaciones de esta fase).
function getNyParts(at: Date): { weekday: string; minutesOfDay: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: NY_TZ,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
  const hour = parseInt(get('hour'), 10) % 24; // Intl puede devolver "24" para medianoche
  const minute = parseInt(get('minute'), 10);
  return { weekday: get('weekday'), minutesOfDay: hour * 60 + minute };
}

// §8 "Horario": STOCKS solo L-V 9:30-16:00 America/New_York. FOREX continuo
// excepto de viernes 17:00 a domingo 17:00 ET (mismo criterio que el mercado
// real de divisas).
export function isMarketOpen(assetClass: ContractType, at: Date = new Date()): boolean {
  const { weekday, minutesOfDay } = getNyParts(at);

  if (assetClass === ContractType.STOCKS) {
    const isWeekday = weekday !== 'Sat' && weekday !== 'Sun';
    return isWeekday && minutesOfDay >= 9 * 60 + 30 && minutesOfDay < 16 * 60;
  }

  // FOREX (y MIXED, tratado igual por defecto ante la duda).
  if (weekday === 'Sat') return false;
  if (weekday === 'Sun') return minutesOfDay >= 17 * 60;
  if (weekday === 'Fri') return minutesOfDay < 17 * 60;
  return true;
}

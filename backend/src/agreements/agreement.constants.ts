import { ClientPackage } from '@prisma/client';

export interface PackageTerms {
  termMonths: number;
  earlyWithdrawalMaxPct: number;
  earlyExitPenaltyPct: number;
}

// PENDIENTE DE CONFIRMACIÓN COMERCIAL (§15 del doc Fase 3) — valores placeholder
// de desarrollo, no usar en producción sin validar con el área comercial. Un
// ManagementAgreement congela estos valores al momento de la firma (§3.1): si
// se cambian acá después, no afecta retroactivamente a acuerdos ya vigentes.
export const PACKAGE_TERMS: Record<ClientPackage, PackageTerms> = {
  [ClientPackage.BASIC]: { termMonths: 6, earlyWithdrawalMaxPct: 10, earlyExitPenaltyPct: 15 },
  [ClientPackage.GROWTH]: { termMonths: 12, earlyWithdrawalMaxPct: 15, earlyExitPenaltyPct: 12 },
  [ClientPackage.PREMIUM]: { termMonths: 24, earlyWithdrawalMaxPct: 20, earlyExitPenaltyPct: 10 },
};

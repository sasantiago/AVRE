import { Prisma } from '@prisma/client';

export interface VerificationInput {
  txHash: string;
  // Wallet de la PLATAFORMA esperada como destino (§6.3 #4).
  toAddress: string;
  // Monto declarado por el cliente — solo referencia de UX (§6.3 #9), nunca se
  // acredita este valor.
  declaredAmountToken: Prisma.Decimal;
}

export interface VerificationResult {
  // true solo si TODAS las validaciones de integridad pasaron: contrato exacto,
  // destino exacto, éxito de la tx, y las dos fuentes coinciden entre sí
  // (§6.3 #2, #4, #5, #6). No dice nada sobre confirmaciones todavía.
  success: boolean;
  verifiedAmountToken?: Prisma.Decimal;
  // Dirección de origen de la tx — se usa para detectar cambios de wallet entre
  // depósitos del mismo cliente (§6.3 #8).
  sourceAddress?: string;
  // TRON: bloques transcurridos desde la tx (bloque actual - bloque de la tx).
  // Polygon: distancia entre el bloque `finalized` y el bloque de la tx — negativo
  // si todavía no se finalizó. En ambos casos "listo para revisión humana" es
  // `confirmations >= umbral requerido para esa red` (§6.3 #7).
  confirmations: number;
  failureReason?: string;
  // Respuesta cruda de cada fuente — se persiste en Deposit.verifierSnapshot para
  // auditoría forense (§11.3).
  rawPrimary: unknown;
  rawSecondary: unknown;
}

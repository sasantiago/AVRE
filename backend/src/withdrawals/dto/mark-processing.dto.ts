import { IsString, MinLength } from 'class-validator';

export class MarkProcessingDto {
  // Hash de la transferencia de salida que el operador ya envió manualmente
  // (§7.4) — el formato exacto se valida en el service, igual que en depósitos.
  @IsString()
  @MinLength(10)
  outboundTxHash!: string;
}

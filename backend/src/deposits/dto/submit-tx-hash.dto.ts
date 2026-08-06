import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class SubmitTxHashDto {
  // El formato exacto (por red) se valida en el service — acá solo el shape
  // genérico, para no rechazar antes de tiempo con un mensaje confuso.
  @IsString()
  @MinLength(10)
  @MaxLength(128)
  txHash!: string;

  // Captura del comprobante — respaldo visual opcional, NUNCA reemplaza la
  // verificación automática del txHash (ver deposit.service.ts).
  @IsOptional()
  @IsString()
  @MaxLength(100_000)
  receiptImageUrl?: string;
}

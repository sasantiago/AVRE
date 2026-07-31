import { IsNumber, IsPositive, IsUUID } from 'class-validator';

export class BuyOrderDto {
  @IsUUID('7')
  tenantInstrumentId!: string;

  // Cuánto USD del saldo disponible se quiere invertir — la cantidad se deriva
  // del precio fresco al momento de confirmar (§8).
  @IsNumber()
  @IsPositive()
  amountUsd!: number;

  // El precio que el cliente vio antes de confirmar (§8: "antigüedad máxima del
  // precio 15s"). El backend refetchea y compara — si difiere más de 0.5%, no
  // ejecuta y pide reconfirmación.
  @IsNumber()
  @IsPositive()
  quotedPrice!: number;
}

import { IsNumber, IsOptional, Min } from 'class-validator';

export class ApproveWithdrawalDto {
  // Solo obligatorio si la solicitud quedó con la penalidad "a definir" (retiro
  // definitivo anticipado): el monto que el asesor acordó con el cliente antes
  // de aprobar.
  @IsOptional()
  @IsNumber()
  @Min(0)
  finalAmountUsd?: number;
}

import { WithdrawalType } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsPositive } from 'class-validator';

export class CreateWithdrawalDto {
  @IsEnum(WithdrawalType)
  type!: WithdrawalType;

  // Solo aplica a PARTIAL — en FINAL siempre se retira el saldo completo (§7.1)
  // y este campo se ignora si se envía.
  @IsOptional()
  @IsNumber()
  @IsPositive()
  requestedAmountUsd?: number;
}

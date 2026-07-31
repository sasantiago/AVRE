import { ChainNetwork } from '@prisma/client';
import { IsEnum, IsNumber, IsPositive } from 'class-validator';

export class CreateDepositDto {
  @IsEnum(ChainNetwork)
  chain!: ChainNetwork;

  // Solo referencia de UX (§6.3 #9) — el monto que se acredita siempre es el
  // verificado on-chain, nunca este valor.
  @IsNumber()
  @IsPositive()
  declaredAmountToken!: number;
}

import { ClientPackage } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateAgreementDto {
  @IsUUID('7')
  clientId!: string;

  @IsEnum(ClientPackage)
  packageType!: ClientPackage;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  // Si se omiten, se usan los valores de PACKAGE_TERMS según packageType (§3.1) —
  // quedan congelados en la fila igual que si se hubiesen pasado explícitos.
  @IsOptional()
  @IsInt()
  @IsPositive()
  termMonths?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  earlyWithdrawalMaxPct?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  earlyExitPenaltyPct?: number;
}

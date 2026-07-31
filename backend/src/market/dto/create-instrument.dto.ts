import { ContractType } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateInstrumentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  symbol!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsEnum(ContractType)
  assetClass!: ContractType;

  @IsOptional()
  @IsString()
  exchange?: string;
}

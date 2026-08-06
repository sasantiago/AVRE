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

  // Sector para agrupar el treemap de Mercado (§4.1) — ej. "Technology",
  // "Finance". Si no se especifica, queda "Otros" (default del schema).
  @IsOptional()
  @IsString()
  @MaxLength(40)
  sector?: string;

  @IsOptional()
  @IsString()
  exchange?: string;
}

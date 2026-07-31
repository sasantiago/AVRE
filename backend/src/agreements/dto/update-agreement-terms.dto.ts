import { IsDateString, IsInt, IsNumber, IsOptional, IsPositive, Max, Min } from 'class-validator';

// Edición de términos de un acuerdo ya creado (§4.3, admin-only). No incluye
// packageType ni startDate — cambiar de paquete o de fecha de inicio es
// conceptualmente una renovación, no una edición (ver AgreementRepository.renew).
export class UpdateAgreementTermsDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  termMonths?: number;

  @IsOptional()
  @IsDateString()
  endDate?: string;

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

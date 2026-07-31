import { AgreementStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class QueryAgreementsDto {
  @IsOptional()
  @IsUUID('7')
  clientId?: string;

  @IsOptional()
  @IsUUID('7')
  advisorId?: string;

  @IsOptional()
  @IsEnum(AgreementStatus)
  status?: AgreementStatus;
}

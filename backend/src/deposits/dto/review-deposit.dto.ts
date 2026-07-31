import { IsString, MinLength } from 'class-validator';

export class RejectDepositDto {
  // Motivo obligatorio en el rechazo (§6.1, §11.3).
  @IsString()
  @MinLength(3)
  rejectionReason!: string;
}

import { IsString, MinLength } from 'class-validator';

export class RejectWithdrawalDto {
  @IsString()
  @MinLength(3)
  rejectionReason!: string;
}

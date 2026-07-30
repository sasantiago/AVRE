import { IsEnum, IsOptional } from 'class-validator';
import { Role } from '@prisma/client';

export class QueryUsersDto {
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}

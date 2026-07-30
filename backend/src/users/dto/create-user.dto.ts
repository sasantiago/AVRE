import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { Role } from '@prisma/client';

// Solo accesible por ADMIN — a diferencia de POST /auth/register (que solo crea
// CLIENT), este endpoint es la única vía para crear ADMIN/ADVISOR fuera del seed.
export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(10)
  password!: string;

  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsEnum(Role)
  role!: Role;
}

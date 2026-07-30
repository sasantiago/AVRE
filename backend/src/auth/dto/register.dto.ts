import { IsEmail, IsString, MinLength } from 'class-validator';

// POST /auth/register solo puede crear rol CLIENT — ADMIN/ADVISOR se provisionan
// por seed (backend/prisma/seed.ts), no por este endpoint público.
export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(10)
  password!: string;

  @IsString()
  @MinLength(2)
  fullName!: string;
}

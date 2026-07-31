import { ChainNetwork } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

// Campos que CLIENT/ADVISOR pueden editar sobre sí mismos (§2.2). withdrawalWallet*
// solo tiene efecto para CLIENT — un ADVISOR que los envíe recibe 403
// (ver ProfileService.assertWalletFieldsAllowed). contractType/clientPackage y
// los términos del acuerdo son admin-only en escritura y NO viven acá, sino en
// AdminUpdateProfileDto (backend/src/users/dto/admin-update-profile.dto.ts).
export class UpdateOwnProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(56)
  country?: string;

  @IsOptional()
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: 'phoneNumber debe estar en formato E.164 (ej. +5491122334455)',
  })
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100_000)
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  withdrawalWalletAddress?: string;

  @IsOptional()
  @IsEnum(ChainNetwork)
  withdrawalWalletNetwork?: ChainNetwork;
}

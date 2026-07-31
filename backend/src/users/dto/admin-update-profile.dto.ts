import { ClientPackage, ContractType } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { UpdateOwnProfileDto } from '../../profile/dto/update-own-profile.dto';

// Superset de UpdateOwnProfileDto: además de los campos de perfil "personales",
// el admin puede escribir contractType y clientPackage — datos contractuales,
// admin-only en escritura (§2.2). A diferencia del autoservicio, acá no se
// valida el rol del USUARIO EDITADO contra withdrawalWallet* (el admin puede
// setearla incluso si hoy el usuario es ADVISOR/ADMIN; la regla de negocio real
// es "solo tiene efecto para CLIENT", no una restricción dura de escritura).
export class AdminUpdateProfileDto extends UpdateOwnProfileDto {
  @IsOptional()
  @IsEnum(ContractType)
  contractType?: ContractType;

  @IsOptional()
  @IsEnum(ClientPackage)
  clientPackage?: ClientPackage;
}

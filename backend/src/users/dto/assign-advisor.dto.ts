import { IsOptional, IsUUID } from 'class-validator';

export class AssignAdvisorDto {
  // null/omitido = desasignar al cliente de cualquier asesor.
  @IsOptional()
  @IsUUID('7')
  advisorId?: string | null;
}

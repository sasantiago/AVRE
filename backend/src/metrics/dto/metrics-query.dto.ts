import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsPositive } from 'class-validator';

export class MetricsQueryDto {
  // Sobrepasa a la vez las ventanas de 30 días (capital/ticket) y 90 días
  // (renovación/salidas anticipadas) — simplificación deliberada en vez de 4
  // parámetros de ventana independientes (ver plan de esta etapa).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  days?: number;
}

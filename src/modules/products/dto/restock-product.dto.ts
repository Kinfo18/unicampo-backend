import { IsNumber, IsPositive, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class RestockProductDto {
  /** Unidades a SUMAR al stock actual (siempre positivo) */
  @IsNumber()
  @IsPositive()
  @Type(() => Number)
  units: number;

  /** Actualizar el stock mínimo de alerta (opcional) */
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  minStock?: number;
}

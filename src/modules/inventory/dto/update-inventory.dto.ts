import { IsNumber, Min, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateInventoryDto {
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'El stock no puede ser negativo' })
  @Type(() => Number)
  quantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'El stock mínimo debe ser al menos 1' })
  @Type(() => Number)
  minStock?: number;
}

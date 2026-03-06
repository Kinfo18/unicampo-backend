import {
    IsString,
    IsArray,
    ValidateNested,
    IsNumber,
    IsPositive,
    Min,
    IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
    @IsString()
    productId: string;

    @IsNumber()
    @IsPositive()
    @Min(1)
    @Type(() => Number)
    quantity: number;
}

export class CreateOrderDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => OrderItemDto)
    items: OrderItemDto[];

    @IsString()
    shippingAddress: string;

    @IsOptional()
    @IsString()
    notes?: string;
}

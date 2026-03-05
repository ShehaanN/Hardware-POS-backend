import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';

export class PurchaseOrderItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  productId: string;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @IsPositive()
  orderedQty: number;

  @ApiProperty({ example: 120.5 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  unitCost: number;
}

export class CreatePurchaseOrderDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  supplierId: string;

  @ApiPropertyOptional({ example: '2026-03-15' })
  @IsDateString()
  @IsOptional()
  expectedDate?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ type: [PurchaseOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseOrderItemDto)
  items: PurchaseOrderItemDto[];
}

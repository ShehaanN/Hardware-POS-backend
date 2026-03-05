import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod } from 'generated/prisma/enums';

export class SaleItemDto {
  @ApiProperty()
  @IsString()
  productId: string;

  @ApiProperty({ example: 3 })
  @IsInt()
  @IsPositive()
  quantity: number;

  @ApiPropertyOptional({
    description: 'Per-item discount amount',
    example: 5.0,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  discount?: number;
}

export class CreateSaleDto {
  @ApiPropertyOptional({ description: 'Leave empty for walk-in customer' })
  @IsString()
  @IsOptional()
  customerId?: string;

  @ApiProperty({ enum: PaymentMethod, default: PaymentMethod.CASH })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiProperty({
    description: 'Amount of cash/card given by customer',
    example: 500,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amountPaid: number;

  @ApiPropertyOptional({
    description: 'Overall discount on the whole sale',
    example: 50,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  discountAmount?: number;

  @ApiPropertyOptional({
    description: 'Tax rate as percentage (e.g. 8 for 8%)',
    example: 0,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  taxRate?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ type: [SaleItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items: SaleItemDto[];
}

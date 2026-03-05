import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';

export class ReturnItemDto {
  @ApiProperty({ description: 'The SaleItem ID from the original sale' })
  @IsString()
  @IsNotEmpty()
  saleItemId: string;

  @ApiProperty({ example: 1, description: 'Number of units being returned' })
  @IsInt()
  @IsPositive()
  returnQty: number;
}

export class CreateReturnDto {
  @ApiProperty({ description: 'The original Sale ID' })
  @IsString()
  @IsNotEmpty()
  saleId: string;

  @ApiProperty({
    example: 'Defective item / Wrong product / Customer changed mind',
  })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ type: [ReturnItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  items: ReturnItemDto[];
}

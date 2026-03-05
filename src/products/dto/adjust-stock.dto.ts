import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AdjustStockDto {
  @ApiProperty({
    description: 'Positive to add stock, negative to remove stock',
    example: 10,
  })
  @IsInt()
  quantity: number;

  @ApiPropertyOptional({ example: 'Stock received from supplier' })
  @IsString()
  @IsOptional()
  reason?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class ReceiveItemDto {
  @ApiProperty({ description: 'PurchaseOrderItem ID' })
  @IsString()
  @IsNotEmpty()
  itemId: string;

  @ApiProperty({ example: 50 })
  @IsInt()
  @Min(1)
  receivedQty: number;
}

export class ReceiveItemsDto {
  @ApiProperty({ type: [ReceiveItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiveItemDto)
  items: ReceiveItemDto[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class VoidSaleDto {
  @ApiProperty({ example: 'Customer returned items' })
  @IsString()
  @IsNotEmpty()
  reason: string;
}

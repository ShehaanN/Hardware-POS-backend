import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

class AdjustPointsDto {
  @ApiProperty({
    description: 'Positive to add, negative to deduct',
    example: 50,
  })
  @IsInt()
  points: number;
}

@ApiTags('Customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER', 'CASHIER')
  @ApiOperation({ summary: 'Register a new customer' })
  create(@Body() dto: CreateCustomerDto) {
    return this.customersService.create(dto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'CASHIER')
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Search by name, phone or email',
  })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.customersService.findAll({ search, page, limit });
  }

  @Get('phone/:phone')
  @Roles('ADMIN', 'MANAGER', 'CASHIER')
  @ApiOperation({
    summary: 'Look up a customer by phone number (quick POS lookup)',
  })
  findByPhone(@Param('phone') phone: string) {
    return this.customersService.findByPhone(phone);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'CASHIER')
  findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customersService.update(id, dto);
  }

  @Patch(':id/loyalty-points')
  @Roles('ADMIN', 'MANAGER', 'CASHIER')
  @ApiOperation({ summary: 'Add or deduct loyalty points for a customer' })
  adjustLoyaltyPoints(@Param('id') id: string, @Body() dto: AdjustPointsDto) {
    return this.customersService.adjustLoyaltyPoints(id, dto.points);
  }

  @Patch(':id/deactivate')
  @Roles('ADMIN')
  deactivate(@Param('id') id: string) {
    return this.customersService.deactivate(id);
  }
}

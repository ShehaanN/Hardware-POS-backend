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
import { SaleStatus } from 'generated/prisma/enums';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateSaleDto } from './dto/create-sale.dto';
import { VoidSaleDto } from './dto/void-sale.dto';
import { SalesService } from './sales.service';

@ApiTags('Sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER', 'CASHIER')
  @ApiOperation({
    summary:
      'Create a new sale — deducts stock & awards loyalty points automatically',
  })
  create(@CurrentUser() user: any, @Body() dto: CreateSaleDto) {
    return this.salesService.create(user.id, dto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'cashierId', required: false })
  @ApiQuery({ name: 'customerId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: SaleStatus })
  @ApiQuery({ name: 'startDate', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'endDate', required: false, description: 'YYYY-MM-DD' })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('cashierId') cashierId?: string,
    @Query('customerId') customerId?: string,
    @Query('status') status?: SaleStatus,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.salesService.findAll({
      page,
      limit,
      cashierId,
      customerId,
      status,
      startDate,
      endDate,
    });
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'CASHIER')
  findOne(@Param('id') id: string) {
    return this.salesService.findOne(id);
  }

  @Get(':id/receipt')
  @Roles('ADMIN', 'MANAGER', 'CASHIER')
  @ApiOperation({ summary: 'Get a formatted receipt object for a sale' })
  getReceipt(@Param('id') id: string) {
    return this.salesService.getReceipt(id);
  }

  @Patch(':id/void')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'Void a sale — restores stock & reverses loyalty points',
  })
  voidSale(@Param('id') id: string, @Body() dto: VoidSaleDto) {
    return this.salesService.voidSale(id, dto);
  }
}

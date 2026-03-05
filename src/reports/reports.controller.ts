import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'MANAGER')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @ApiOperation({
    summary: "Today's summary — sales, stock alerts, pending orders",
  })
  getDashboard() {
    return this.reportsService.getDashboardSummary();
  }

  @Get('sales')
  @ApiOperation({
    summary: 'Sales report with trends, cashier & payment breakdown',
  })
  @ApiQuery({ name: 'startDate', required: true, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'endDate', required: true, description: 'YYYY-MM-DD' })
  @ApiQuery({
    name: 'groupBy',
    required: false,
    enum: ['day', 'week', 'month'],
  })
  @ApiQuery({ name: 'cashierId', required: false })
  @ApiQuery({
    name: 'paymentMethod',
    required: false,
    enum: ['CASH', 'CARD', 'BANK_TRANSFER'],
  })
  getSalesReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('groupBy') groupBy?: 'day' | 'week' | 'month',
    @Query('cashierId') cashierId?: string,
    @Query('paymentMethod') paymentMethod?: string,
  ) {
    return this.reportsService.getSalesReport({
      startDate,
      endDate,
      groupBy,
      cashierId,
      paymentMethod,
    });
  }

  @Get('top-products')
  @ApiOperation({ summary: 'Best-selling products by quantity sold' })
  @ApiQuery({ name: 'startDate', required: true, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'endDate', required: true, description: 'YYYY-MM-DD' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Default: 10',
  })
  @ApiQuery({ name: 'categoryId', required: false })
  getTopProducts(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('limit') limit?: number,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.reportsService.getTopProductsReport({
      startDate,
      endDate,
      limit,
      categoryId,
    });
  }

  @Get('inventory')
  @ApiOperation({
    summary: 'Full inventory with stock levels, values & status',
  })
  @ApiQuery({ name: 'categoryId', required: false })
  @ApiQuery({ name: 'supplierId', required: false })
  getInventory(
    @Query('categoryId') categoryId?: string,
    @Query('supplierId') supplierId?: string,
  ) {
    return this.reportsService.getInventoryReport({ categoryId, supplierId });
  }

  @Get('profit-loss')
  @ApiOperation({
    summary: 'Profit & loss — revenue, COGS, gross profit & margin',
  })
  @ApiQuery({ name: 'startDate', required: true, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'endDate', required: true, description: 'YYYY-MM-DD' })
  getProfitLoss(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.reportsService.getProfitLossReport({ startDate, endDate });
  }

  @Get('purchases')
  @ApiOperation({ summary: 'Purchase orders summary by supplier and status' })
  @ApiQuery({ name: 'startDate', required: true, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'endDate', required: true, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'supplierId', required: false })
  getPurchases(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('supplierId') supplierId?: string,
  ) {
    return this.reportsService.getPurchaseReport({
      startDate,
      endDate,
      supplierId,
    });
  }

  @Get('customers')
  @ApiOperation({ summary: 'Top customers by spend + walk-in stats' })
  @ApiQuery({ name: 'startDate', required: true, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'endDate', required: true, description: 'YYYY-MM-DD' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Default: 10',
  })
  getCustomers(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('limit') limit?: number,
  ) {
    return this.reportsService.getCustomerReport({ startDate, endDate, limit });
  }
}

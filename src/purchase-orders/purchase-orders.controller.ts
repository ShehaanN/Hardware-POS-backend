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
import { PurchaseOrderStatus } from 'generated/prisma/enums';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { ReceiveItemsDto } from './dto/receive-items.dto';
import { PurchaseOrdersService } from './purchase-orders.service';

@ApiTags('Purchase Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('purchase-orders')
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Create a new purchase order' })
  create(@Body() dto: CreatePurchaseOrderDto) {
    return this.purchaseOrdersService.create(dto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'supplierId', required: false })
  @ApiQuery({ name: 'status', required: false, enum: PurchaseOrderStatus })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('supplierId') supplierId?: string,
    @Query('status') status?: PurchaseOrderStatus,
  ) {
    return this.purchaseOrdersService.findAll({
      page,
      limit,
      supplierId,
      status,
    });
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER')
  findOne(@Param('id') id: string) {
    return this.purchaseOrdersService.findOne(id);
  }

  @Patch(':id/receive')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'Mark items as received — automatically increments product stock',
  })
  receiveItems(@Param('id') id: string, @Body() dto: ReceiveItemsDto) {
    return this.purchaseOrdersService.receiveItems(id, dto);
  }

  @Patch(':id/cancel')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({
    summary: 'Cancel a pending or partially received purchase order',
  })
  cancel(@Param('id') id: string) {
    return this.purchaseOrdersService.cancel(id);
  }
}

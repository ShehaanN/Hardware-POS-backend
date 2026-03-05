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
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductsService } from './products.service';

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @Roles('ADMIN', 'MANAGER')
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Get()
  @Roles('ADMIN', 'MANAGER', 'CASHIER')
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'categoryId', required: false, type: String })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'lowStock', required: false, type: Boolean })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('lowStock') lowStock?: boolean,
  ) {
    return this.productsService.findAll({
      page,
      limit,
      categoryId,
      search,
      lowStock,
    });
  }

  @Get('low-stock')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Get all products at or below minimum stock level' })
  findLowStock() {
    return this.productsService.findLowStock();
  }

  @Get('barcode/:barcode')
  @Roles('ADMIN', 'MANAGER', 'CASHIER')
  @ApiOperation({ summary: 'Look up a product by barcode (for POS scanning)' })
  findByBarcode(@Param('barcode') barcode: string) {
    return this.productsService.findByBarcode(barcode);
  }

  @Get('sku/:sku')
  @Roles('ADMIN', 'MANAGER', 'CASHIER')
  findBySku(@Param('sku') sku: string) {
    return this.productsService.findBySku(sku);
  }

  @Get(':id')
  @Roles('ADMIN', 'MANAGER', 'CASHIER')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'MANAGER')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Patch(':id/adjust-stock')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Add or remove stock quantity' })
  adjustStock(@Param('id') id: string, @Body() dto: AdjustStockDto) {
    return this.productsService.adjustStock(id, dto);
  }

  @Patch(':id/deactivate')
  @Roles('ADMIN')
  deactivate(@Param('id') id: string) {
    return this.productsService.deactivate(id);
  }
}

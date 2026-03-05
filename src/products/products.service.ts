import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateProductDto) {
    const existingSku = await this.prisma.product.findUnique({
      where: { sku: dto.sku },
    });
    if (existingSku) throw new ConflictException('SKU already exists');

    if (dto.barcode) {
      const existingBarcode = await this.prisma.product.findUnique({
        where: { barcode: dto.barcode },
      });
      if (existingBarcode)
        throw new ConflictException('Barcode already in use');
    }

    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) throw new NotFoundException('Category not found');
    }

    return this.prisma.product.create({
      data: dto,
      include: { category: true },
    });
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    categoryId?: string;
    search?: string;
    lowStock?: boolean;
  }) {
    const { page = 1, limit = 20, categoryId, search, lowStock } = params;
    const skip = (page - 1) * limit;

    const where: any = { isActive: true };
    if (categoryId) where.categoryId = categoryId;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (lowStock) {
      where.stockQuantity = { lte: this.prisma.product.fields.minStockLevel };
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: { category: { select: { id: true, name: true } } },
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findLowStock() {
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      include: { category: { select: { id: true, name: true } } },
      orderBy: { stockQuantity: 'asc' },
    });
    // Filter where stockQuantity <= minStockLevel
    return products.filter((p) => p.stockQuantity <= p.minStockLevel);
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async findBySku(sku: string) {
    const product = await this.prisma.product.findUnique({
      where: { sku },
      include: { category: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async findByBarcode(barcode: string) {
    const product = await this.prisma.product.findUnique({
      where: { barcode },
      include: { category: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);

    if (dto.sku) {
      const existing = await this.prisma.product.findUnique({
        where: { sku: dto.sku },
      });
      if (existing && existing.id !== id)
        throw new ConflictException('SKU already exists');
    }

    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: dto.categoryId },
      });
      if (!category) throw new NotFoundException('Category not found');
    }

    return this.prisma.product.update({
      where: { id },
      data: dto,
      include: { category: true },
    });
  }

  async adjustStock(id: string, dto: AdjustStockDto) {
    const product = await this.findOne(id);
    const newQty = product.stockQuantity + dto.quantity;

    if (newQty < 0) {
      throw new BadRequestException(
        `Insufficient stock. Current: ${product.stockQuantity}, Requested: ${Math.abs(dto.quantity)}`,
      );
    }

    return this.prisma.product.update({
      where: { id },
      data: { stockQuantity: newQty },
      include: { category: true },
    });
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
  }
}

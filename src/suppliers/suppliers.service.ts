import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateSupplierDto) {
    const existing = await this.prisma.supplier.findUnique({
      where: { name: dto.name },
    });
    if (existing) throw new ConflictException('Supplier name already exists');

    if (dto.email) {
      const emailExists = await this.prisma.supplier.findUnique({
        where: { email: dto.email },
      });
      if (emailExists) throw new ConflictException('Email already in use');
    }

    return this.prisma.supplier.create({ data: dto });
  }

  async findAll(params: { search?: string; page?: number; limit?: number }) {
    const { search, page = 1, limit = 20 } = params;
    const skip = (page - 1) * limit;

    const where: any = { isActive: true };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { contactPerson: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.supplier.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          _count: { select: { products: true, purchaseOrders: true } },
        },
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        products: {
          select: { id: true, name: true, sku: true, stockQuantity: true },
        },
        _count: { select: { purchaseOrders: true } },
      },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    return supplier;
  }

  async update(id: string, dto: UpdateSupplierDto) {
    await this.findOne(id);

    if (dto.name) {
      const existing = await this.prisma.supplier.findUnique({
        where: { name: dto.name },
      });
      if (existing && existing.id !== id)
        throw new ConflictException('Supplier name already exists');
    }

    if (dto.email) {
      const existing = await this.prisma.supplier.findUnique({
        where: { email: dto.email },
      });
      if (existing && existing.id !== id)
        throw new ConflictException('Email already in use');
    }

    return this.prisma.supplier.update({ where: { id }, data: dto });
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.supplier.update({
      where: { id },
      data: { isActive: false },
    });
  }
}

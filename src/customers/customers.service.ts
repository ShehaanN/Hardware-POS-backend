import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateCustomerDto) {
    if (dto.email) {
      const existing = await this.prisma.customer.findUnique({
        where: { email: dto.email },
      });
      if (existing) throw new ConflictException('Email already in use');
    }

    if (dto.phone) {
      const existing = await this.prisma.customer.findUnique({
        where: { phone: dto.phone },
      });
      if (existing) throw new ConflictException('Phone number already in use');
    }

    return this.prisma.customer.create({ data: dto });
  }

  async findAll(params: { page?: number; limit?: number; search?: string }) {
    const { page = 1, limit = 20, search } = params;
    const skip = (page - 1) * limit;

    const where: any = { isActive: true };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.customer.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async findByPhone(phone: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { phone },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async update(id: string, dto: UpdateCustomerDto) {
    await this.findOne(id);

    if (dto.email) {
      const existing = await this.prisma.customer.findUnique({
        where: { email: dto.email },
      });
      if (existing && existing.id !== id)
        throw new ConflictException('Email already in use');
    }

    if (dto.phone) {
      const existing = await this.prisma.customer.findUnique({
        where: { phone: dto.phone },
      });
      if (existing && existing.id !== id)
        throw new ConflictException('Phone number already in use');
    }

    return this.prisma.customer.update({ where: { id }, data: dto });
  }

  async adjustLoyaltyPoints(id: string, points: number) {
    const customer = await this.findOne(id);
    const newPoints = customer.loyaltyPoints + points;

    if (newPoints < 0) {
      throw new ConflictException(
        `Insufficient loyalty points. Current: ${customer.loyaltyPoints}`,
      );
    }

    return this.prisma.customer.update({
      where: { id },
      data: { loyaltyPoints: newPoints },
    });
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.customer.update({
      where: { id },
      data: { isActive: false },
    });
  }
}

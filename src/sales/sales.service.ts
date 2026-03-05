import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SaleStatus } from 'generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { VoidSaleDto } from './dto/void-sale.dto';

// 1 loyalty point per 100 units of currency spent
const LOYALTY_POINTS_RATE = 100;

@Injectable()
export class SalesService {
  constructor(private prisma: PrismaService) {}

  private generateSaleNumber(): string {
    const date = new Date();
    const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const rand = Math.floor(10000 + Math.random() * 90000);
    return `SALE-${stamp}-${rand}`;
  }

  async create(cashierId: string, dto: CreateSaleDto) {
    // 1. Validate customer if provided
    if (dto.customerId) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: dto.customerId },
      });
      if (!customer) throw new NotFoundException('Customer not found');
      if (!customer.isActive)
        throw new BadRequestException('Customer account is inactive');
    }

    // 2. Validate all products and stock in one pass
    const resolvedItems: {
      productId: string;
      productName: string;
      productSku: string;
      quantity: number;
      unitPrice: number;
      discount: number;
      lineTotal: number;
    }[] = [];

    for (const item of dto.items) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
      });
      if (!product)
        throw new NotFoundException(`Product ${item.productId} not found`);
      if (!product.isActive)
        throw new BadRequestException(`Product "${product.name}" is inactive`);
      if (product.stockQuantity < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for "${product.name}". Available: ${product.stockQuantity}, Requested: ${item.quantity}`,
        );
      }

      const unitPrice = Number(product.sellingPrice);
      const discount = item.discount ?? 0;
      const lineTotal = unitPrice * item.quantity - discount;

      resolvedItems.push({
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        quantity: item.quantity,
        unitPrice,
        discount,
        lineTotal,
      });
    }

    // 3. Calculate totals
    const subtotal = resolvedItems.reduce((sum, i) => sum + i.lineTotal, 0);
    const discountAmount = dto.discountAmount ?? 0;
    const taxRate = dto.taxRate ?? 0;
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = (taxableAmount * taxRate) / 100;
    const totalAmount = taxableAmount + taxAmount;

    if (dto.amountPaid < totalAmount) {
      throw new BadRequestException(
        `Amount paid (${dto.amountPaid}) is less than total (${totalAmount.toFixed(2)})`,
      );
    }

    const changeGiven = dto.amountPaid - totalAmount;

    // 4. Create sale + items + deduct stock — all in one transaction
    const sale = await this.prisma.$transaction(async (tx) => {
      // Create the sale record
      const newSale = await tx.sale.create({
        data: {
          saleNumber: this.generateSaleNumber(),
          cashierId,
          customerId: dto.customerId ?? null,
          subtotal,
          discountAmount,
          taxRate,
          taxAmount,
          totalAmount,
          paymentMethod: dto.paymentMethod,
          amountPaid: dto.amountPaid,
          changeGiven,
          notes: dto.notes,
          items: {
            create: resolvedItems,
          },
        },
        include: {
          items: { include: { product: { select: { id: true, name: true, sku: true } } } },
          cashier: { select: { id: true, name: true } },
          customer: { select: { id: true, name: true, phone: true } },
        },
      });

      // Deduct stock for each item
      for (const item of resolvedItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { decrement: item.quantity } },
        });
      }

      // Award loyalty points if customer is attached
      if (dto.customerId) {
        const pointsEarned = Math.floor(totalAmount / LOYALTY_POINTS_RATE);
        if (pointsEarned > 0) {
          await tx.customer.update({
            where: { id: dto.customerId },
            data: { loyaltyPoints: { increment: pointsEarned } },
          });
        }
      }

      return newSale;
    });

    return this.formatReceipt(sale);
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    cashierId?: string;
    customerId?: string;
    status?: SaleStatus;
    startDate?: string;
    endDate?: string;
  }) {
    const { page = 1, limit = 20, cashierId, customerId, status, startDate, endDate } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (cashierId) where.cashierId = cashierId;
    if (customerId) where.customerId = customerId;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.saleDate = {};
      if (startDate) where.saleDate.gte = new Date(startDate);
      if (endDate) where.saleDate.lte = new Date(endDate + 'T23:59:59.999Z');
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.sale.findMany({
        where,
        skip,
        take: limit,
        orderBy: { saleDate: 'desc' },
        include: {
          cashier: { select: { id: true, name: true } },
          customer: { select: { id: true, name: true, phone: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.sale.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        items: true,
        cashier: { select: { id: true, name: true } },
        customer: { select: { id: true, name: true, phone: true, loyaltyPoints: true } },
      },
    });
    if (!sale) throw new NotFoundException('Sale not found');
    return sale;
  }

  async getReceipt(id: string) {
    const sale = await this.findOne(id);
    return this.formatReceipt(sale);
  }

  async voidSale(id: string, dto: VoidSaleDto) {
    const sale = await this.findOne(id);

    if (sale.status === SaleStatus.VOIDED) {
      throw new BadRequestException('Sale is already voided');
    }

    await this.prisma.$transaction(async (tx) => {
      // Restore stock for each item
      for (const item of sale.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { increment: item.quantity } },
        });
      }

      // Deduct loyalty points that were awarded
      if (sale.customerId) {
        const pointsToDeduct = Math.floor(
          Number(sale.totalAmount) / LOYALTY_POINTS_RATE,
        );
        if (pointsToDeduct > 0) {
          const customer = await tx.customer.findUnique({
            where: { id: sale.customerId },
          });
          const safeDeduction = Math.min(
            pointsToDeduct,
            customer?.loyaltyPoints ?? 0,
          );
          if (safeDeduction > 0) {
            await tx.customer.update({
              where: { id: sale.customerId },
              data: { loyaltyPoints: { decrement: safeDeduction } },
            });
          }
        }
      }

      // Mark sale as voided
      await tx.sale.update({
        where: { id },
        data: {
          status: SaleStatus.VOIDED,
          voidedAt: new Date(),
          voidReason: dto.reason,
        },
      });
    });

    return this.findOne(id);
  }

  // Formats a sale into a clean receipt object for the frontend/printer
  private formatReceipt(sale: any) {
    return {
      receipt: {
        saleNumber: sale.saleNumber,
        date: sale.saleDate ?? sale.createdAt,
        cashier: sale.cashier?.name,
        customer: sale.customer
          ? { name: sale.customer.name, phone: sale.customer.phone }
          : 'Walk-in Customer',
        items: sale.items.map((i: any) => ({
          name: i.productName,
          sku: i.productSku,
          qty: i.quantity,
          unitPrice: Number(i.unitPrice),
          discount: Number(i.discount),
          lineTotal: Number(i.lineTotal),
        })),
        subtotal: Number(sale.subtotal),
        discountAmount: Number(sale.discountAmount),
        taxRate: Number(sale.taxRate),
        taxAmount: Number(sale.taxAmount),
        totalAmount: Number(sale.totalAmount),
        paymentMethod: sale.paymentMethod,
        amountPaid: Number(sale.amountPaid),
        changeGiven: Number(sale.changeGiven),
        status: sale.status,
        notes: sale.notes ?? null,
      },
    };
  }
}
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SaleStatus } from 'generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { SalesService } from '../sales/sales.service';
import { CreateReturnDto } from './dto/create-return.dto';

// Same rate used in SalesService — must stay in sync
const LOYALTY_POINTS_RATE = 100;

@Injectable()
export class ReturnsService {
  constructor(
    private prisma: PrismaService,
    private salesService: SalesService,
  ) {}

  private generateReturnNumber(): string {
    const date = new Date();
    const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const rand = Math.floor(10000 + Math.random() * 90000);
    return `RET-${stamp}-${rand}`;
  }

  async create(processedById: string, dto: CreateReturnDto) {
    // 1. Validate the original sale
    const sale = await this.salesService.findOne(dto.saleId);

    if (sale.status === SaleStatus.VOIDED) {
      throw new BadRequestException(
        'Cannot process a return on a voided sale. Use void for same-day errors.',
      );
    }

    // 2. Validate each return item against the original sale items
    const resolvedItems: {
      saleItemId: string;
      productId: string;
      productName: string;
      productSku: string;
      returnQty: number;
      unitPrice: number;
      refundAmount: number;
    }[] = [];

    for (const item of dto.items) {
      // Find the matching sale item
      const saleItem = sale.items.find((si) => si.id === item.saleItemId);
      if (!saleItem) {
        throw new NotFoundException(
          `SaleItem ${item.saleItemId} does not belong to sale ${dto.saleId}`,
        );
      }

      // Check how many have already been returned for this sale item
      const previousReturns = await this.prisma.returnItem.aggregate({
        where: { saleItemId: item.saleItemId },
        _sum: { returnQty: true },
      });
      const alreadyReturned = previousReturns._sum.returnQty ?? 0;
      const maxReturnable = saleItem.quantity - alreadyReturned;

      if (item.returnQty > maxReturnable) {
        throw new BadRequestException(
          `Cannot return ${item.returnQty} of "${saleItem.productName}". ` +
            `Originally sold: ${saleItem.quantity}, Already returned: ${alreadyReturned}, Returnable: ${maxReturnable}`,
        );
      }

      const unitPrice = Number(saleItem.unitPrice);
      const refundAmount = unitPrice * item.returnQty;

      resolvedItems.push({
        saleItemId: item.saleItemId,
        productId: saleItem.productId,
        productName: saleItem.productName,
        productSku: saleItem.productSku,
        returnQty: item.returnQty,
        unitPrice,
        refundAmount,
      });
    }

    // 3. Calculate total refund
    const totalRefund = resolvedItems.reduce(
      (sum, i) => sum + i.refundAmount,
      0,
    );

    // 4. Process everything in a transaction
    const returnRecord = await this.prisma.$transaction(async (tx) => {
      // Create the return record + items
      const newReturn = await tx.return.create({
        data: {
          returnNumber: this.generateReturnNumber(),
          saleId: dto.saleId,
          processedById,
          reason: dto.reason,
          notes: dto.notes,
          totalRefund,
          items: {
            create: resolvedItems,
          },
        },
        include: {
          items: true,
          sale: { select: { id: true, saleNumber: true } },
          processedBy: { select: { id: true, name: true } },
        },
      });

      // Restore stock for returned items
      for (const item of resolvedItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stockQuantity: { increment: item.returnQty } },
        });
      }

      // Deduct loyalty points proportionally (if customer exists on original sale)
      if (sale.customerId) {
        // Points to reverse = proportion of original total being refunded
        const originalTotal = Number(sale.totalAmount);
        const refundRatio = originalTotal > 0 ? totalRefund / originalTotal : 0;
        const originalPointsAwarded = Math.floor(
          originalTotal / LOYALTY_POINTS_RATE,
        );
        const pointsToDeduct = Math.floor(originalPointsAwarded * refundRatio);

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

      return newReturn;
    });

    return this.formatRefundReceipt(returnRecord, sale);
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    saleId?: string;
    processedById?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const {
      page = 1,
      limit = 20,
      saleId,
      processedById,
      startDate,
      endDate,
    } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (saleId) where.saleId = saleId;
    if (processedById) where.processedById = processedById;
    if (startDate || endDate) {
      where.returnDate = {};
      if (startDate) where.returnDate.gte = new Date(startDate);
      if (endDate) where.returnDate.lte = new Date(endDate + 'T23:59:59.999Z');
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.return.findMany({
        where,
        skip,
        take: limit,
        orderBy: { returnDate: 'desc' },
        include: {
          sale: { select: { id: true, saleNumber: true } },
          processedBy: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.return.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const returnRecord = await this.prisma.return.findUnique({
      where: { id },
      include: {
        items: true,
        sale: {
          select: {
            id: true,
            saleNumber: true,
            saleDate: true,
            totalAmount: true,
            paymentMethod: true,
            customer: { select: { id: true, name: true, phone: true } },
          },
        },
        processedBy: { select: { id: true, name: true } },
      },
    });
    if (!returnRecord) throw new NotFoundException('Return record not found');
    return returnRecord;
  }

  // Returns a formatted refund receipt for the frontend/printer
  private formatRefundReceipt(returnRecord: any, originalSale: any) {
    return {
      refundReceipt: {
        returnNumber: returnRecord.returnNumber,
        returnDate: returnRecord.returnDate ?? returnRecord.createdAt,
        originalSaleNumber: originalSale.saleNumber,
        processedBy: returnRecord.processedBy?.name,
        customer: originalSale.customer
          ? {
              name: originalSale.customer.name,
              phone: originalSale.customer.phone,
            }
          : 'Walk-in Customer',
        reason: returnRecord.reason,
        items: returnRecord.items.map((i: any) => ({
          name: i.productName,
          sku: i.productSku,
          returnQty: i.returnQty,
          unitPrice: Number(i.unitPrice),
          refundAmount: Number(i.refundAmount),
        })),
        totalRefund: Number(returnRecord.totalRefund),
        notes: returnRecord.notes ?? null,
      },
    };
  }
}

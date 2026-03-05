import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PurchaseOrderStatus } from 'generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { ReceiveItemsDto } from './dto/receive-items.dto';

@Injectable()
export class PurchaseOrdersService {
  constructor(private prisma: PrismaService) {}

  private generateOrderNumber(): string {
    const date = new Date();
    const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `PO-${stamp}-${rand}`;
  }

  async create(dto: CreatePurchaseOrderDto) {
    // Validate supplier
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: dto.supplierId },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');

    // Validate all products exist
    for (const item of dto.items) {
      const product = await this.prisma.product.findUnique({
        where: { id: item.productId },
      });
      if (!product)
        throw new NotFoundException(`Product ${item.productId} not found`);
    }

    // Calculate totals
    const totalAmount = dto.items.reduce(
      (sum, item) => sum + item.orderedQty * item.unitCost,
      0,
    );

    return this.prisma.purchaseOrder.create({
      data: {
        orderNumber: this.generateOrderNumber(),
        supplierId: dto.supplierId,
        expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : undefined,
        notes: dto.notes,
        totalAmount,
        items: {
          create: dto.items.map((item) => ({
            productId: item.productId,
            orderedQty: item.orderedQty,
            unitCost: item.unitCost,
            totalCost: item.orderedQty * item.unitCost,
          })),
        },
      },
      include: {
        supplier: { select: { id: true, name: true } },
        items: {
          include: { product: { select: { id: true, name: true, sku: true } } },
        },
      },
    });
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    supplierId?: string;
    status?: PurchaseOrderStatus;
  }) {
    const { page = 1, limit = 20, supplierId, status } = params;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (supplierId) where.supplierId = supplierId;
    if (status) where.status = status;

    const [data, total] = await this.prisma.$transaction([
      this.prisma.purchaseOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          supplier: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const order = await this.prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                unit: true,
                stockQuantity: true,
              },
            },
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Purchase order not found');
    return order;
  }

  async receiveItems(id: string, dto: ReceiveItemsDto) {
    const order = await this.findOne(id);

    if (order.status === PurchaseOrderStatus.CANCELLED) {
      throw new BadRequestException(
        'Cannot receive items on a cancelled order',
      );
    }
    if (order.status === PurchaseOrderStatus.RECEIVED) {
      throw new BadRequestException(
        'This order has already been fully received',
      );
    }

    // Process each received item in a transaction
    await this.prisma.$transaction(async (tx) => {
      for (const receivedItem of dto.items) {
        const orderItem = order.items.find((i) => i.id === receivedItem.itemId);
        if (!orderItem)
          throw new NotFoundException(
            `Order item ${receivedItem.itemId} not found in this order`,
          );

        const newReceivedQty = orderItem.receivedQty + receivedItem.receivedQty;
        if (newReceivedQty > orderItem.orderedQty) {
          throw new BadRequestException(
            `Cannot receive more than ordered. Ordered: ${orderItem.orderedQty}, Already received: ${orderItem.receivedQty}`,
          );
        }

        // Update the order item's received quantity
        await tx.purchaseOrderItem.update({
          where: { id: receivedItem.itemId },
          data: { receivedQty: newReceivedQty },
        });

        // Increment product stock
        await tx.product.update({
          where: { id: orderItem.productId },
          data: { stockQuantity: { increment: receivedItem.receivedQty } },
        });
      }

      // Re-fetch items to determine new order status
      const updatedItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: id },
      });

      const allFullyReceived = updatedItems.every(
        (i) => i.receivedQty >= i.orderedQty,
      );
      const anyReceived = updatedItems.some((i) => i.receivedQty > 0);

      const newStatus = allFullyReceived
        ? PurchaseOrderStatus.RECEIVED
        : anyReceived
          ? PurchaseOrderStatus.PARTIALLY_RECEIVED
          : PurchaseOrderStatus.PENDING;

      await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: newStatus,
          receivedDate: allFullyReceived ? new Date() : undefined,
          notes: dto.notes ?? order.notes,
        },
      });
    });

    return this.findOne(id);
  }

  async cancel(id: string) {
    const order = await this.findOne(id);

    if (order.status === PurchaseOrderStatus.RECEIVED) {
      throw new BadRequestException('Cannot cancel a fully received order');
    }

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: PurchaseOrderStatus.CANCELLED },
    });
  }
}

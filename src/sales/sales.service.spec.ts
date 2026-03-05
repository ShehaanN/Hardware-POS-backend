import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SalesService } from './sales.service';
import { PrismaService } from '../prisma/prisma.service';

const mockTransactionFn = jest.fn();

const mockPrisma = {
  customer: { findUnique: jest.fn() },
  product: { findUnique: jest.fn(), update: jest.fn() },
  sale: {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  $transaction: mockTransactionFn,
};

const mockProduct = {
  id: 'prod-1',
  name: 'Hammer',
  sku: 'HAMMER-01',
  sellingPrice: 100,
  costPrice: 60,
  stockQuantity: 20,
  isActive: true,
};

describe('SalesService', () => {
  let service: SalesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SalesService>(SalesService);
    jest.clearAllMocks();
  });

  // ── create() ────────────────────────────────────────────────────────────

  describe('create()', () => {
    const dto = {
      paymentMethod: 'CASH' as any,
      amountPaid: 200,
      items: [{ productId: 'prod-1', quantity: 1 }],
    };

    it('should throw NotFoundException if product does not exist', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(service.create('cashier-1', dto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException for inactive product', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        isActive: false,
      });

      await expect(service.create('cashier-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for insufficient stock', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        stockQuantity: 0,
      });

      await expect(service.create('cashier-1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if amountPaid is less than total', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);

      await expect(
        service.create('cashier-1', { ...dto, amountPaid: 10 }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should call $transaction on valid sale', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct);

      const mockSale = {
        id: 'sale-1',
        saleNumber: 'SALE-20260305-12345',
        saleDate: new Date(),
        cashier: { id: 'cashier-1', name: 'Sarah' },
        customer: null,
        subtotal: 100,
        discountAmount: 0,
        taxRate: 0,
        taxAmount: 0,
        totalAmount: 100,
        paymentMethod: 'CASH',
        amountPaid: 200,
        changeGiven: 100,
        status: 'COMPLETED',
        notes: null,
        items: [
          {
            productName: 'Hammer',
            productSku: 'HAMMER-01',
            quantity: 1,
            unitPrice: 100,
            discount: 0,
            lineTotal: 100,
          },
        ],
      };

      mockTransactionFn.mockImplementation(async (cb: any) => cb(mockPrisma));
      mockPrisma.sale.create.mockResolvedValue(mockSale);
      mockPrisma.product.update.mockResolvedValue({});

      const result = await service.create('cashier-1', dto);

      expect(mockTransactionFn).toHaveBeenCalledTimes(1);
      expect(result).toHaveProperty('receipt');
      expect(result.receipt.changeGiven).toBe(100);
    });
  });

  // ── findOne() ───────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('should throw NotFoundException when sale not found', async () => {
      mockPrisma.sale.findUnique.mockResolvedValue(null);
      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return sale when found', async () => {
      const mockSale = {
        id: 'sale-1',
        items: [],
        cashier: { id: 'c1', name: 'Sarah' },
        customer: null,
      };
      mockPrisma.sale.findUnique.mockResolvedValue(mockSale);
      const result = await service.findOne('sale-1');
      expect(result.id).toBe('sale-1');
    });
  });

  // ── voidSale() ──────────────────────────────────────────────────────────

  describe('voidSale()', () => {
    it('should throw BadRequestException if already voided', async () => {
      mockPrisma.sale.findUnique.mockResolvedValue({
        id: 'sale-1',
        status: 'VOIDED',
        items: [],
        cashier: {},
        customer: null,
      });

      await expect(
        service.voidSale('sale-1', { reason: 'test' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

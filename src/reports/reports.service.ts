import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SaleStatus } from 'generated/prisma/enums';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  // ─────────────────────────────────────────────
  // 1. DASHBOARD SUMMARY
  // ─────────────────────────────────────────────
  async getDashboardSummary() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      todaySales,
      totalProducts,
      lowStockProducts,
      pendingOrders,
      totalCustomers,
      todayReturns,
    ] = await this.prisma.$transaction([
      // Today's completed sales total
      this.prisma.sale.aggregate({
        where: {
          status: SaleStatus.COMPLETED,
          saleDate: { gte: today, lt: tomorrow },
        },
        _sum: { totalAmount: true },
        _count: { id: true },
      }),
      // Total active products
      this.prisma.product.count({ where: { isActive: true } }),
      // Products at or below min stock
      this.prisma.product.count({
        where: { isActive: true, stockQuantity: { lte: 0 } },
      }),
      // Pending purchase orders
      this.prisma.purchaseOrder.count({ where: { status: 'PENDING' } }),
      // Total active customers
      this.prisma.customer.count({ where: { isActive: true } }),
      // Today's returns total
      this.prisma.return.aggregate({
        where: { returnDate: { gte: today, lt: tomorrow } },
        _sum: { totalRefund: true },
        _count: { id: true },
      }),
    ]);

    // Low stock: fetch all active and filter in-memory (same as ProductsService)
    const allProducts = await this.prisma.product.findMany({
      where: { isActive: true },
      select: { stockQuantity: true, minStockLevel: true },
    });
    const lowStockCount = allProducts.filter(
      (p) => p.stockQuantity <= p.minStockLevel,
    ).length;

    return {
      today: {
        salesCount: todaySales._count.id,
        salesRevenue: Number(todaySales._sum.totalAmount ?? 0),
        returnsCount: todayReturns._count.id,
        refundsTotal: Number(todayReturns._sum.totalRefund ?? 0),
      },
      inventory: {
        totalActiveProducts: totalProducts,
        lowStockProducts: lowStockCount,
        pendingPurchaseOrders: pendingOrders,
      },
      customers: {
        totalActive: totalCustomers,
      },
    };
  }

  // ─────────────────────────────────────────────
  // 2. SALES REPORT
  // ─────────────────────────────────────────────
  async getSalesReport(params: {
    startDate: string;
    endDate: string;
    groupBy?: 'day' | 'week' | 'month';
    cashierId?: string;
    paymentMethod?: string;
  }) {
    const {
      startDate,
      endDate,
      groupBy = 'day',
      cashierId,
      paymentMethod,
    } = params;

    const start = new Date(startDate);
    const end = new Date(endDate + 'T23:59:59.999Z');

    const where: any = {
      status: SaleStatus.COMPLETED,
      saleDate: { gte: start, lte: end },
    };
    if (cashierId) where.cashierId = cashierId;
    if (paymentMethod) where.paymentMethod = paymentMethod;

    // Overall totals for the period
    const summary = await this.prisma.sale.aggregate({
      where,
      _sum: {
        totalAmount: true,
        subtotal: true,
        discountAmount: true,
        taxAmount: true,
      },
      _count: { id: true },
      _avg: { totalAmount: true },
    });

    // Breakdown by payment method
    const byPaymentMethod = await this.prisma.sale.groupBy({
      by: ['paymentMethod'],
      where,
      _sum: { totalAmount: true },
      _count: { id: true },
    });

    // Breakdown by cashier
    const byCashier = await this.prisma.sale.groupBy({
      by: ['cashierId'],
      where,
      _sum: { totalAmount: true },
      _count: { id: true },
    });

    // Enrich cashier data with names
    const cashierIds = byCashier.map((c) => c.cashierId);
    const cashiers = await this.prisma.user.findMany({
      where: { id: { in: cashierIds } },
      select: { id: true, name: true },
    });
    const cashierMap = Object.fromEntries(cashiers.map((c) => [c.id, c.name]));

    // Daily/weekly/monthly breakdown using raw SQL
    const dateTrunc =
      groupBy === 'month' ? 'month' : groupBy === 'week' ? 'week' : 'day';

    const grouped: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT
        DATE_TRUNC('${dateTrunc}', "sale_date") AS period,
        COUNT(*)::int AS sale_count,
        SUM("total_amount")::float AS revenue
      FROM sales
      WHERE status = 'COMPLETED'
        AND "sale_date" >= '${start.toISOString()}'
        AND "sale_date" <= '${end.toISOString()}'
        ${cashierId ? `AND "cashier_id" = '${cashierId}'` : ''}
        ${paymentMethod ? `AND "payment_method" = '${paymentMethod}'` : ''}
      GROUP BY period
      ORDER BY period ASC
    `);

    return {
      period: { startDate, endDate },
      summary: {
        totalSales: summary._count.id,
        totalRevenue: Number(summary._sum.totalAmount ?? 0),
        totalSubtotal: Number(summary._sum.subtotal ?? 0),
        totalDiscount: Number(summary._sum.discountAmount ?? 0),
        totalTax: Number(summary._sum.taxAmount ?? 0),
        averageSaleValue: Number(summary._avg.totalAmount ?? 0),
      },
      byPaymentMethod: byPaymentMethod.map((p) => ({
        method: p.paymentMethod,
        count: p._count.id,
        total: Number(p._sum.totalAmount ?? 0),
      })),
      byCashier: byCashier.map((c) => ({
        cashierId: c.cashierId,
        cashierName: cashierMap[c.cashierId] ?? 'Unknown',
        count: c._count.id,
        total: Number(c._sum.totalAmount ?? 0),
      })),
      trend: grouped.map((row) => ({
        period: row.period,
        saleCount: row.sale_count,
        revenue: row.revenue,
      })),
    };
  }

  // ─────────────────────────────────────────────
  // 3. TOP SELLING PRODUCTS REPORT
  // ─────────────────────────────────────────────
  async getTopProductsReport(params: {
    startDate: string;
    endDate: string;
    limit?: number;
    categoryId?: string;
  }) {
    const { startDate, endDate, limit = 10, categoryId } = params;

    const start = new Date(startDate);
    const end = new Date(endDate + 'T23:59:59.999Z');

    const categoryFilter = categoryId
      ? `AND p."category_id" = '${categoryId}'`
      : '';

    const rows: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT
        si."product_id",
        si."product_name",
        si."product_sku",
        SUM(si."quantity")::int AS total_qty_sold,
        SUM(si."line_total")::float AS total_revenue,
        COUNT(DISTINCT si."sale_id")::int AS appeared_in_sales,
        p."stock_quantity"::int AS current_stock
      FROM sale_items si
      INNER JOIN sales s ON s.id = si."sale_id"
      INNER JOIN products p ON p.id = si."product_id"
      WHERE s.status = 'COMPLETED'
        AND s."sale_date" >= '${start.toISOString()}'
        AND s."sale_date" <= '${end.toISOString()}'
        ${categoryFilter}
      GROUP BY si."product_id", si."product_name", si."product_sku", p."stock_quantity"
      ORDER BY total_qty_sold DESC
      LIMIT ${limit}
    `);

    return {
      period: { startDate, endDate },
      topProducts: rows.map((row, index) => ({
        rank: index + 1,
        productId: row.product_id,
        name: row.product_name,
        sku: row.product_sku,
        totalQtySold: row.total_qty_sold,
        totalRevenue: row.total_revenue,
        appearedInSales: row.appeared_in_sales,
        currentStock: row.current_stock,
      })),
    };
  }

  // ─────────────────────────────────────────────
  // 4. INVENTORY REPORT
  // ─────────────────────────────────────────────
  async getInventoryReport(params: {
    categoryId?: string;
    supplierId?: string;
  }) {
    const { categoryId, supplierId } = params;

    const where: any = { isActive: true };
    if (categoryId) where.categoryId = categoryId;
    if (supplierId) where.supplierId = supplierId;

    const products = await this.prisma.product.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
      },
      orderBy: { stockQuantity: 'asc' },
    });

    const summary = {
      totalProducts: products.length,
      outOfStock: products.filter((p) => p.stockQuantity === 0).length,
      lowStock: products.filter(
        (p) => p.stockQuantity <= p.minStockLevel && p.stockQuantity > 0,
      ).length,
      adequateStock: products.filter((p) => p.stockQuantity > p.minStockLevel)
        .length,
      totalStockValue: products.reduce(
        (sum, p) => sum + Number(p.costPrice) * p.stockQuantity,
        0,
      ),
      totalRetailValue: products.reduce(
        (sum, p) => sum + Number(p.sellingPrice) * p.stockQuantity,
        0,
      ),
    };

    return {
      summary,
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category?.name ?? 'Uncategorized',
        supplier: p.supplier?.name ?? 'No supplier',
        stockQuantity: p.stockQuantity,
        minStockLevel: p.minStockLevel,
        unit: p.unit,
        costPrice: Number(p.costPrice),
        sellingPrice: Number(p.sellingPrice),
        stockValue: Number(p.costPrice) * p.stockQuantity,
        retailValue: Number(p.sellingPrice) * p.stockQuantity,
        stockStatus:
          p.stockQuantity === 0
            ? 'OUT_OF_STOCK'
            : p.stockQuantity <= p.minStockLevel
              ? 'LOW_STOCK'
              : 'ADEQUATE',
      })),
    };
  }

  // ─────────────────────────────────────────────
  // 5. PROFIT & LOSS REPORT
  // ─────────────────────────────────────────────
  async getProfitLossReport(params: { startDate: string; endDate: string }) {
    const { startDate, endDate } = params;
    const start = new Date(startDate);
    const end = new Date(endDate + 'T23:59:59.999Z');

    // Revenue = sum of completed sale totals
    const revenueData = await this.prisma.sale.aggregate({
      where: {
        status: SaleStatus.COMPLETED,
        saleDate: { gte: start, lte: end },
      },
      _sum: { totalAmount: true, discountAmount: true, taxAmount: true },
      _count: { id: true },
    });

    // Cost of Goods Sold = sum of (costPrice * qty) for all items in completed sales
    const cogsRows: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT SUM(p."cost_price" * si."quantity")::float AS cogs
      FROM sale_items si
      INNER JOIN sales s ON s.id = si."sale_id"
      INNER JOIN products p ON p.id = si."product_id"
      WHERE s.status = 'COMPLETED'
        AND s."sale_date" >= '${start.toISOString()}'
        AND s."sale_date" <= '${end.toISOString()}'
    `);
    const cogs = cogsRows[0]?.cogs ?? 0;

    // Total refunds issued in period
    const refundData = await this.prisma.return.aggregate({
      where: { returnDate: { gte: start, lte: end } },
      _sum: { totalRefund: true },
      _count: { id: true },
    });

    // Purchase spend in period (received orders only)
    const purchaseData = await this.prisma.purchaseOrder.aggregate({
      where: {
        status: 'RECEIVED',
        receivedDate: { gte: start, lte: end },
      },
      _sum: { totalAmount: true },
      _count: { id: true },
    });

    const grossRevenue = Number(revenueData._sum.totalAmount ?? 0);
    const totalRefunds = Number(refundData._sum.totalRefund ?? 0);
    const netRevenue = grossRevenue - totalRefunds;
    const grossProfit = netRevenue - cogs;
    const totalTax = Number(revenueData._sum.taxAmount ?? 0);
    const totalDiscount = Number(revenueData._sum.discountAmount ?? 0);
    const totalPurchases = Number(purchaseData._sum.totalAmount ?? 0);
    const grossMarginPct =
      netRevenue > 0 ? ((grossProfit / netRevenue) * 100).toFixed(2) : '0.00';

    return {
      period: { startDate, endDate },
      revenue: {
        grossRevenue,
        totalDiscount,
        totalTax,
        totalRefunds,
        netRevenue,
        salesCount: revenueData._count.id,
        returnsCount: refundData._count.id,
      },
      costs: {
        costOfGoodsSold: cogs,
        totalPurchaseSpend: totalPurchases,
        purchaseOrdersReceived: purchaseData._count.id,
      },
      profit: {
        grossProfit,
        grossMarginPercent: Number(grossMarginPct),
      },
    };
  }

  // ─────────────────────────────────────────────
  // 6. PURCHASE REPORT
  // ─────────────────────────────────────────────
  async getPurchaseReport(params: {
    startDate: string;
    endDate: string;
    supplierId?: string;
  }) {
    const { startDate, endDate, supplierId } = params;
    const start = new Date(startDate);
    const end = new Date(endDate + 'T23:59:59.999Z');

    const where: any = {
      orderDate: { gte: start, lte: end },
    };
    if (supplierId) where.supplierId = supplierId;

    const summary = await this.prisma.purchaseOrder.aggregate({
      where,
      _sum: { totalAmount: true },
      _count: { id: true },
    });

    const byStatus = await this.prisma.purchaseOrder.groupBy({
      by: ['status'],
      where,
      _sum: { totalAmount: true },
      _count: { id: true },
    });

    const bySupplier = await this.prisma.purchaseOrder.groupBy({
      by: ['supplierId'],
      where,
      _sum: { totalAmount: true },
      _count: { id: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
    });

    const supplierIds = bySupplier.map((s) => s.supplierId);
    const suppliers = await this.prisma.supplier.findMany({
      where: { id: { in: supplierIds } },
      select: { id: true, name: true },
    });
    const supplierMap = Object.fromEntries(
      suppliers.map((s) => [s.id, s.name]),
    );

    return {
      period: { startDate, endDate },
      summary: {
        totalOrders: summary._count.id,
        totalAmount: Number(summary._sum.totalAmount ?? 0),
      },
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count.id,
        total: Number(s._sum.totalAmount ?? 0),
      })),
      bySupplier: bySupplier.map((s) => ({
        supplierId: s.supplierId,
        supplierName: supplierMap[s.supplierId] ?? 'Unknown',
        orderCount: s._count.id,
        totalSpend: Number(s._sum.totalAmount ?? 0),
      })),
    };
  }

  // ─────────────────────────────────────────────
  // 7. CUSTOMER REPORT
  // ─────────────────────────────────────────────
  async getCustomerReport(params: {
    startDate: string;
    endDate: string;
    limit?: number;
  }) {
    const { startDate, endDate, limit = 10 } = params;
    const start = new Date(startDate);
    const end = new Date(endDate + 'T23:59:59.999Z');

    // Top customers by spend
    const topCustomers: any[] = await this.prisma.$queryRawUnsafe(`
      SELECT
        c.id AS customer_id,
        c.name AS customer_name,
        c.phone,
        c."loyalty_points",
        COUNT(s.id)::int AS total_sales,
        SUM(s."total_amount")::float AS total_spend,
        MAX(s."sale_date") AS last_purchase
      FROM customers c
      INNER JOIN sales s ON s."customer_id" = c.id
      WHERE s.status = 'COMPLETED'
        AND s."sale_date" >= '${start.toISOString()}'
        AND s."sale_date" <= '${end.toISOString()}'
      GROUP BY c.id, c.name, c.phone, c."loyalty_points"
      ORDER BY total_spend DESC
      LIMIT ${limit}
    `);

    // Walk-in sales stats
    const walkInStats = await this.prisma.sale.aggregate({
      where: {
        customerId: null,
        status: SaleStatus.COMPLETED,
        saleDate: { gte: start, lte: end },
      },
      _sum: { totalAmount: true },
      _count: { id: true },
    });

    return {
      period: { startDate, endDate },
      topCustomers: topCustomers.map((c, i) => ({
        rank: i + 1,
        customerId: c.customer_id,
        name: c.customer_name,
        phone: c.phone,
        loyaltyPoints: c.loyalty_points,
        totalSales: c.total_sales,
        totalSpend: c.total_spend,
        lastPurchase: c.last_purchase,
      })),
      walkIn: {
        salesCount: walkInStats._count.id,
        totalRevenue: Number(walkInStats._sum.totalAmount ?? 0),
      },
    };
  }
}

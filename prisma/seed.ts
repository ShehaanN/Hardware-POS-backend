import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import * as bcrypt from 'bcryptjs';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  console.log('🌱 Seeding database...\n');

  // ── Users ──────────────────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@pos.com' },
    update: {},
    create: {
      name: 'System Administrator',
      email: 'admin@pos.com',
      password: adminPassword,
      role: 'ADMIN',
    },
  });
  console.log(`✅ User:     ${admin.email} (ADMIN)`);

  const managerPassword = await bcrypt.hash('manager123', 10);
  const manager = await prisma.user.upsert({
    where: { email: 'manager@pos.com' },
    update: {},
    create: {
      name: 'Store Manager',
      email: 'manager@pos.com',
      password: managerPassword,
      role: 'MANAGER',
    },
  });
  console.log(`✅ User:     ${manager.email} (MANAGER)`);

  const cashierPassword = await bcrypt.hash('cashier123', 10);
  const cashier = await prisma.user.upsert({
    where: { email: 'cashier@pos.com' },
    update: {},
    create: {
      name: 'Store Cashier',
      email: 'cashier@pos.com',
      password: cashierPassword,
      role: 'CASHIER',
    },
  });
  console.log(`✅ User:     ${cashier.email} (CASHIER)\n`);

  // ── Categories ─────────────────────────────────────────────────────────────
  const categoryData = [
    {
      name: 'Hand Tools',
      description:
        'Manual hand tools — hammers, screwdrivers, pliers, wrenches',
    },
    {
      name: 'Power Tools',
      description:
        'Electric and battery-powered tools — drills, grinders, saws',
    },
    {
      name: 'Fasteners',
      description: 'Screws, bolts, nuts, nails, and anchors',
    },
    {
      name: 'Plumbing',
      description: 'Pipes, fittings, valves, and plumbing supplies',
    },
    {
      name: 'Electrical',
      description: 'Wiring, switches, outlets, and electrical components',
    },
    {
      name: 'Paint & Supplies',
      description:
        'Paints, primers, brushes, rollers, and painting accessories',
    },
    {
      name: 'Safety Equipment',
      description: 'Helmets, gloves, goggles, and safety gear',
    },
    {
      name: 'Adhesives',
      description: 'Glues, sealants, tapes, and bonding materials',
    },
  ];

  const catIds: Record<string, string> = {};
  for (const cat of categoryData) {
    const record = await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
    catIds[cat.name] = record.id;
    console.log(`✅ Category: ${cat.name}`);
  }
  console.log();

  // ── Suppliers ──────────────────────────────────────────────────────────────
  const supplierData = [
    {
      name: 'Hardware Wholesale Co.',
      contactPerson: 'John Smith',
      email: 'orders@hardwarewholesale.com',
      phone: '+1-555-0100',
      address: '123 Industrial Park Ave, Springfield',
    },
    {
      name: 'PowerTool Distributors Ltd.',
      contactPerson: 'Sarah Johnson',
      email: 'sales@powertooddist.com',
      phone: '+1-555-0200',
      address: '456 Commerce Blvd, Shelbyville',
    },
    {
      name: 'FastenerWorld Inc.',
      contactPerson: 'Mike Davis',
      email: 'info@fastenerworld.com',
      phone: '+1-555-0300',
      address: '789 Manufacturing Rd, Capital City',
    },
  ];

  const supIds: Record<string, string> = {};
  for (const sup of supplierData) {
    const record = await prisma.supplier.upsert({
      where: { email: sup.email },
      update: {},
      create: sup,
    });
    supIds[sup.name] = record.id;
    console.log(`✅ Supplier: ${sup.name}`);
  }
  console.log();

  // ── Products ───────────────────────────────────────────────────────────────
  const products = [
    // Hand Tools
    {
      name: 'Claw Hammer 16oz',
      sku: 'HT-001',
      barcode: '1234567890001',
      description: '16oz forged steel claw hammer with fiberglass handle',
      costPrice: 12.0,
      sellingPrice: 24.99,
      stockQuantity: 50,
      minStockLevel: 10,
      unit: 'pcs',
      categoryId: catIds['Hand Tools'],
      supplierId: supIds['Hardware Wholesale Co.'],
    },
    {
      name: 'Screwdriver Set (6pc)',
      sku: 'HT-002',
      barcode: '1234567890002',
      description: '6-piece set — 3 flathead + 3 Phillips, ergonomic grip',
      costPrice: 8.5,
      sellingPrice: 18.99,
      stockQuantity: 40,
      minStockLevel: 8,
      unit: 'set',
      categoryId: catIds['Hand Tools'],
      supplierId: supIds['Hardware Wholesale Co.'],
    },
    {
      name: 'Adjustable Wrench 12"',
      sku: 'HT-003',
      barcode: '1234567890003',
      description: 'Heavy-duty chrome-vanadium adjustable wrench, 12 inch',
      costPrice: 9.0,
      sellingPrice: 19.99,
      stockQuantity: 35,
      minStockLevel: 7,
      unit: 'pcs',
      categoryId: catIds['Hand Tools'],
      supplierId: supIds['Hardware Wholesale Co.'],
    },
    {
      name: 'Needle-Nose Pliers',
      sku: 'HT-004',
      barcode: '1234567890004',
      description: 'Precision needle-nose pliers with side cutter, 6 inch',
      costPrice: 5.0,
      sellingPrice: 11.99,
      stockQuantity: 45,
      minStockLevel: 10,
      unit: 'pcs',
      categoryId: catIds['Hand Tools'],
      supplierId: supIds['Hardware Wholesale Co.'],
    },
    // Power Tools
    {
      name: 'Cordless Drill 18V',
      sku: 'PT-001',
      barcode: '1234567890005',
      description:
        '18V brushless cordless drill with 2x 2Ah batteries and charger',
      costPrice: 75.0,
      sellingPrice: 149.99,
      stockQuantity: 15,
      minStockLevel: 3,
      unit: 'pcs',
      categoryId: catIds['Power Tools'],
      supplierId: supIds['PowerTool Distributors Ltd.'],
    },
    {
      name: 'Angle Grinder 4.5"',
      sku: 'PT-002',
      barcode: '1234567890006',
      description: '850W angle grinder with 4.5" disc, variable speed',
      costPrice: 38.0,
      sellingPrice: 79.99,
      stockQuantity: 20,
      minStockLevel: 4,
      unit: 'pcs',
      categoryId: catIds['Power Tools'],
      supplierId: supIds['PowerTool Distributors Ltd.'],
    },
    {
      name: 'Circular Saw 7.25"',
      sku: 'PT-003',
      barcode: '1234567890007',
      description: '1200W circular saw with 7.25" blade, laser guide',
      costPrice: 55.0,
      sellingPrice: 119.99,
      stockQuantity: 10,
      minStockLevel: 2,
      unit: 'pcs',
      categoryId: catIds['Power Tools'],
      supplierId: supIds['PowerTool Distributors Ltd.'],
    },
    // Fasteners
    {
      name: 'Wood Screws 3" (Box/100)',
      sku: 'FA-001',
      barcode: '1234567890008',
      description: 'Zinc-plated wood screws, #10 x 3", 100-piece box',
      costPrice: 3.5,
      sellingPrice: 8.99,
      stockQuantity: 100,
      minStockLevel: 20,
      unit: 'box',
      categoryId: catIds['Fasteners'],
      supplierId: supIds['FastenerWorld Inc.'],
    },
    {
      name: 'Hex Bolts M8x50 (Bag/25)',
      sku: 'FA-002',
      barcode: '1234567890009',
      description: 'Grade 8.8 hex head bolts M8 x 50mm, 25-piece bag',
      costPrice: 4.0,
      sellingPrice: 9.99,
      stockQuantity: 80,
      minStockLevel: 15,
      unit: 'bag',
      categoryId: catIds['Fasteners'],
      supplierId: supIds['FastenerWorld Inc.'],
    },
    {
      name: 'Concrete Anchor 3/8" (Box/50)',
      sku: 'FA-003',
      barcode: '1234567890010',
      description: 'Wedge anchor bolts 3/8" x 3", 50-piece box',
      costPrice: 12.0,
      sellingPrice: 27.99,
      stockQuantity: 40,
      minStockLevel: 8,
      unit: 'box',
      categoryId: catIds['Fasteners'],
      supplierId: supIds['FastenerWorld Inc.'],
    },
    // Plumbing
    {
      name: 'PVC Pipe 1/2" x 10ft',
      sku: 'PL-001',
      barcode: '1234567890011',
      description: 'Schedule 40 PVC pressure pipe, 1/2" diameter, 10 feet',
      costPrice: 2.8,
      sellingPrice: 6.49,
      stockQuantity: 60,
      minStockLevel: 10,
      unit: 'pcs',
      categoryId: catIds['Plumbing'],
      supplierId: supIds['Hardware Wholesale Co.'],
    },
    {
      name: 'Ball Valve 3/4" Brass',
      sku: 'PL-002',
      barcode: '1234567890012',
      description: 'Full-port brass ball valve, 3/4" NPT threaded',
      costPrice: 6.5,
      sellingPrice: 14.99,
      stockQuantity: 30,
      minStockLevel: 6,
      unit: 'pcs',
      categoryId: catIds['Plumbing'],
      supplierId: supIds['Hardware Wholesale Co.'],
    },
    // Electrical
    {
      name: 'Electrical Wire 12AWG (50ft)',
      sku: 'EL-001',
      barcode: '1234567890013',
      description: 'THHN copper wire, 12 AWG, 50ft roll, black',
      costPrice: 14.0,
      sellingPrice: 32.99,
      stockQuantity: 25,
      minStockLevel: 5,
      unit: 'roll',
      categoryId: catIds['Electrical'],
      supplierId: supIds['Hardware Wholesale Co.'],
    },
    {
      name: 'Outlet Receptacle 15A',
      sku: 'EL-002',
      barcode: '1234567890014',
      description: 'Duplex outlet, 15A 125V, Tamper-Resistant, white',
      costPrice: 2.2,
      sellingPrice: 5.49,
      stockQuantity: 70,
      minStockLevel: 15,
      unit: 'pcs',
      categoryId: catIds['Electrical'],
      supplierId: supIds['Hardware Wholesale Co.'],
    },
    // Paint & Supplies
    {
      name: 'Interior Paint 1 Gallon (White)',
      sku: 'PA-001',
      barcode: '1234567890015',
      description: 'Premium interior latex paint, flat finish, 1 gallon',
      costPrice: 15.0,
      sellingPrice: 34.99,
      stockQuantity: 30,
      minStockLevel: 6,
      unit: 'gallon',
      categoryId: catIds['Paint & Supplies'],
      supplierId: supIds['Hardware Wholesale Co.'],
    },
    {
      name: 'Paint Roller Set 9"',
      sku: 'PA-002',
      barcode: '1234567890016',
      description: '9" paint roller frame with 2 covers and tray',
      costPrice: 5.5,
      sellingPrice: 12.99,
      stockQuantity: 25,
      minStockLevel: 5,
      unit: 'set',
      categoryId: catIds['Paint & Supplies'],
      supplierId: supIds['Hardware Wholesale Co.'],
    },
    // Safety
    {
      name: 'Safety Hard Hat (Yellow)',
      sku: 'SF-001',
      barcode: '1234567890017',
      description: 'ANSI Z89.1 Type I Class E hard hat, adjustable, yellow',
      costPrice: 7.0,
      sellingPrice: 16.99,
      stockQuantity: 20,
      minStockLevel: 4,
      unit: 'pcs',
      categoryId: catIds['Safety Equipment'],
      supplierId: supIds['Hardware Wholesale Co.'],
    },
    {
      name: 'Work Gloves (Pair)',
      sku: 'SF-002',
      barcode: '1234567890018',
      description: 'Cut-resistant leather work gloves, Size L',
      costPrice: 4.0,
      sellingPrice: 9.99,
      stockQuantity: 50,
      minStockLevel: 10,
      unit: 'pair',
      categoryId: catIds['Safety Equipment'],
      supplierId: supIds['Hardware Wholesale Co.'],
    },
  ];

  for (const p of products) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      update: {},
      create: p,
    });
    console.log(`✅ Product:  ${p.name}`);
  }
  console.log();

  // ── Customers ──────────────────────────────────────────────────────────────
  const customerData = [
    { name: 'Walk-in Customer', phone: '+1-000-0000' },
    {
      name: 'Bob the Builder',
      email: 'bob@construction.com',
      phone: '+1-555-1001',
      address: '10 Builder Lane',
    },
    {
      name: 'Alice Homeowner',
      email: 'alice@home.com',
      phone: '+1-555-1002',
      address: '22 Suburb St',
    },
    {
      name: 'Charlie Contractor',
      email: 'charlie@contracts.com',
      phone: '+1-555-1003',
      address: '45 Contractor Ave',
    },
  ];

  for (const c of customerData) {
    const existing = await prisma.customer.findFirst({
      where: {
        OR: [{ phone: c.phone }, ...(c.email ? [{ email: c.email }] : [])],
      },
    });
    if (!existing) {
      await prisma.customer.create({ data: c });
    }
    console.log(`✅ Customer: ${c.name}`);
  }
  console.log();

  console.log('🎉 Seeding complete!\n');
  console.log('  Credentials:');
  console.log('  ┌─────────────────────────┬──────────────┬─────────┐');
  console.log('  │ Email                   │ Password     │ Role    │');
  console.log('  ├─────────────────────────┼──────────────┼─────────┤');
  console.log('  │ admin@pos.com           │ admin123     │ ADMIN   │');
  console.log('  │ manager@pos.com         │ manager123   │ MANAGER │');
  console.log('  │ cashier@pos.com         │ cashier123   │ CASHIER │');
  console.log('  └─────────────────────────┴──────────────┴─────────┘\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

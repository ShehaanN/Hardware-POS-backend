import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

/**
 * E2E Tests — Hardware POS Backend
 *
 * These tests run against a REAL database.
 * Set DATABASE_URL in .env.test to a dedicated test database.
 * Run with: npm run test:e2e
 *
 * Test flow: Auth → Users → Categories → Products → Sales
 */
describe('Hardware POS — E2E', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let categoryId: string;
  let productId: string;
  let saleId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── AUTH ─────────────────────────────────────────────────────────────────

  describe('POST /auth/register', () => {
    it('should register a new user (CASHIER by default)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Test Cashier',
          email: 'cashier@e2e.com',
          password: 'password123',
        })
        .expect(201);

      expect(res.body).toHaveProperty('email', 'cashier@e2e.com');
      expect(res.body).not.toHaveProperty('password');
    });

    it('should return 409 on duplicate email', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Dup',
          email: 'cashier@e2e.com',
          password: 'password123',
        })
        .expect(409);
    });
  });

  describe('POST /auth/login', () => {
    it('should return 401 with wrong password', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'cashier@e2e.com', password: 'wrongpassword' })
        .expect(401);
    });

    it('should login and return access_token', async () => {
      // Use a pre-seeded ADMIN account — seed one first or create via Prisma directly
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@pos.com', password: 'admin123' })
        .expect(201);

      expect(res.body).toHaveProperty('access_token');
      adminToken = res.body.access_token;
    });
  });

  // ── CATEGORIES ────────────────────────────────────────────────────────────

  describe('POST /categories', () => {
    it('should require authentication', async () => {
      await request(app.getHttpServer())
        .post('/categories')
        .send({ name: 'Test Cat' })
        .expect(401);
    });

    it('should create a category when authenticated', async () => {
      const res = await request(app.getHttpServer())
        .post('/categories')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Hand Tools', description: 'Manual hardware tools' })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('Hand Tools');
      categoryId = res.body.id;
    });
  });

  // ── PRODUCTS ──────────────────────────────────────────────────────────────

  describe('POST /products', () => {
    it('should create a product', async () => {
      const res = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Claw Hammer',
          sku: `HAMMER-E2E-${Date.now()}`,
          costPrice: 250,
          sellingPrice: 450,
          stockQuantity: 50,
          minStockLevel: 5,
          unit: 'pcs',
          categoryId,
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.sku).toContain('HAMMER-E2E');
      productId = res.body.id;
    });

    it('should return 409 on duplicate SKU', async () => {
      const sku = `DUPE-${Date.now()}`;
      await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'P1', sku, costPrice: 10, sellingPrice: 20 })
        .expect(201);

      await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'P2', sku, costPrice: 10, sellingPrice: 20 })
        .expect(409);
    });
  });

  describe('GET /products', () => {
    it('should return paginated product list', async () => {
      const res = await request(app.getHttpServer())
        .get('/products?page=1&limit=5')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(res.body).toHaveProperty('meta');
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ── SALES ────────────────────────────────────────────────────────────────

  describe('POST /sales', () => {
    it('should create a sale and return receipt', async () => {
      const res = await request(app.getHttpServer())
        .post('/sales')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          paymentMethod: 'CASH',
          amountPaid: 1000,
          items: [{ productId, quantity: 2 }],
        })
        .expect(201);

      expect(res.body).toHaveProperty('receipt');
      expect(res.body.receipt.totalAmount).toBe(900); // 450 * 2
      expect(res.body.receipt.changeGiven).toBe(100);
      saleId = res.body.receipt.saleNumber;
    });

    it('should return 400 if amountPaid is less than total', async () => {
      await request(app.getHttpServer())
        .post('/sales')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          paymentMethod: 'CASH',
          amountPaid: 1,
          items: [{ productId, quantity: 1 }],
        })
        .expect(400);
    });

    it('should return 400 if stock is insufficient', async () => {
      await request(app.getHttpServer())
        .post('/sales')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          paymentMethod: 'CASH',
          amountPaid: 999999,
          items: [{ productId, quantity: 99999 }],
        })
        .expect(400);
    });
  });

  // ── VALIDATION ───────────────────────────────────────────────────────────

  describe('Validation pipe', () => {
    it('should return 400 when required fields are missing', async () => {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'not-an-email' })
        .expect(400);
    });
  });
});

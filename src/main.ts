import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'warn', 'error', 'debug'],
  });

  const reflector = app.get(Reflector);

  // ── Global Exception Filter ──────────────────────────────────────────────
  app.useGlobalFilters(new AllExceptionsFilter());

  // ── Global Interceptors ──────────────────────────────────────────────────
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new ResponseTransformInterceptor(),
  );

  // ── Global Validation Pipe ───────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ── CORS ─────────────────────────────────────────────────────────────────
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? '*',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // ── API Prefix ───────────────────────────────────────────────────────────
  app.setGlobalPrefix('api', { exclude: ['api/docs'] });

  // ── Swagger ──────────────────────────────────────────────────────────────
  const config = new DocumentBuilder()
    .setTitle('Hardware POS API')
    .setDescription('Hardware Store Point of Sale — REST API')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addTag('Auth', 'Login and registration')
    .addTag('Users', 'User management')
    .addTag('Categories', 'Product categories')
    .addTag('Products', 'Product & inventory management')
    .addTag('Suppliers', 'Supplier management')
    .addTag('Purchase Orders', 'Stock purchasing')
    .addTag('Customers', 'Customer management')
    .addTag('Sales', 'POS sales transactions')
    .addTag('Returns', 'Returns & refunds')
    .addTag('Reports', 'Business intelligence reports')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT ?? 4000;
  await app.listen(port);

  Logger.log(
    `Application running on: http://localhost:${port}/api`,
    'Bootstrap',
  );
  Logger.log(`Swagger docs: http://localhost:${port}/api/docs`, 'Bootstrap');
}
bootstrap();

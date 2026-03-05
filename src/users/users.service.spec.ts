import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

// Mock the full PrismaService
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  // ── create() ────────────────────────────────────────────────────────────

  describe('create()', () => {
    const dto = {
      name: 'John',
      email: 'john@test.com',
      password: 'password123',
      role: 'CASHIER' as any,
    };

    it('should create a user and return result without password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-1',
        name: dto.name,
        email: dto.email,
        password: 'hashed',
        role: 'CASHIER',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.create(dto);

      expect(result).not.toHaveProperty('password');
      expect(result.email).toBe(dto.email);
      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictException if email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('should hash the password before saving', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: 'u1',
        name: 'John',
        email: dto.email,
        password: 'hashed',
        role: 'CASHIER',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await service.create(dto);

      const createCall = mockPrisma.user.create.mock.calls[0][0];
      expect(createCall.data.password).not.toBe(dto.password);
      const isHashed = await bcrypt.compare(
        dto.password,
        createCall.data.password,
      );
      expect(isHashed).toBe(true);
    });
  });

  // ── findOne() ───────────────────────────────────────────────────────────

  describe('findOne()', () => {
    it('should return user without password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        name: 'John',
        email: 'john@test.com',
        password: 'hashed',
        role: 'CASHIER',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.findOne('u1');
      expect(result).not.toHaveProperty('password');
      expect(result.id).toBe('u1');
    });

    it('should throw NotFoundException when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── deactivate() ─────────────────────────────────────────────────────────

  describe('deactivate()', () => {
    it('should set isActive to false', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        name: 'John',
        email: 'john@test.com',
        password: 'hashed',
        role: 'CASHIER',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockPrisma.user.update.mockResolvedValue({ id: 'u1', isActive: false });

      await service.deactivate('u1');

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { isActive: false },
      });
    });
  });
});

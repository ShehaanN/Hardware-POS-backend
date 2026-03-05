import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

const mockUsersService = {
  findByEmail: jest.fn(),
  create: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  // ── login() ──────────────────────────────────────────────────────────────

  describe('login()', () => {
    const mockUser = {
      id: 'u1',
      name: 'Admin',
      email: 'admin@test.com',
      password: bcrypt.hashSync('correctpassword', 10),
      role: 'ADMIN',
      isActive: true,
    };

    it('should return access_token and user on valid credentials', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);

      const result = await service.login({
        email: 'admin@test.com',
        password: 'correctpassword',
      });

      expect(result).toHaveProperty('access_token', 'mock-jwt-token');
      expect(result.user).toHaveProperty('id', 'u1');
      expect(result.user).not.toHaveProperty('password');
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: 'u1',
        email: 'admin@test.com',
        role: 'ADMIN',
      });
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      mockUsersService.findByEmail.mockResolvedValue(mockUser);

      await expect(
        service.login({ email: 'admin@test.com', password: 'wrongpassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@test.com', password: 'anything' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user is inactive', async () => {
      mockUsersService.findByEmail.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });

      await expect(
        service.login({ email: 'admin@test.com', password: 'correctpassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── register() ───────────────────────────────────────────────────────────

  describe('register()', () => {
    it('should call UsersService.create with role CASHIER', async () => {
      mockUsersService.create.mockResolvedValue({
        id: 'u2',
        name: 'New User',
        email: 'new@test.com',
        role: 'CASHIER',
      });

      const dto = {
        name: 'New User',
        email: 'new@test.com',
        password: 'pass123',
      };
      await service.register(dto);

      expect(mockUsersService.create).toHaveBeenCalledWith({
        ...dto,
        role: 'CASHIER',
      });
    });
  });
});

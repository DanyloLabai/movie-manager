import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { of } from 'rxjs';
import { AuthService } from '../auth.service';
import { User } from '../../users/users.entity';

// Mock bcrypt before imports take effect
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn().mockResolvedValue(true),
  genSalt: jest.fn().mockResolvedValue('salt'),
}));

// Mock resend module
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ id: 'mock-email-id' }),
    },
  })),
}));

const mockUser: Partial<User> = {
  id: 1,
  username: 'testuser',
  email: 'test@example.com',
  password: '$2a$10$hashedpassword',
  isVerified: true,
  verificationToken: null,
  resetToken: null,
};

const mockUsersRepository = {
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
};

const mockJwtService = {
  signAsync: jest.fn().mockResolvedValue('mock-jwt-token'),
};

const mockHttpService = {
  post: jest.fn().mockReturnValue(of({ data: { success: true } })),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    const config: Record<string, string> = {
      RESEND_API_KEY: 'test-resend-key',
      FRONTEND_URL: 'http://localhost:5173',
      RECAPTCHA_SECRET_KEY: 'test-captcha-key',
    };
    return config[key];
  }),
};

describe('AuthService', () => {
  let service: AuthService;
  let usersRepository: jest.Mocked<Repository<User>>;
  let jwtService: jest.Mocked<JwtService>;

  beforeAll(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: mockUsersRepository },
        { provide: JwtService, useValue: mockJwtService },
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersRepository = module.get(getRepositoryToken(User));
    jwtService = module.get(JwtService);

    jest.clearAllMocks();

    // Default: captcha always passes
    mockHttpService.post.mockReturnValue(of({ data: { success: true } }));
  });

  // ─── signUp ───────────────────────────────────────────────────────────────

  describe('signUp', () => {
    const signUpDto = {
      email: 'new@example.com',
      password: 'Password123!',
      username: 'newuser',
      captchaToken: 'valid-token',
    };

    it('should register a new user and return success message', async () => {
      mockUsersRepository.findOne.mockResolvedValue(null);
      mockUsersRepository.create.mockReturnValue({ ...mockUser, id: 2 });
      mockUsersRepository.save.mockResolvedValue({ ...mockUser, id: 2 });

      const result = await service.signUp(signUpDto);

      expect(result.message).toContain('Successfully registered');
      expect(mockUsersRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictException when email or username already exists', async () => {
      mockUsersRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.signUp(signUpDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw BadRequestException when captcha is invalid', async () => {
      mockHttpService.post.mockReturnValue(of({ data: { success: false } }));

      await expect(service.signUp(signUpDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should rollback user creation if email sending fails', async () => {
      mockUsersRepository.findOne.mockResolvedValue(null);
      const createdUser = { ...mockUser, id: 2 };
      mockUsersRepository.create.mockReturnValue(createdUser);
      mockUsersRepository.save.mockResolvedValue(createdUser);

      // Force email failure by importing the mocked Resend and making it reject
      const { Resend } = require('resend');
      Resend.mockImplementationOnce(() => ({
        emails: { send: jest.fn().mockRejectedValue(new Error('SMTP error')) },
      }));

      // Re-create service with failing email
      const failModule = await Test.createTestingModule({
        providers: [
          AuthService,
          { provide: getRepositoryToken(User), useValue: mockUsersRepository },
          { provide: JwtService, useValue: mockJwtService },
          { provide: HttpService, useValue: mockHttpService },
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();

      const failService = failModule.get<AuthService>(AuthService);

      await expect(failService.signUp(signUpDto)).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(mockUsersRepository.delete).toHaveBeenCalled();
    });
  });

  // ─── signIn ───────────────────────────────────────────────────────────────

  describe('signIn', () => {
    const signInDto = {
      email: 'test@example.com',
      password: 'correctPassword',
    };

    it('should return access_token and user on valid credentials', async () => {
      const bcrypt = require('bcryptjs');
      bcrypt.compare.mockResolvedValue(true);
      mockUsersRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.signIn(signInDto);

      expect(result.access_token).toBe('mock-jwt-token');
      expect(result.user.email).toBe('test@example.com');
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: mockUser.id,
        username: mockUser.username,
        email: mockUser.email,
      });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockUsersRepository.findOne.mockResolvedValue(null);

      await expect(service.signIn(signInDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if password does not match', async () => {
      const bcrypt = require('bcryptjs');
      bcrypt.compare.mockResolvedValue(false);
      mockUsersRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.signIn(signInDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if email is not verified', async () => {
      const bcrypt = require('bcryptjs');
      bcrypt.compare.mockResolvedValue(true);
      const unverifiedUser = { ...mockUser, isVerified: false };
      mockUsersRepository.findOne.mockResolvedValue(unverifiedUser);

      await expect(service.signIn(signInDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ─── changePassword ───────────────────────────────────────────────────────

  describe('changePassword', () => {
    const dto = {
      oldPassword: 'OldPass1!',
      newPassword: 'NewPass2!',
    };

    it('should update password successfully', async () => {
      const bcrypt = require('bcryptjs');
      bcrypt.compare.mockResolvedValue(true);
      bcrypt.hash.mockResolvedValue('newHashedPassword');
      mockUsersRepository.findOne.mockResolvedValue({ ...mockUser });
      mockUsersRepository.save.mockResolvedValue({});

      const result = await service.changePassword(mockUser.id!, dto);

      expect(result.message).toBe('Password updated successfully');
      expect(mockUsersRepository.save).toHaveBeenCalledTimes(1);
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockUsersRepository.findOne.mockResolvedValue(null);

      await expect(
        service.changePassword(mockUser.id!, dto),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw BadRequestException if old password is incorrect', async () => {
      const bcrypt = require('bcryptjs');
      bcrypt.compare.mockResolvedValue(false);
      mockUsersRepository.findOne.mockResolvedValue({ ...mockUser });

      await expect(
        service.changePassword(mockUser.id!, dto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── verifyEmail ──────────────────────────────────────────────────────────

  describe('verifyEmail', () => {
    it('should verify user email and clear token', async () => {
      const unverified = {
        ...mockUser,
        isVerified: false,
        verificationToken: 'valid-token-abc',
      };
      mockUsersRepository.findOne.mockResolvedValue(unverified);
      mockUsersRepository.save.mockResolvedValue({
        ...unverified,
        isVerified: true,
        verificationToken: null,
      });

      const result = await service.verifyEmail('valid-token-abc');

      expect(result.verified).toBe(true);
      expect(mockUsersRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isVerified: true, verificationToken: null }),
      );
    });

    it('should throw BadRequestException for invalid token', async () => {
      mockUsersRepository.findOne.mockResolvedValue(null);

      await expect(service.verifyEmail('bad-token')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ─── forgotPassword ───────────────────────────────────────────────────────

  describe('forgotPassword', () => {
    it('should return generic message if user does not exist (privacy)', async () => {
      mockUsersRepository.findOne.mockResolvedValue(null);

      const result = await service.forgotPassword('unknown@example.com');

      expect(result.message).toContain('If this email exists');
      expect(mockUsersRepository.save).not.toHaveBeenCalled();
    });

    it('should save reset token and send email for known user', async () => {
      mockUsersRepository.findOne.mockResolvedValue({ ...mockUser });
      mockUsersRepository.save.mockResolvedValue({});

      const result = await service.forgotPassword('test@example.com');

      expect(result.message).toContain('If this email exists');
      expect(mockUsersRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ resetToken: expect.any(String) }),
      );
    });
  });

  // ─── resetPassword ────────────────────────────────────────────────────────

  describe('resetPassword', () => {
    it('should reset password for valid token', async () => {
      const bcrypt = require('bcryptjs');
      bcrypt.hash.mockResolvedValue('hashedNewPass');
      const userWithToken = { ...mockUser, resetToken: 'valid-reset-token' };
      mockUsersRepository.findOne.mockResolvedValue(userWithToken);
      mockUsersRepository.save.mockResolvedValue({});

      const result = await service.resetPassword(
        'valid-reset-token',
        'NewPass1!',
      );

      expect(result.message).toBe('Password successfully reset!');
      expect(mockUsersRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ resetToken: null }),
      );
    });

    it('should throw BadRequestException for invalid reset token', async () => {
      mockUsersRepository.findOne.mockResolvedValue(null);

      await expect(
        service.resetPassword('invalid-token', 'NewPass1!'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── resendVerificationEmail ──────────────────────────────────────────────

  describe('resendVerificationEmail', () => {
    it('should return generic message if user does not exist (privacy)', async () => {
      mockUsersRepository.findOne.mockResolvedValue(null);

      const result = await service.resendVerificationEmail('noone@example.com');

      expect(result.message).toContain('If this email exists');
    });

    it('should throw BadRequestException if user is already verified', async () => {
      mockUsersRepository.findOne.mockResolvedValue({
        ...mockUser,
        isVerified: true,
      });

      await expect(
        service.resendVerificationEmail('test@example.com'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should send new verification email for unverified user', async () => {
      const unverified = {
        ...mockUser,
        isVerified: false,
        verificationToken: 'old-token',
      };
      mockUsersRepository.findOne.mockResolvedValue(unverified);
      mockUsersRepository.save.mockResolvedValue({});

      const result = await service.resendVerificationEmail('test@example.com');

      expect(result.message).toContain('If this email exists');
      expect(mockUsersRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ verificationToken: expect.any(String) }),
      );
    });
  });
});

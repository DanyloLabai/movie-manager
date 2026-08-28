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
import { of } from 'rxjs';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { Resend } from 'resend';
import { AuthService } from '../auth.service';
import { User } from '../../users/users.entity';
import { RefreshToken } from '../refresh-token.entity';

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn().mockResolvedValue(true),
  genSalt: jest.fn().mockResolvedValue('salt'),
}));

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ id: 'mock-email-id' }),
    },
  })),
}));

const mockedBcrypt = jest.mocked(bcrypt);
const MockedResend = jest.mocked(Resend);
const sha256 = (value: string) =>
  crypto.createHash('sha256').update(value).digest('hex');

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
  update: jest.fn(),
};

const mockRefreshTokensRepository = {
  findOne: jest.fn(),
  create: jest.fn((entity: object) => entity),
  save: jest.fn(),
  delete: jest.fn(),
};

const mockJwtService = {
  signAsync: jest.fn().mockResolvedValue('mock-jwt-token'),
  decode: jest.fn(),
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
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: mockRefreshTokensRepository,
        },
        { provide: JwtService, useValue: mockJwtService },
        { provide: HttpService, useValue: mockHttpService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);

    jest.clearAllMocks();

    mockHttpService.post.mockReturnValue(of({ data: { success: true } }));
  });

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

      MockedResend.mockImplementationOnce(
        () =>
          ({
            emails: {
              send: jest.fn().mockRejectedValue(new Error('SMTP error')),
            },
          }) as unknown as Resend,
      );

      const failModule = await Test.createTestingModule({
        providers: [
          AuthService,
          { provide: getRepositoryToken(User), useValue: mockUsersRepository },
          {
            provide: getRepositoryToken(RefreshToken),
            useValue: mockRefreshTokensRepository,
          },
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

  describe('signIn', () => {
    const signInDto = {
      email: 'test@example.com',
      password: 'correctPassword',
    };

    it('should return access_token and user on valid credentials', async () => {
      mockedBcrypt.compare.mockResolvedValue(true as never);
      mockUsersRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.signIn(signInDto);

      expect(result.access_token).toBe('mock-jwt-token');
      expect(result.user.email).toBe('test@example.com');
      expect(mockJwtService.signAsync).toHaveBeenCalledWith({
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
      mockedBcrypt.compare.mockResolvedValue(false as never);
      mockUsersRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.signIn(signInDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if email is not verified', async () => {
      mockedBcrypt.compare.mockResolvedValue(true as never);
      const unverifiedUser = { ...mockUser, isVerified: false };
      mockUsersRepository.findOne.mockResolvedValue(unverifiedUser);

      await expect(service.signIn(signInDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('refreshTokens', () => {
    const sessionId = 'session-1';
    const validSession = {
      id: sessionId,
      userId: mockUser.id,
      hashedToken: 'hashed-refresh-token',
      expiresAt: new Date(Date.now() + 60000),
    };

    it('should rotate the session and return new tokens on a valid refresh token', async () => {
      mockRefreshTokensRepository.findOne.mockResolvedValue(validSession);
      mockedBcrypt.compare.mockResolvedValue(true as never);
      mockUsersRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.refreshTokens(
        mockUser.id!,
        sessionId,
        'incoming-refresh-token',
      );

      expect(result.access_token).toBe('mock-jwt-token');
      expect(mockRefreshTokensRepository.delete).toHaveBeenCalledWith({
        id: sessionId,
      });
      expect(mockRefreshTokensRepository.save).toHaveBeenCalled();
    });

    it('should throw and revoke all sessions when the token does not match the stored hash (reuse/theft)', async () => {
      mockRefreshTokensRepository.findOne.mockResolvedValue(validSession);
      mockedBcrypt.compare.mockResolvedValue(false as never);

      await expect(
        service.refreshTokens(mockUser.id!, sessionId, 'stale-token'),
      ).rejects.toThrow(UnauthorizedException);

      expect(mockRefreshTokensRepository.delete).toHaveBeenCalledWith({
        userId: mockUser.id,
      });
    });

    it('should throw when the session does not exist', async () => {
      mockRefreshTokensRepository.findOne.mockResolvedValue(null);

      await expect(
        service.refreshTokens(mockUser.id!, sessionId, 'some-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw when the session has expired', async () => {
      mockRefreshTokensRepository.findOne.mockResolvedValue({
        ...validSession,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(
        service.refreshTokens(mockUser.id!, sessionId, 'some-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw when sessionId or refresh token is missing', async () => {
      await expect(
        service.refreshTokens(mockUser.id!, null, 'some-token'),
      ).rejects.toThrow(UnauthorizedException);

      await expect(
        service.refreshTokens(mockUser.id!, sessionId, null),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should delete only the current session when the refresh token decodes a jti', async () => {
      mockJwtService.decode.mockReturnValue({ jti: 'session-1' });

      const result = await service.logout(mockUser.id!, 'a-refresh-token');

      expect(result.message).toBe('Logged out successfully');
      expect(mockRefreshTokensRepository.delete).toHaveBeenCalledWith({
        id: 'session-1',
        userId: mockUser.id,
      });
    });

    it('should not touch the sessions table when no refresh token is provided', async () => {
      const result = await service.logout(mockUser.id!, null);

      expect(result.message).toBe('Logged out successfully');
      expect(mockRefreshTokensRepository.delete).not.toHaveBeenCalled();
    });
  });

  describe('changePassword', () => {
    const dto = {
      oldPassword: 'OldPass1!',
      newPassword: 'NewPass2!',
    };

    it('should update password successfully', async () => {
      mockedBcrypt.compare.mockResolvedValue(true as never);
      mockedBcrypt.hash.mockResolvedValue('newHashedPassword' as never);
      mockUsersRepository.findOne.mockResolvedValue({ ...mockUser });
      mockUsersRepository.save.mockResolvedValue({});

      const result = await service.changePassword(mockUser.id!, dto);

      expect(result.message).toBe('Password updated successfully');
      expect(mockUsersRepository.save).toHaveBeenCalledTimes(1);
      expect(mockRefreshTokensRepository.delete).toHaveBeenCalledWith({
        userId: mockUser.id,
      });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockUsersRepository.findOne.mockResolvedValue(null);

      await expect(service.changePassword(mockUser.id!, dto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw BadRequestException if old password is incorrect', async () => {
      mockedBcrypt.compare.mockResolvedValue(false as never);
      mockUsersRepository.findOne.mockResolvedValue({ ...mockUser });

      await expect(service.changePassword(mockUser.id!, dto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('verifyEmail', () => {
    it('should verify user email and clear token', async () => {
      const unverified = {
        ...mockUser,
        isVerified: false,
        verificationToken: 'valid-token-abc',
        verificationTokenExpiresAt: new Date(Date.now() + 60000),
      };
      mockUsersRepository.findOne.mockResolvedValue(unverified);
      mockUsersRepository.save.mockResolvedValue({
        ...unverified,
        isVerified: true,
        verificationToken: null,
      });

      const result = await service.verifyEmail('valid-token-abc');

      expect(result.verified).toBe(true);
      expect(mockUsersRepository.findOne).toHaveBeenCalledWith({
        where: { verificationToken: sha256('valid-token-abc') },
      });
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
        expect.objectContaining({
          resetToken: expect.any(String) as string,
        }),
      );
    });
  });

  describe('resetPassword', () => {
    it('should reset password for valid token', async () => {
      mockedBcrypt.hash.mockResolvedValue('hashedNewPass' as never);
      const userWithToken = {
        ...mockUser,
        resetToken: 'valid-reset-token',
        resetTokenExpiresAt: new Date(Date.now() + 60000),
      };
      mockUsersRepository.findOne.mockResolvedValue(userWithToken);
      mockUsersRepository.save.mockResolvedValue({});

      const result = await service.resetPassword(
        'valid-reset-token',
        'NewPass1!',
      );

      expect(result.message).toBe('Password successfully reset!');
      expect(mockUsersRepository.findOne).toHaveBeenCalledWith({
        where: { resetToken: sha256('valid-reset-token') },
      });
      expect(mockUsersRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ resetToken: null }),
      );
      expect(mockRefreshTokensRepository.delete).toHaveBeenCalledWith({
        userId: mockUser.id,
      });
    });

    it('should throw BadRequestException for invalid reset token', async () => {
      mockUsersRepository.findOne.mockResolvedValue(null);

      await expect(
        service.resetPassword('invalid-token', 'NewPass1!'),
      ).rejects.toThrow(BadRequestException);
    });
  });

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
        expect.objectContaining({
          verificationToken: expect.any(String) as string,
        }),
      );
    });
  });
});

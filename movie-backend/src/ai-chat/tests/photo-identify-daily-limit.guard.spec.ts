import { ExecutionContext, HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PhotoIdentifyDailyLimitGuard } from '../photo-identify-daily-limit.guard';
import { AiUsageLogService } from '../ai-usage-log.service';
import { User } from '../../users/users.entity';

const mockAiUsageLogService = {
  getUserUsageSince: jest.fn(),
};

const mockUsersRepository = {
  findOne: jest.fn(),
};

const mockConfigService = {
  get: jest.fn().mockReturnValue(undefined),
};

const buildContext = (userId?: number): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ user: userId ? { userId } : undefined }),
    }),
  }) as unknown as ExecutionContext;

describe('PhotoIdentifyDailyLimitGuard', () => {
  let guard: PhotoIdentifyDailyLimitGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PhotoIdentifyDailyLimitGuard,
        { provide: AiUsageLogService, useValue: mockAiUsageLogService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getRepositoryToken(User), useValue: mockUsersRepository },
      ],
    }).compile();

    guard = module.get<PhotoIdentifyDailyLimitGuard>(
      PhotoIdentifyDailyLimitGuard,
    );
    jest.clearAllMocks();
  });

  it('allows the request through when under the limit', async () => {
    mockUsersRepository.findOne.mockResolvedValue({
      timezone: 'America/New_York',
    });
    mockAiUsageLogService.getUserUsageSince.mockResolvedValue({
      requestCount: 1,
      totalTokens: 0,
    });

    await expect(guard.canActivate(buildContext(1))).resolves.toBe(true);
    expect(mockUsersRepository.findOne).toHaveBeenCalledWith({
      where: { id: 1 },
      select: ['timezone'],
    });
    expect(mockAiUsageLogService.getUserUsageSince).toHaveBeenCalledWith(
      1,
      expect.any(Date) as Date,
      'photo_identify',
    );
  });

  it("falls back to the app default timezone when the user hasn't set one", async () => {
    mockUsersRepository.findOne.mockResolvedValue({ timezone: null });
    mockAiUsageLogService.getUserUsageSince.mockResolvedValue({
      requestCount: 0,
      totalTokens: 0,
    });

    await guard.canActivate(buildContext(1));

    const [, sinceArg] = mockAiUsageLogService.getUserUsageSince.mock
      .calls[0] as [number, Date];
    expect(sinceArg).toBeInstanceOf(Date);
  });

  it('throws when the daily photo-identify limit (default 3) is reached', async () => {
    mockUsersRepository.findOne.mockResolvedValue({ timezone: null });
    mockAiUsageLogService.getUserUsageSince.mockResolvedValue({
      requestCount: 3,
      totalTokens: 0,
    });

    await expect(guard.canActivate(buildContext(1))).rejects.toThrow(
      HttpException,
    );
  });

  it('skips the check when there is no authenticated user', async () => {
    await expect(guard.canActivate(buildContext())).resolves.toBe(true);
    expect(mockUsersRepository.findOne).not.toHaveBeenCalled();
  });

  it('respects a PHOTO_IDENTIFY_DAILY_LIMIT override from config', async () => {
    const overriddenConfigService = {
      get: jest.fn((key: string) =>
        key === 'PHOTO_IDENTIFY_DAILY_LIMIT' ? '10' : undefined,
      ),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PhotoIdentifyDailyLimitGuard,
        { provide: AiUsageLogService, useValue: mockAiUsageLogService },
        { provide: ConfigService, useValue: overriddenConfigService },
        { provide: getRepositoryToken(User), useValue: mockUsersRepository },
      ],
    }).compile();
    const overriddenGuard = module.get<PhotoIdentifyDailyLimitGuard>(
      PhotoIdentifyDailyLimitGuard,
    );

    mockUsersRepository.findOne.mockResolvedValue({ timezone: null });
    mockAiUsageLogService.getUserUsageSince.mockResolvedValue({
      requestCount: 5,
      totalTokens: 0,
    });

    await expect(overriddenGuard.canActivate(buildContext(1))).resolves.toBe(
      true,
    );
  });
});

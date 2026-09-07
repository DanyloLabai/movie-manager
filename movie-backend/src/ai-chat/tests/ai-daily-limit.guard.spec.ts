import { ExecutionContext, HttpException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AiDailyLimitGuard } from '../ai-daily-limit.guard';
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

describe('AiDailyLimitGuard', () => {
  let guard: AiDailyLimitGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiDailyLimitGuard,
        { provide: AiUsageLogService, useValue: mockAiUsageLogService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getRepositoryToken(User), useValue: mockUsersRepository },
      ],
    }).compile();

    guard = module.get<AiDailyLimitGuard>(AiDailyLimitGuard);
    jest.clearAllMocks();
  });

  it('allows the request through when under both limits', async () => {
    mockUsersRepository.findOne.mockResolvedValue({
      timezone: 'America/New_York',
    });
    mockAiUsageLogService.getUserUsageSince.mockResolvedValue({
      requestCount: 1,
      totalTokens: 100,
    });

    await expect(guard.canActivate(buildContext(1))).resolves.toBe(true);
    expect(mockUsersRepository.findOne).toHaveBeenCalledWith({
      where: { id: 1 },
      select: ['timezone'],
    });
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

  it('throws when the daily request limit is reached', async () => {
    mockUsersRepository.findOne.mockResolvedValue({ timezone: null });
    mockAiUsageLogService.getUserUsageSince.mockResolvedValue({
      requestCount: 15,
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
});

import { Test, TestingModule } from '@nestjs/testing';
import type { Cache } from 'cache-manager';
import { InternalServerErrorException } from '@nestjs/common';
import { generateObject, generateText } from 'ai';
import { AiChatService } from './ai-chat.service';
import { ConfigService } from '@nestjs/config';
import { MoviesService } from '../movies/movies.service';
import { VectorService } from '../vector/vector.service';
import { AiUsageLogService } from './ai-usage-log.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ChatMessage } from './interfaces/chat-message.interface';
import { WatchlistItem } from '../movies/watchlist-entity';

jest.mock('ai', () => ({
  generateObject: jest.fn(),
  generateText: jest.fn(),
}));

jest.mock('@ai-sdk/groq', () => ({
  createGroq: jest.fn(() => (modelId: string) => ({
    provider: 'groq',
    modelId,
  })),
}));

jest.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: jest.fn(() => (modelId: string) => ({
    provider: 'gemini',
    modelId,
  })),
}));

const mockGenerateObject = generateObject as jest.Mock;
const mockGenerateText = generateText as jest.Mock;

interface CapturedGenerateObjectCall {
  model: { provider: string; modelId: string };
  system: string;
  messages: Array<{ role: string; content: string }>;
}

function getGenerateObjectCallArgs(callIndex = 0): CapturedGenerateObjectCall {
  const calls = mockGenerateObject.mock.calls as unknown as Array<
    [CapturedGenerateObjectCall]
  >;
  return calls[callIndex][0];
}

describe('AiChatService', () => {
  let service: AiChatService;
  let cacheManager: Cache;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'GROQ_API_KEY') return 'test_groq_key';
      if (key === 'GEMINI_API_KEY') return 'test_gemini_key';
      return null;
    }),
  };

  const mockMoviesService = {
    getProfileData: jest.fn(),
    getWatchlist: jest.fn(),
    getWatchedMovies: jest.fn(),
    getUpcomingMovies: jest.fn(),
    findMovieByTitle: jest.fn(),
    searchMovies: jest.fn(),
    getWatchedAndPlannedTmdbIds: jest.fn(),
  };

  const mockVectorService = {
    searchSimilarMovies: jest.fn(),
    getRelevantUserFactsWithScores: jest.fn(),
    saveUserFact: jest.fn(),
  };

  const mockAiUsageLogService = {
    logUsage: jest.fn().mockResolvedValue(undefined),
  };

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockMoviesService.getProfileData.mockResolvedValue({ favorites: [] });
    mockMoviesService.getWatchlist.mockResolvedValue([]);
    mockMoviesService.getWatchedMovies.mockResolvedValue([]);
    mockMoviesService.getUpcomingMovies.mockResolvedValue([]);
    mockVectorService.getRelevantUserFactsWithScores.mockResolvedValue([]);
    // Background fact-extraction call; resolving to 'NO' keeps it a no-op.
    mockGenerateText.mockResolvedValue({ text: 'NO' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiChatService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: MoviesService, useValue: mockMoviesService },
        { provide: VectorService, useValue: mockVectorService },
        { provide: AiUsageLogService, useValue: mockAiUsageLogService },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    }).compile();

    service = module.get<AiChatService>(AiChatService);
    cacheManager = module.get<Cache>(CACHE_MANAGER);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getHistory', () => {
    it('should return an empty array if cache is empty or returns null', async () => {
      mockCacheManager.get.mockResolvedValue(null);

      const userId = 1;
      const result = await service.getHistory(userId);

      expect(cacheManager.get).toHaveBeenCalledWith(`chat_history:${userId}`);
      expect(result).toEqual([]);
    });

    it('should return messages if cache exists', async () => {
      const mockHistory = [
        { role: 'user', content: 'Привіт' },
        { role: 'assistant', content: 'Вітаю! Чим можу допомогти?' },
      ];

      mockCacheManager.get.mockResolvedValue(mockHistory);

      const userId = 1;
      const result = await service.getHistory(userId);

      expect(result).toEqual(mockHistory);
    });
  });

  describe('saveHistory', () => {
    it('should save messages to cache with correct key and TTL', async () => {
      const userId = 1;
      const mockMessages: ChatMessage[] = [{ role: 'user', content: 'Тест' }];
      const expectedTtl = 604800000;

      await service.saveHistory(userId, mockMessages);

      expect(cacheManager.set).toHaveBeenCalledWith(
        `chat_history:${userId}`,
        mockMessages,
        expectedTtl,
      );
    });
  });

  describe('searchMovieByDescription', () => {
    const userId = 42;

    const baseAiObject = {
      message: 'Ось декілька варіантів для тебе.',
      titles: [] as string[],
      concepts: [] as string[],
      force: false,
      excludeOwned: false,
    };

    it('returns the Groq response directly when the primary provider succeeds (happy path)', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: { ...baseAiObject, message: 'Привіт від Groq!' },
        usage: { totalTokens: 111 },
      });

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Порадь щось цікаве' },
      ];

      const result = await service.searchMovieByDescription(messages, userId);

      expect(result.message).toBe('Привіт від Groq!');
      expect(result.movies).toBeUndefined();
      expect(mockGenerateObject).toHaveBeenCalledTimes(1);
      expect(getGenerateObjectCallArgs(0).model).toMatchObject({
        provider: 'groq',
        modelId: 'openai/gpt-oss-120b',
      });

      expect(mockAiUsageLogService.logUsage).toHaveBeenCalledTimes(1);
      expect(mockAiUsageLogService.logUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          provider: 'groq',
          wasFailover: false,
          requestType: 'chat',
          tokenCount: 111,
        }),
      );
    });

    it('falls back to Gemini when the primary Groq call throws, and returns its response', async () => {
      mockGenerateObject
        .mockRejectedValueOnce(new Error('Groq is down'))
        .mockResolvedValueOnce({
          object: { ...baseAiObject, message: 'Привіт від Gemini!' },
          usage: { totalTokens: 222 },
        });

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Порадь щось цікаве' },
      ];

      const result = await service.searchMovieByDescription(messages, userId);

      expect(result.message).toBe('Привіт від Gemini!');
      expect(mockGenerateObject).toHaveBeenCalledTimes(2);
      expect(getGenerateObjectCallArgs(0).model).toMatchObject({
        provider: 'groq',
      });
      expect(getGenerateObjectCallArgs(1).model).toMatchObject({
        provider: 'gemini',
        modelId: 'gemini-flash-latest',
      });

      // Only the successful (failover) call is logged — the failed Groq attempt is not.
      expect(mockAiUsageLogService.logUsage).toHaveBeenCalledTimes(1);
      expect(mockAiUsageLogService.logUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          provider: 'gemini',
          wasFailover: true,
          requestType: 'chat',
          tokenCount: 222,
        }),
      );
    });

    it('throws InternalServerErrorException without crashing when both Groq and Gemini fail', async () => {
      mockGenerateObject
        .mockRejectedValueOnce(new Error('Groq is down'))
        .mockRejectedValueOnce(new Error('Gemini is down too'));

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Порадь щось цікаве' },
      ];

      let caughtError: unknown;
      try {
        await service.searchMovieByDescription(messages, userId);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(InternalServerErrorException);
      expect((caughtError as InternalServerErrorException).message).toBe(
        'All AI services are currently unavailable',
      );

      expect(mockGenerateObject).toHaveBeenCalledTimes(2);
      expect(mockAiUsageLogService.logUsage).not.toHaveBeenCalled();
    });

    // AiChatService does not itself enforce the daily request/token limit — that check
    // lives entirely in AiDailyLimitGuard, which runs before this method is ever invoked.
    // What this service IS responsible for is feeding that guard accurate usage data, so
    // we verify the logUsage payload it produces on both the primary and failover paths.
    describe('usage logging (feeds AiDailyLimitGuard/AiUsageLogService)', () => {
      it('logs provider=groq/wasFailover=false with the token count reported by generateObject on success', async () => {
        mockGenerateObject.mockResolvedValueOnce({
          object: baseAiObject,
          usage: { totalTokens: 77 },
        });

        await service.searchMovieByDescription(
          [{ role: 'user', content: 'hi' }],
          userId,
        );

        expect(mockAiUsageLogService.logUsage).toHaveBeenCalledWith(
          expect.objectContaining({
            provider: 'groq',
            wasFailover: false,
            tokenCount: 77,
            latencyMs: expect.any(Number) as number,
          }),
        );
      });

      it('logs provider=gemini/wasFailover=true when Groq failed over to Gemini', async () => {
        mockGenerateObject
          .mockRejectedValueOnce(new Error('Groq is down'))
          .mockResolvedValueOnce({
            object: baseAiObject,
            usage: { totalTokens: 88 },
          });

        await service.searchMovieByDescription(
          [{ role: 'user', content: 'hi' }],
          userId,
        );

        expect(mockAiUsageLogService.logUsage).toHaveBeenCalledWith(
          expect.objectContaining({
            provider: 'gemini',
            wasFailover: true,
            tokenCount: 88,
            latencyMs: expect.any(Number) as number,
          }),
        );
      });
    });

    describe('message history / context assembly', () => {
      it('formats the full message history (role + content only) for the AI call, in order', async () => {
        mockGenerateObject.mockResolvedValueOnce({
          object: baseAiObject,
          usage: { totalTokens: 10 },
        });

        const messages: ChatMessage[] = [
          { role: 'user', content: 'Привіт' },
          { role: 'assistant', content: 'Привіт! Чим можу допомогти?' },
          { role: 'user', content: 'Порадь щось про космос' },
        ];

        await service.searchMovieByDescription(messages, userId);

        expect(getGenerateObjectCallArgs(0).messages).toEqual([
          { role: 'user', content: 'Привіт' },
          { role: 'assistant', content: 'Привіт! Чим можу допомогти?' },
          { role: 'user', content: 'Порадь щось про космос' },
        ]);
      });

      it('uses the latest user message (not the latest overall message) to fetch long-term memory', async () => {
        mockGenerateObject.mockResolvedValueOnce({
          object: baseAiObject,
          usage: { totalTokens: 10 },
        });

        const messages: ChatMessage[] = [
          { role: 'user', content: 'старе повідомлення' },
          { role: 'user', content: 'найновіше повідомлення користувача' },
          { role: 'assistant', content: 'відповідь асистента' },
        ];

        await service.searchMovieByDescription(messages, userId);

        expect(
          mockVectorService.getRelevantUserFactsWithScores,
        ).toHaveBeenCalledWith(userId, 'найновіше повідомлення користувача', 3);
      });

      it('builds the system prompt from the user profile (favorites, watchlist, watched, memory)', async () => {
        mockMoviesService.getProfileData.mockResolvedValueOnce({
          favorites: [{ title: 'Inception' } as WatchlistItem],
        });
        mockMoviesService.getWatchlist.mockResolvedValueOnce([
          { title: 'Interstellar' } as WatchlistItem,
        ]);
        mockMoviesService.getWatchedMovies.mockResolvedValueOnce([
          { title: 'The Matrix' } as WatchlistItem,
        ]);
        mockVectorService.getRelevantUserFactsWithScores.mockResolvedValueOnce([
          {
            preferenceText: 'The user loves Christopher Nolan films',
            similarityScore: 0.9,
          },
        ]);
        mockGenerateObject.mockResolvedValueOnce({
          object: baseAiObject,
          usage: { totalTokens: 10 },
        });

        await service.searchMovieByDescription(
          [{ role: 'user', content: 'Порадь щось у стилі Нолана' }],
          userId,
        );

        const systemPrompt = getGenerateObjectCallArgs(0).system;
        expect(systemPrompt).toContain('Inception');
        expect(systemPrompt).toContain('Interstellar');
        expect(systemPrompt).toContain('The Matrix');
        expect(systemPrompt).toContain(
          'The user loves Christopher Nolan films',
        );
      });

      it('falls back to an empty user context (never throws) when loading profile data fails', async () => {
        mockMoviesService.getProfileData.mockRejectedValueOnce(
          new Error('DB unavailable'),
        );
        mockGenerateObject.mockResolvedValueOnce({
          object: baseAiObject,
          usage: { totalTokens: 10 },
        });

        const result = await service.searchMovieByDescription(
          [{ role: 'user', content: 'hi' }],
          userId,
        );

        expect(result).toBeDefined();
        const systemPrompt = getGenerateObjectCallArgs(0).system;
        expect(systemPrompt).toContain('FAVORITES: None');
      });
    });
  });
});

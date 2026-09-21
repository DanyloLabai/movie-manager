import { Test, TestingModule } from '@nestjs/testing';
import type { Cache } from 'cache-manager';
import { InternalServerErrorException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { generateObject, generateText } from 'ai';
import { AiChatService } from './ai-chat.service';
import { ConfigService } from '@nestjs/config';
import { MoviesService } from '../movies/movies.service';
import { VectorService } from '../vector/vector.service';
import { AiUsageLogService } from './ai-usage-log.service';
import { WatchTogetherPick } from './watch-together-pick.entity';
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

jest.mock('@ai-sdk/deepseek', () => ({
  createDeepSeek: jest.fn(() => (modelId: string) => ({
    provider: 'deepseek',
    modelId,
  })),
}));

jest.mock('@ai-sdk/openai', () => ({
  createOpenAI: jest.fn(() => ({
    responses: (modelId: string) => ({ provider: 'openai', modelId }),
  })),
}));

const mockGenerateObject = generateObject as jest.Mock;
const mockGenerateText = generateText as jest.Mock;

interface CapturedGenerateObjectCall {
  model: { provider: string; modelId: string };
  system: string;
  messages: Array<{ role: string; content: string }>;
  providerOptions?: Record<string, Record<string, string>>;
}

function getGenerateObjectCallArgs(callIndex = 0): CapturedGenerateObjectCall {
  const calls = mockGenerateObject.mock.calls as unknown as Array<
    [CapturedGenerateObjectCall]
  >;
  return calls[callIndex][0];
}

interface CapturedVisionCall {
  messages: Array<{
    role: string;
    content: Array<{ type: string; text?: string }>;
  }>;
}

function getVisionPromptText(callIndex = 0): string {
  const calls = mockGenerateObject.mock.calls as unknown as Array<
    [CapturedVisionCall]
  >;
  const textPart = calls[callIndex][0].messages[0].content.find(
    (part) => part.type === 'text',
  );
  return textPart?.text ?? '';
}

describe('AiChatService', () => {
  let service: AiChatService;
  let cacheManager: Cache;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'GROQ_API_KEY') return 'test_groq_key';
      if (key === 'GEMINI_API_KEY') return 'test_gemini_key';
      if (key === 'DEEPSEEK_API_KEY') return 'test_deepseek_key';
      if (key === 'OPEN_AI_API_KEY') return 'test_openai_key';
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

  const mockWatchTogetherPickRepository = {
    find: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      orIgnore: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    })),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockMoviesService.getProfileData.mockResolvedValue({ favorites: [] });
    mockMoviesService.getWatchlist.mockResolvedValue([]);
    mockMoviesService.getWatchedMovies.mockResolvedValue([]);
    mockMoviesService.getUpcomingMovies.mockResolvedValue([]);
    mockVectorService.getRelevantUserFactsWithScores.mockResolvedValue([]);
    mockWatchTogetherPickRepository.find.mockResolvedValue([]);
    // Background fact-extraction call; resolving to 'NO' keeps it a no-op.
    mockGenerateText.mockResolvedValue({ text: 'NO' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiChatService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: MoviesService, useValue: mockMoviesService },
        { provide: VectorService, useValue: mockVectorService },
        { provide: AiUsageLogService, useValue: mockAiUsageLogService },
        {
          provide: getRepositoryToken(WatchTogetherPick),
          useValue: mockWatchTogetherPickRepository,
        },
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
      titles: [] as {
        title: string;
        mediaType: 'movie' | 'tv';
        director?: string | null;
      }[],
      concepts: [] as string[],
      force: false,
      excludeOwned: false,
    };

    it('returns the OpenAI response directly when the primary provider succeeds (happy path)', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: { ...baseAiObject, message: 'Привіт від OpenAI!' },
        usage: { totalTokens: 111 },
      });

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Порадь щось цікаве' },
      ];

      const result = await service.searchMovieByDescription(messages, userId);

      expect(result.message).toBe('Привіт від OpenAI!');
      expect(result.movies).toBeUndefined();
      expect(mockGenerateObject).toHaveBeenCalledTimes(1);
      expect(getGenerateObjectCallArgs(0).model).toMatchObject({
        provider: 'openai',
        modelId: 'gpt-5.6-luna',
      });

      expect(mockAiUsageLogService.logUsage).toHaveBeenCalledTimes(1);
      expect(mockAiUsageLogService.logUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          provider: 'openai',
          wasFailover: false,
          requestType: 'chat',
          tokenCount: 111,
        }),
      );
    });

    it('falls back to DeepSeek when the primary OpenAI call throws, and returns its response', async () => {
      mockGenerateObject
        .mockRejectedValueOnce(new Error('OpenAI is down'))
        .mockResolvedValueOnce({
          object: { ...baseAiObject, message: 'Привіт від DeepSeek!' },
          usage: { totalTokens: 200 },
        });

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Порадь щось цікаве' },
      ];

      const result = await service.searchMovieByDescription(messages, userId);

      expect(result.message).toBe('Привіт від DeepSeek!');
      expect(mockGenerateObject).toHaveBeenCalledTimes(2);
      expect(getGenerateObjectCallArgs(0).model).toMatchObject({
        provider: 'openai',
        modelId: 'gpt-5.6-luna',
      });
      expect(getGenerateObjectCallArgs(1).model).toMatchObject({
        provider: 'deepseek',
        modelId: 'deepseek-v4-pro',
      });

      // Only the successful (failover) call is logged- the failed OpenAI attempt is not.
      expect(mockAiUsageLogService.logUsage).toHaveBeenCalledTimes(1);
      expect(mockAiUsageLogService.logUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          provider: 'deepseek',
          wasFailover: true,
          requestType: 'chat',
          tokenCount: 200,
        }),
      );
    });

    it('falls back to Gemini when OpenAI and DeepSeek both throw, and returns its response', async () => {
      mockGenerateObject
        .mockRejectedValueOnce(new Error('OpenAI is down'))
        .mockRejectedValueOnce(new Error('DeepSeek is down'))
        .mockResolvedValueOnce({
          object: { ...baseAiObject, message: 'Привіт від Gemini!' },
          usage: { totalTokens: 222 },
        });

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Порадь щось цікаве' },
      ];

      const result = await service.searchMovieByDescription(messages, userId);

      expect(result.message).toBe('Привіт від Gemini!');
      expect(mockGenerateObject).toHaveBeenCalledTimes(3);
      expect(getGenerateObjectCallArgs(2).model).toMatchObject({
        provider: 'gemini',
        modelId: 'gemini-flash-latest',
      });

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

    it('falls back to Groq when OpenAI, DeepSeek and Gemini all throw, and returns its response', async () => {
      mockGenerateObject
        .mockRejectedValueOnce(new Error('OpenAI is down'))
        .mockRejectedValueOnce(new Error('DeepSeek is down'))
        .mockRejectedValueOnce(new Error('Gemini is down too'))
        .mockResolvedValueOnce({
          object: { ...baseAiObject, message: 'Привіт від Groq!' },
          usage: { totalTokens: 333 },
        });

      const messages: ChatMessage[] = [
        { role: 'user', content: 'Порадь щось цікаве' },
      ];

      const result = await service.searchMovieByDescription(messages, userId);

      expect(result.message).toBe('Привіт від Groq!');
      expect(mockGenerateObject).toHaveBeenCalledTimes(4);
      expect(getGenerateObjectCallArgs(3).model).toMatchObject({
        provider: 'groq',
        modelId: 'openai/gpt-oss-120b',
      });

      expect(mockAiUsageLogService.logUsage).toHaveBeenCalledTimes(1);
      expect(mockAiUsageLogService.logUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          provider: 'groq',
          wasFailover: true,
          requestType: 'chat',
          tokenCount: 333,
        }),
      );
    });

    it('throws InternalServerErrorException without crashing when OpenAI, DeepSeek, Gemini and Groq all fail', async () => {
      mockGenerateObject
        .mockRejectedValueOnce(new Error('OpenAI is down'))
        .mockRejectedValueOnce(new Error('DeepSeek is down'))
        .mockRejectedValueOnce(new Error('Gemini is down too'))
        .mockRejectedValueOnce(new Error('Groq is down too'));

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

      expect(mockGenerateObject).toHaveBeenCalledTimes(4);
      expect(mockAiUsageLogService.logUsage).not.toHaveBeenCalled();
    });

    // AiChatService does not itself enforce the daily request/token limit- that check
    // lives entirely in AiDailyLimitGuard, which runs before this method is ever invoked.
    // What this service IS responsible for is feeding that guard accurate usage data, so
    // we verify the logUsage payload it produces on both the primary and failover paths.
    describe('usage logging (feeds AiDailyLimitGuard/AiUsageLogService)', () => {
      it('logs provider=openai/wasFailover=false with the token count reported by generateObject on success', async () => {
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
            provider: 'openai',
            wasFailover: false,
            tokenCount: 77,
            latencyMs: expect.any(Number) as number,
          }),
        );
      });

      it('logs provider=deepseek/wasFailover=true when OpenAI failed over to DeepSeek', async () => {
        mockGenerateObject
          .mockRejectedValueOnce(new Error('OpenAI is down'))
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
            provider: 'deepseek',
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

  describe('identifyMovieFromPhoto', () => {
    const userId = 42;
    const imageBuffer = Buffer.from('fake-image-bytes');
    const mimeType = 'image/jpeg';

    const basePhotoObject = {
      recognized: true,
      candidates: [
        {
          actorOrCharacter: 'Leonardo DiCaprio as Cobb',
          title: 'Inception',
          year: 2010,
          mediaType: 'movie' as const,
        },
      ],
      message: 'Це "Початок" (2010).',
    };

    it('asks OpenAI for medium reasoning effort when it falls back there', async () => {
      // Without this, gpt-5.6-luna falls back to its default (lower)
      // reasoning effort and becomes noticeably more conservative- e.g.
      // reporting recognized:false on a frame it can otherwise identify
      // correctly at reasoningEffort:medium.
      mockGenerateObject
        .mockRejectedValueOnce(new Error('DeepSeek is down'))
        .mockResolvedValueOnce({
          object: basePhotoObject,
          usage: { totalTokens: 10 },
        });

      await service.identifyMovieFromPhoto(userId, imageBuffer, mimeType);

      expect(getGenerateObjectCallArgs(1).providerOptions).toEqual({
        openai: { reasoningEffort: 'medium' },
      });
    });

    it('defaults to English when no lang is passed', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: basePhotoObject,
        usage: { totalTokens: 10 },
      });

      await service.identifyMovieFromPhoto(userId, imageBuffer, mimeType);

      expect(getVisionPromptText(0)).toContain('Reply in English.');
    });

    it('asks for a Ukrainian reply when the frontend passes lang=uk', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: basePhotoObject,
        usage: { totalTokens: 10 },
      });

      await service.identifyMovieFromPhoto(userId, imageBuffer, mimeType, 'uk');

      expect(getVisionPromptText(0)).toContain('Reply in Ukrainian.');
    });

    it('identifies the movie via DeepSeek (primary) and attaches the found card', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: basePhotoObject,
        usage: { totalTokens: 55 },
      });
      mockMoviesService.findMovieByTitle.mockResolvedValueOnce({
        id: 123,
        title: 'Inception',
      });

      const result = await service.identifyMovieFromPhoto(
        userId,
        imageBuffer,
        mimeType,
      );

      expect(result.message).toBe('Це "Початок" (2010).');
      expect(result.movies).toEqual([{ id: 123, title: 'Inception' }]);
      expect(mockGenerateObject).toHaveBeenCalledTimes(1);
      expect(getGenerateObjectCallArgs(0).model).toMatchObject({
        provider: 'deepseek',
        modelId: 'deepseek-flash',
      });
      expect(mockMoviesService.findMovieByTitle).toHaveBeenCalledWith(
        'Inception',
        2010,
        'movie',
      );

      expect(mockAiUsageLogService.logUsage).toHaveBeenCalledTimes(1);
      expect(mockAiUsageLogService.logUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          provider: 'deepseek',
          wasFailover: false,
          requestType: 'photo_identify',
          tokenCount: 55,
        }),
      );
    });

    it('attaches a card for each distinct candidate when the AI is torn between a few', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: {
          recognized: true,
          candidates: [
            {
              actorOrCharacter: 'Matthew McConaughey as Rust Cohle',
              title: 'True Detective',
              year: 2014,
              mediaType: 'tv' as const,
            },
            {
              actorOrCharacter: 'Val Kilmer',
              title: 'The Salton Sea',
              year: 2002,
              mediaType: 'movie' as const,
            },
          ],
          message:
            'Не певен, це або "Справжній детектив", або "The Salton Sea".',
        },
        usage: { totalTokens: 60 },
      });
      mockMoviesService.findMovieByTitle
        .mockResolvedValueOnce({ id: 1, title: 'True Detective' })
        .mockResolvedValueOnce({ id: 2, title: 'The Salton Sea' });

      const result = await service.identifyMovieFromPhoto(
        userId,
        imageBuffer,
        mimeType,
      );

      expect(result.movies).toEqual([
        { id: 1, title: 'True Detective' },
        { id: 2, title: 'The Salton Sea' },
      ]);
      expect(mockMoviesService.findMovieByTitle).toHaveBeenCalledTimes(2);
      expect(mockMoviesService.findMovieByTitle).toHaveBeenNthCalledWith(
        1,
        'True Detective',
        2014,
        'tv',
      );
      expect(mockMoviesService.findMovieByTitle).toHaveBeenNthCalledWith(
        2,
        'The Salton Sea',
        2002,
        'movie',
      );
    });

    it('de-duplicates candidates that resolve to the same movie', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: {
          recognized: true,
          candidates: [
            {
              actorOrCharacter: 'Leonardo DiCaprio as Cobb',
              title: 'Inception',
              year: 2010,
              mediaType: 'movie' as const,
            },
            {
              actorOrCharacter: null,
              title: 'Inception (2010 film)',
              year: null,
              mediaType: 'movie' as const,
            },
          ],
          message: 'Це "Початок" (2010).',
        },
        usage: { totalTokens: 60 },
      });
      mockMoviesService.findMovieByTitle.mockResolvedValue({
        id: 123,
        title: 'Inception',
      });

      const result = await service.identifyMovieFromPhoto(
        userId,
        imageBuffer,
        mimeType,
      );

      expect(result.movies).toEqual([{ id: 123, title: 'Inception' }]);
    });

    it('returns no movie card when the AI could not confidently recognize anything', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: {
          recognized: false,
          candidates: [],
          message: 'Не можу впевнено визначити, що це за фільм.',
        },
        usage: { totalTokens: 30 },
      });

      const result = await service.identifyMovieFromPhoto(
        userId,
        imageBuffer,
        mimeType,
      );

      expect(result.message).toBe(
        'Не можу впевнено визначити, що це за фільм.',
      );
      expect(result.movies).toBeUndefined();
      expect(mockMoviesService.findMovieByTitle).not.toHaveBeenCalled();
    });

    it('returns no movie card when the AI names a title but it is not found on TMDB', async () => {
      mockGenerateObject.mockResolvedValueOnce({
        object: basePhotoObject,
        usage: { totalTokens: 40 },
      });
      mockMoviesService.findMovieByTitle.mockResolvedValueOnce(null);

      const result = await service.identifyMovieFromPhoto(
        userId,
        imageBuffer,
        mimeType,
      );

      expect(result.message).toBe(basePhotoObject.message);
      expect(result.movies).toBeUndefined();
    });

    it('falls back to OpenAI when DeepSeek throws, and returns its response', async () => {
      mockGenerateObject
        .mockRejectedValueOnce(new Error('DeepSeek is down'))
        .mockResolvedValueOnce({
          object: { ...basePhotoObject, message: 'Схоже на "Початок".' },
          usage: { totalTokens: 66 },
        });
      mockMoviesService.findMovieByTitle.mockResolvedValueOnce({
        id: 123,
        title: 'Inception',
      });

      const result = await service.identifyMovieFromPhoto(
        userId,
        imageBuffer,
        mimeType,
      );

      expect(result.message).toBe('Схоже на "Початок".');
      expect(mockGenerateObject).toHaveBeenCalledTimes(2);
      expect(getGenerateObjectCallArgs(0).model).toMatchObject({
        provider: 'deepseek',
        modelId: 'deepseek-flash',
      });
      expect(getGenerateObjectCallArgs(1).model).toMatchObject({
        provider: 'openai',
        modelId: 'gpt-5.6-luna',
      });

      expect(mockAiUsageLogService.logUsage).toHaveBeenCalledTimes(1);
      expect(mockAiUsageLogService.logUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          provider: 'openai',
          wasFailover: true,
          requestType: 'photo_identify',
          tokenCount: 66,
        }),
      );
    });

    it('falls back to Gemini as a last resort when both DeepSeek and OpenAI throw', async () => {
      mockGenerateObject
        .mockRejectedValueOnce(new Error('DeepSeek is down'))
        .mockRejectedValueOnce(new Error('OpenAI is down'))
        .mockResolvedValueOnce({
          object: { ...basePhotoObject, message: 'Схоже на "Початок".' },
          usage: { totalTokens: 66 },
        });
      mockMoviesService.findMovieByTitle.mockResolvedValueOnce({
        id: 123,
        title: 'Inception',
      });

      const result = await service.identifyMovieFromPhoto(
        userId,
        imageBuffer,
        mimeType,
      );

      expect(result.message).toBe('Схоже на "Початок".');
      expect(mockGenerateObject).toHaveBeenCalledTimes(3);
      expect(getGenerateObjectCallArgs(2).model).toMatchObject({
        provider: 'gemini',
        modelId: 'gemini-flash-latest',
      });

      expect(mockAiUsageLogService.logUsage).toHaveBeenCalledTimes(1);
      expect(mockAiUsageLogService.logUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          provider: 'gemini',
          wasFailover: true,
          requestType: 'photo_identify',
          tokenCount: 66,
        }),
      );
    });

    it('throws InternalServerErrorException without crashing when DeepSeek, OpenAI and Gemini all fail', async () => {
      mockGenerateObject
        .mockRejectedValueOnce(new Error('DeepSeek is down'))
        .mockRejectedValueOnce(new Error('OpenAI is down'))
        .mockRejectedValueOnce(new Error('Gemini is down too'));

      let caughtError: unknown;
      try {
        await service.identifyMovieFromPhoto(userId, imageBuffer, mimeType);
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(InternalServerErrorException);
      expect((caughtError as InternalServerErrorException).message).toBe(
        'Photo identification is currently unavailable',
      );
      expect(mockGenerateObject).toHaveBeenCalledTimes(3);
      expect(mockAiUsageLogService.logUsage).not.toHaveBeenCalled();
    });
  });
});

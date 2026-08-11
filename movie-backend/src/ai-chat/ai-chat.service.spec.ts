import { Test, TestingModule } from '@nestjs/testing';
import type { Cache } from 'cache-manager';
import { AiChatService } from './ai-chat.service';
import { ConfigService } from '@nestjs/config';
import { MoviesService } from '../movies/movies.service';
import { VectorService } from '../vector/vector.service';
import { AiUsageLogService } from './ai-usage-log.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ChatMessage } from './ai-chat.controller';

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
  };

  const mockVectorService = {
    searchSimilarMovies: jest.fn(),
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
});

import { Test, TestingModule } from '@nestjs/testing';
import { AiChatService } from './ai-chat.service';
import { ConfigService } from '@nestjs/config';
import { MoviesService } from '../movies/movies.service';
import { VectorService } from '../vector/vector.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

describe('AiChatService', () => {
  let service: AiChatService;
  let cacheManager: any;

  // 1. Створюємо "заглушки" (mocks) для всіх залежностей
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

  const mockCacheManager = {
    get: jest.fn(),
    set: jest.fn(),
  };

  // 2. Ініціалізація тестового модуля перед кожним тестом
  beforeEach(async () => {
    // Очищаємо моки перед кожним тестом, щоб вони не впливали один на одного
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiChatService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: MoviesService, useValue: mockMoviesService },
        { provide: VectorService, useValue: mockVectorService },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
      ],
    }).compile();

    service = module.get<AiChatService>(AiChatService);
    cacheManager = module.get(CACHE_MANAGER);
  });

  // 3. Базова перевірка
  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // --- ТЕСТИ: Парсинг тексту ---
  describe('extractMovieTitlesFromText', () => {
    it('should extract titles wrapped in quotes', () => {
      const text = 'Я рекомендую подивитися "Матриця" та "Початок".';

      // Викликаємо приватний метод через bracket notation
      const result = service['extractMovieTitlesFromText'](text);

      expect(result).toHaveLength(2);
      expect(result).toEqual(['Матриця', 'Початок']);
    });

    it('should return empty array if no quotes are found', () => {
      const text = 'Тут просто текст без назв фільмів у лапках.';
      const result = service['extractMovieTitlesFromText'](text);

      expect(result).toEqual([]);
    });

    it('should handle single quotes inside double quotes properly', () => {
      const text = 'Подивіться "Дев\'ята брама".';
      const result = service['extractMovieTitlesFromText'](text);

      expect(result).toEqual(["Дев'ята брама"]);
    });
  });

  // --- ТЕСТИ: Робота з історією чату (Кеш) ---
  describe('getHistory', () => {
    it('should return an empty array if cache is empty or returns null', async () => {
      // Імітуємо ситуацію, коли кеш нічого не знайшов
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

      // Імітуємо ситуацію, коли в кеші є історія
      mockCacheManager.get.mockResolvedValue(mockHistory);

      const userId = 1;
      const result = await service.getHistory(userId);

      expect(result).toEqual(mockHistory);
    });
  });

  describe('saveHistory', () => {
    it('should save messages to cache with correct key and TTL', async () => {
      const userId = 1;
      const mockMessages = [{ role: 'user', content: 'Тест' }];
      const expectedTtl = 604800000; // 7 днів у мілісекундах

      await service.saveHistory(userId, mockMessages as any);

      expect(cacheManager.set).toHaveBeenCalledWith(
        `chat_history:${userId}`,
        mockMessages,
        expectedTtl,
      );
    });
  });
});

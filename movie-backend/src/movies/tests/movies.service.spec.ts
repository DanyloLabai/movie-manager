import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { of } from 'rxjs';
import { MoviesService } from '../movies.service';
import { WatchlistItem } from '../watchlist-entity';
import { User } from '../../users/users.entity';

jest.mock('groq-sdk', () => {
  const Groq = jest.fn().mockImplementation(() => ({}));
  return { default: Groq, __esModule: true };
});

const mockWatchlistItem = (
  overrides: Partial<WatchlistItem> = {},
): WatchlistItem =>
  ({
    id: 1,
    tmdbId: 550,
    title: 'Fight Club',
    mediaType: 'movie',
    posterUrl: '/poster.jpg',
    releaseDate: '1999-10-15',
    isWatched: false,
    isFavorite: false,
    rating: null,
    notified: false,
    addedAt: new Date(),
    updatedAt: new Date(),
    user: { id: 1 } as User,
    ...overrides,
  }) as WatchlistItem;

const mockWatchlistRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
};

const mockUsersRepo = {
  findOne: jest.fn(),
};

const mockHttpService = {
  get: jest.fn(),
  post: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    const config: Record<string, string | number> = {
      TMDB_API_TOKEN: 'mock-tmdb-token',
      GROQ_API_KEY: 'mock-groq-key',
      RESEND_API_KEY: 'mock-resend-key',
      FRONTEND_URL: 'http://localhost:5173',
      CACHE_TTL_24H: 86400000,
      CACHE_TTL_1H: 3600000,
      CACHE_TTL_7D: 604800000,
      SEARCH_RESULTS_LIMIT: 20,
      TRENDING_LIMIT: 12,
      UPCOMING_LIMIT: 16,
      SIMILAR_LIMIT: 10,
      ACTOR_KNOWN_FOR_LIMIT: 20,
      CAST_LIMIT: 12,
      PROFILE_RECENT_LIMIT: 10,
      PROFILE_FAVORITES_LIMIT: 5,
      PROFILE_ANALYZE_LIMIT: 30,
      PROFILE_TOP_RATED_LIMIT: 3,
      RECOMMENDATIONS_LIMIT: 20,
      RECOMMENDATIONS_REFERENCE_LIMIT: 10,
      GENRE_DISTRIBUTION_LIMIT: 5,
    };
    return config[key];
  }),
};

const mockCacheManager = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  del: jest.fn().mockResolvedValue(undefined),
};

const buildModule = async (): Promise<TestingModule> =>
  Test.createTestingModule({
    providers: [
      MoviesService,
      {
        provide: getRepositoryToken(WatchlistItem),
        useValue: mockWatchlistRepo,
      },
      { provide: getRepositoryToken(User), useValue: mockUsersRepo },
      { provide: HttpService, useValue: mockHttpService },
      { provide: ConfigService, useValue: mockConfigService },
      { provide: CACHE_MANAGER, useValue: mockCacheManager },
    ],
  }).compile();

describe('MoviesService', () => {
  let service: MoviesService;

  beforeEach(async () => {
    const module = await buildModule();
    service = module.get<MoviesService>(MoviesService);
    jest.clearAllMocks();
    mockCacheManager.get.mockResolvedValue(null);
  });

  // ─── addToWatchlist ──────────────────────────────────────────────────────

  describe('addToWatchlist', () => {
    it('should add a new item to the watchlist', async () => {
      mockWatchlistRepo.findOne.mockResolvedValue(null);
      const newItem = mockWatchlistItem();
      mockWatchlistRepo.create.mockReturnValue(newItem);
      mockWatchlistRepo.save.mockResolvedValue(newItem);

      const result = await service.addToWatchlist(
        1,
        550,
        'Fight Club',
        '/poster.jpg',
        'movie',
      );

      expect(result).toEqual(newItem);
      expect(mockWatchlistRepo.save).toHaveBeenCalledTimes(1);
      expect(mockCacheManager.del).toHaveBeenCalledWith(
        'recommendations:user:1',
      );
    });

    it('should throw BadRequestException if item already exists', async () => {
      mockWatchlistRepo.findOne.mockResolvedValue(mockWatchlistItem());

      await expect(
        service.addToWatchlist(1, 550, 'Fight Club'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should use "movie" as default media type', async () => {
      mockWatchlistRepo.findOne.mockResolvedValue(null);
      const newItem = mockWatchlistItem();
      mockWatchlistRepo.create.mockReturnValue(newItem);
      mockWatchlistRepo.save.mockResolvedValue(newItem);

      await service.addToWatchlist(1, 550, 'Fight Club');

      expect(mockWatchlistRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ mediaType: 'movie' }),
      );
    });
  });

  // ─── getWatchlist ─────────────────────────────────────────────────────────

  describe('getWatchlist', () => {
    it('should return only unwatched items for the user', async () => {
      const items = [mockWatchlistItem({ isWatched: false })];
      mockWatchlistRepo.find.mockResolvedValue(items);

      const result = await service.getWatchlist(1);

      expect(result).toEqual(items);
      expect(mockWatchlistRepo.find).toHaveBeenCalledWith({
        where: { user: { id: 1 }, isWatched: false },
        order: { addedAt: 'DESC' },
      });
    });

    it('should return empty array when watchlist is empty', async () => {
      mockWatchlistRepo.find.mockResolvedValue([]);

      const result = await service.getWatchlist(99);

      expect(result).toEqual([]);
    });
  });

  // ─── getWatchedMovies ─────────────────────────────────────────────────────

  describe('getWatchedMovies', () => {
    it('should return only watched items', async () => {
      const watched = [mockWatchlistItem({ isWatched: true })];
      mockWatchlistRepo.find.mockResolvedValue(watched);

      const result = await service.getWatchedMovies(1);

      expect(result).toEqual(watched);
      expect(mockWatchlistRepo.find).toHaveBeenCalledWith({
        where: { user: { id: 1 }, isWatched: true },
        order: { addedAt: 'DESC' },
      });
    });
  });

  // ─── markAsWatched ────────────────────────────────────────────────────────

  describe('markAsWatched', () => {
    it('should mark item as watched and save', async () => {
      const item = mockWatchlistItem({ isWatched: false });
      mockWatchlistRepo.findOne.mockResolvedValue(item);
      mockWatchlistRepo.save.mockResolvedValue({ ...item, isWatched: true });

      const result = await service.markAsWatched(1, 550);

      expect(result.isWatched).toBe(true);
      expect(mockWatchlistRepo.save).toHaveBeenCalledTimes(1);
      expect(mockCacheManager.del).toHaveBeenCalledWith(
        'recommendations:user:1',
      );
    });

    it('should throw NotFoundException when item is not in watchlist', async () => {
      mockWatchlistRepo.findOne.mockResolvedValue(null);

      await expect(service.markAsWatched(1, 9999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── rateMovie ────────────────────────────────────────────────────────────

  describe('rateMovie', () => {
    it('should set rating and mark as watched', async () => {
      const item = mockWatchlistItem({ isWatched: false, rating: null });
      mockWatchlistRepo.findOne.mockResolvedValue(item);
      mockWatchlistRepo.save.mockResolvedValue({
        ...item,
        rating: 8,
        isWatched: true,
      });

      const result = await service.rateMovie(1, 550, 8);

      expect(result.rating).toBe(8);
      expect(result.isWatched).toBe(true);
    });

    it('should throw NotFoundException when item is not found', async () => {
      mockWatchlistRepo.findOne.mockResolvedValue(null);

      await expect(service.rateMovie(1, 9999, 5)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should clear recommendations cache after rating', async () => {
      const item = mockWatchlistItem();
      mockWatchlistRepo.findOne.mockResolvedValue(item);
      mockWatchlistRepo.save.mockResolvedValue({ ...item, rating: 7 });

      await service.rateMovie(1, 550, 7);

      expect(mockCacheManager.del).toHaveBeenCalledWith(
        'recommendations:user:1',
      );
    });
  });

  // ─── toggleFavorite ───────────────────────────────────────────────────────

  describe('toggleFavorite', () => {
    it('should toggle isFavorite from false to true', async () => {
      const item = mockWatchlistItem({ isFavorite: false });
      mockWatchlistRepo.findOne.mockResolvedValue(item);
      mockWatchlistRepo.save.mockResolvedValue({ ...item, isFavorite: true });

      const result = await service.toggleFavorite(1, 550);

      expect(result.isFavorite).toBe(true);
    });

    it('should toggle isFavorite from true to false', async () => {
      const item = mockWatchlistItem({ isFavorite: true });
      mockWatchlistRepo.findOne.mockResolvedValue(item);
      mockWatchlistRepo.save.mockResolvedValue({ ...item, isFavorite: false });

      const result = await service.toggleFavorite(1, 550);

      expect(result.isFavorite).toBe(false);
    });

    it('should throw NotFoundException when item is not in watchlist', async () => {
      mockWatchlistRepo.findOne.mockResolvedValue(null);

      await expect(service.toggleFavorite(1, 9999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── getMovieUserStatus ───────────────────────────────────────────────────

  describe('getMovieUserStatus', () => {
    it('should return the watchlist item when it exists', async () => {
      const item = mockWatchlistItem();
      mockWatchlistRepo.findOne.mockResolvedValue(item);

      const result = await service.getMovieUserStatus(1, 550);

      expect(result).toEqual(item);
    });

    it('should return null when item is not in watchlist', async () => {
      mockWatchlistRepo.findOne.mockResolvedValue(null);

      const result = await service.getMovieUserStatus(1, 9999);

      expect(result).toBeNull();
    });
  });

  // ─── removeFromWatchlist ──────────────────────────────────────────────────

  describe('removeFromWatchlist', () => {
    it('should remove item and return success message', async () => {
      mockWatchlistRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.removeFromWatchlist(1, 550);

      expect(result.message).toBe('Successfully removed');
      expect(mockWatchlistRepo.delete).toHaveBeenCalledWith({
        user: { id: 1 },
        tmdbId: 550,
      });
      expect(mockCacheManager.del).toHaveBeenCalledWith(
        'recommendations:user:1',
      );
    });

    it('should throw NotFoundException when item does not exist', async () => {
      mockWatchlistRepo.delete.mockResolvedValue({ affected: 0 });

      await expect(service.removeFromWatchlist(1, 9999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── searchMovies (cache) ─────────────────────────────────────────────────

  describe('searchMovies', () => {
    const mockTmdbResponse = {
      data: {
        results: [
          {
            id: 550,
            title: 'Fight Club',
            media_type: 'movie',
            poster_path: '/poster.jpg',
            release_date: '1999-10-15',
            vote_average: 8.8,
            vote_count: 25000,
            overview: 'A depressed man...',
          },
        ],
        total_pages: 1,
      },
    };

    it('should return cached results when available', async () => {
      const cached = [{ id: 550, title: 'Fight Club' }];
      mockCacheManager.get.mockResolvedValue(cached);

      const result = await service.searchMovies('fight club');

      expect(result).toEqual(cached);
      expect(mockHttpService.get).not.toHaveBeenCalled();
    });

    it('should query TMDB API on cache miss', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockHttpService.get.mockReturnValue(of(mockTmdbResponse));

      await service.searchMovies('fight club');

      expect(mockHttpService.get).toHaveBeenCalled();
    });

    it('should cache results after TMDB API call', async () => {
      mockCacheManager.get.mockResolvedValue(null);
      mockHttpService.get.mockReturnValue(of(mockTmdbResponse));

      await service.searchMovies('fight club');

      expect(mockCacheManager.set).toHaveBeenCalled();
    });
  });
});

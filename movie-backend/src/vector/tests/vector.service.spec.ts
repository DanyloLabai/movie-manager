import { Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { VectorService } from '../vector.service';
import { GenreDto } from '../../movies/dto/genre.dto';

const mockPoolQuery = jest.fn();

jest.mock('pg', () => ({
  Pool: jest.fn().mockImplementation(() => ({
    query: mockPoolQuery,
  })),
}));

const mockFetch = jest.fn();

const mockConfigService = {
  get: jest.fn((key: string) => {
    const config: Record<string, string> = {
      DATABASE_URL: 'postgres://mock-user:mock-pass@localhost:5432/mockdb',
      GEMINI_API_KEY: 'mock-gemini-key',
    };
    return config[key];
  }),
};

const buildInitializedService = async (): Promise<VectorService> => {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      VectorService,
      { provide: ConfigService, useValue: mockConfigService },
    ],
  }).compile();

  const service = module.get<VectorService>(VectorService);
  mockPoolQuery.mockResolvedValueOnce(undefined);
  await service.onModuleInit();
  mockPoolQuery.mockReset();
  return service;
};

const mockFetchOk = (embedding: number[]) => {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue({ embedding: { values: embedding } }),
    text: jest.fn().mockResolvedValue(''),
  });
};

const mockFetchHttpError = (status: number, body: string) => {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    text: jest.fn().mockResolvedValue(body),
  });
};

const mockFetchMalformed = () => {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue({}),
    text: jest.fn().mockResolvedValue(''),
  });
};

describe('VectorService', () => {
  let service: VectorService;

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    (global as unknown as { fetch: typeof fetch }).fetch =
      mockFetch as unknown as typeof fetch;
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(async () => {
    mockPoolQuery.mockReset();
    mockFetch.mockReset();
    service = await buildInitializedService();
  });

  describe('onModuleInit', () => {
    it('should initialize the pool and run a startup check query', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          VectorService,
          { provide: ConfigService, useValue: mockConfigService },
        ],
      }).compile();
      const freshService = module.get<VectorService>(VectorService);

      mockPoolQuery.mockReset();
      mockPoolQuery.mockResolvedValueOnce(undefined);

      await expect(freshService.onModuleInit()).resolves.toBeUndefined();
      expect(mockPoolQuery).toHaveBeenCalledWith('SELECT 1');
    });

    it('should throw if DATABASE_URL is missing', async () => {
      const configWithoutDbUrl = {
        get: jest.fn((key: string) =>
          key === 'GEMINI_API_KEY' ? 'mock-gemini-key' : undefined,
        ),
      };
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          VectorService,
          { provide: ConfigService, useValue: configWithoutDbUrl },
        ],
      }).compile();
      const freshService = module.get<VectorService>(VectorService);

      await expect(freshService.onModuleInit()).rejects.toThrow(
        'DATABASE_URL and GEMINI_API_KEY are required.',
      );
    });

    it('should throw if GEMINI_API_KEY is missing', async () => {
      const configWithoutGeminiKey = {
        get: jest.fn((key: string) =>
          key === 'DATABASE_URL' ? 'postgres://mock' : undefined,
        ),
      };
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          VectorService,
          { provide: ConfigService, useValue: configWithoutGeminiKey },
        ],
      }).compile();
      const freshService = module.get<VectorService>(VectorService);

      await expect(freshService.onModuleInit()).rejects.toThrow(
        'DATABASE_URL and GEMINI_API_KEY are required.',
      );
    });
  });

  describe('addMovieToVectorStore', () => {
    const movie = {
      id: 550,
      title: 'Fight Club',
      description: 'A depressed man forms an underground fight club.',
      genres: [{ id: 18, name: 'Drama' } as GenreDto],
      releaseYear: 1999,
      voteAverage: 8.8,
      runtime: 139,
      mediaType: 'movie' as const,
    };

    it('should embed and insert a new movie, returning true', async () => {
      mockPoolQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });
      mockFetchOk([0.1, 0.2, 0.3]);
      mockPoolQuery.mockResolvedValueOnce({ rowCount: 1, rows: [] });

      const result = await service.addMovieToVectorStore(movie);

      expect(result).toBe(true);
      expect(mockPoolQuery).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining(`metadata->>'tmdbId' = $1`),
        ['550'],
      );
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const insertCall = mockPoolQuery.mock.calls[1];
      expect(insertCall[0]).toEqual(
        expect.stringContaining('INSERT INTO movie_embeddings'),
      );
      expect(insertCall[1]).toEqual([
        expect.stringContaining('Title: Fight Club'),
        JSON.stringify([0.1, 0.2, 0.3]),
        JSON.stringify({ tmdbId: 550, title: 'Fight Club', mediaType: 'movie' }),
        [18],
        1999,
        8.8,
        139,
        'movie',
      ]);
    });

    it('should skip embedding and return true if the movie is already indexed', async () => {
      mockPoolQuery.mockResolvedValueOnce({ rowCount: 1, rows: [] });

      const result = await service.addMovieToVectorStore(movie);

      expect(result).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockPoolQuery).toHaveBeenCalledTimes(1);
    });

    it('should return false when the Gemini embedding call rejects (network error)', async () => {
      mockPoolQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });
      mockFetch.mockRejectedValueOnce(new Error('network error'));

      const result = await service.addMovieToVectorStore(movie);

      expect(result).toBe(false);
    });

    it('should return false when the Gemini API responds with a non-200 status', async () => {
      mockPoolQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });
      mockFetchHttpError(429, 'rate limited');

      const result = await service.addMovieToVectorStore(movie);

      expect(result).toBe(false);
    });

    it('should return false when the Gemini response is malformed', async () => {
      mockPoolQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });
      mockFetchMalformed();

      const result = await service.addMovieToVectorStore(movie);

      expect(result).toBe(false);
    });

    it('should return false when the insert query fails', async () => {
      mockPoolQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });
      mockFetchOk([0.1, 0.2, 0.3]);
      mockPoolQuery.mockRejectedValueOnce(new Error('insert failed'));

      const result = await service.addMovieToVectorStore(movie);

      expect(result).toBe(false);
    });
  });

  describe('saveUserFact', () => {
    it('should embed the fact, delete near-duplicates, and insert the new fact', async () => {
      mockFetchOk([0.4, 0.5]);
      mockPoolQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });
      mockPoolQuery.mockResolvedValueOnce({ rowCount: 1, rows: [] });

      await service.saveUserFact(7, 'Loves sci-fi movies');

      expect(mockPoolQuery).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('DELETE FROM user_memory_embeddings'),
        ['7', JSON.stringify([0.4, 0.5]), 0.15],
      );
      expect(mockPoolQuery).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO user_memory_embeddings'),
        [
          'Loves sci-fi movies',
          JSON.stringify([0.4, 0.5]),
          JSON.stringify({ userId: 7, type: 'preference' }),
        ],
      );
    });

    it('should embed an empty fact string without throwing', async () => {
      mockFetchOk([0, 0]);
      mockPoolQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });
      mockPoolQuery.mockResolvedValueOnce({ rowCount: 1, rows: [] });

      await expect(service.saveUserFact(7, '')).resolves.toBeUndefined();
      expect(mockPoolQuery).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO user_memory_embeddings'),
        ['', JSON.stringify([0, 0]), JSON.stringify({ userId: 7, type: 'preference' })],
      );
    });

    it('should swallow embedding errors without throwing', async () => {
      mockFetch.mockRejectedValueOnce(new Error('network error'));

      await expect(
        service.saveUserFact(7, 'Loves sci-fi movies'),
      ).resolves.toBeUndefined();
      expect(mockPoolQuery).not.toHaveBeenCalled();
    });

    it('should swallow database errors without throwing', async () => {
      mockFetchOk([0.4, 0.5]);
      mockPoolQuery.mockRejectedValueOnce(new Error('delete failed'));

      await expect(
        service.saveUserFact(7, 'Loves sci-fi movies'),
      ).resolves.toBeUndefined();
    });
  });

  describe('consolidateDuplicatePreferences', () => {
    it('should merge duplicate preferences per user and skip users with no duplicates', async () => {
      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ userId: '1' }, { userId: '2' }],
      });
      mockPoolQuery.mockResolvedValueOnce({
        rows: [
          {
            idA: 'uuid-a',
            idB: 'uuid-b',
            createdAtA: '2024-01-01T00:00:00.000Z',
            createdAtB: '2024-02-01T00:00:00.000Z',
          },
        ],
      });
      mockPoolQuery.mockResolvedValueOnce({ rowCount: 1, rows: [] });
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });

      await service.consolidateDuplicatePreferences();

      expect(mockPoolQuery).toHaveBeenCalledTimes(4);
      expect(mockPoolQuery).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('DELETE FROM user_memory_embeddings'),
        [['uuid-a']],
      );
    });

    it('should keep the newer record and delete the older one on a duplicate pair', async () => {
      mockPoolQuery.mockResolvedValueOnce({ rows: [{ userId: '1' }] });
      mockPoolQuery.mockResolvedValueOnce({
        rows: [
          {
            idA: 'older',
            idB: 'newer',
            createdAtA: '2024-01-01T00:00:00.000Z',
            createdAtB: '2024-06-01T00:00:00.000Z',
          },
        ],
      });
      mockPoolQuery.mockResolvedValueOnce({ rowCount: 1, rows: [] });

      await service.consolidateDuplicatePreferences();

      expect(mockPoolQuery).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining('DELETE FROM user_memory_embeddings'),
        [['older']],
      );
    });

    it('should continue with remaining users if one user fails to consolidate', async () => {
      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ userId: '1' }, { userId: '2' }],
      });
      mockPoolQuery.mockRejectedValueOnce(new Error('pairs query failed'));
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.consolidateDuplicatePreferences(),
      ).resolves.toBeUndefined();
      expect(mockPoolQuery).toHaveBeenCalledTimes(3);
    });

    it('should not throw if the top-level users query fails', async () => {
      mockPoolQuery.mockRejectedValueOnce(new Error('users query failed'));

      await expect(
        service.consolidateDuplicatePreferences(),
      ).resolves.toBeUndefined();
    });
  });

  describe('searchSimilarMovies', () => {
    it('should embed the query and map returned rows to pageContent/metadata', async () => {
      mockFetchOk([0.1, 0.2]);
      mockPoolQuery.mockResolvedValueOnce({
        rows: [
          {
            text: 'Title: Fight Club.',
            metadata: { tmdbId: 550, title: 'Fight Club' },
          },
          {
            text: 'Title: Se7en.',
            metadata: JSON.stringify({ tmdbId: 807, title: 'Se7en' }),
          },
        ],
      });

      const result = await service.searchSimilarMovies('gritty thriller', 5);

      expect(result).toEqual([
        { pageContent: 'Title: Fight Club.', metadata: { tmdbId: 550, title: 'Fight Club' } },
        { pageContent: 'Title: Se7en.', metadata: { tmdbId: 807, title: 'Se7en' } },
      ]);
      expect(mockPoolQuery).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY embedding <=> $1::vector'),
        [JSON.stringify([0.1, 0.2]), 5],
      );
    });

    it('should return an empty array when there are no matching rows', async () => {
      mockFetchOk([0.1, 0.2]);
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.searchSimilarMovies('nothing matches');

      expect(result).toEqual([]);
    });

    it('should propagate an error when the Gemini embedding call fails', async () => {
      mockFetchHttpError(500, 'internal error');

      await expect(service.searchSimilarMovies('query')).rejects.toThrow(
        'Gemini embed 500: internal error',
      );
      expect(mockPoolQuery).not.toHaveBeenCalled();
    });

    it('should propagate an error when a row has malformed metadata JSON', async () => {
      mockFetchOk([0.1, 0.2]);
      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ text: 'Broken', metadata: '{not valid json' }],
      });

      await expect(service.searchSimilarMovies('query')).rejects.toThrow();
    });
  });

  describe('searchSimilarMoviesFiltered', () => {
    it('should query without a WHERE clause when no filters are provided', async () => {
      mockFetchOk([0.1]);
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });

      await service.searchSimilarMoviesFiltered('query', {}, undefined, 10);

      const [sql, params] = mockPoolQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).not.toContain('WHERE');
      expect(params).toEqual([JSON.stringify([0.1]), 10]);
    });

    it('should build a WHERE clause with bound parameters for the given filters', async () => {
      mockFetchOk([0.1]);
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });

      await service.searchSimilarMoviesFiltered(
        'query',
        {
          genreId: 18,
          yearFrom: 2000,
          yearTo: 2020,
          minRating: 7,
          runtimeFrom: 90,
          runtimeTo: 180,
        },
        undefined,
        10,
      );

      const [sql, params] = mockPoolQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('genre_ids @> ARRAY[$3]::int[]');
      expect(sql).toContain('release_year >= $4');
      expect(sql).toContain('release_year <= $5');
      expect(sql).toContain('vote_average >= $6');
      expect(sql).toContain('runtime >= $7');
      expect(sql).toContain('runtime <= $8');
      expect(params).toEqual([
        JSON.stringify([0.1]),
        10,
        18,
        2000,
        2020,
        7,
        90,
        180,
      ]);
    });

    it('should include the userId as a bound parameter when excludeWatched is set', async () => {
      mockFetchOk([0.1]);
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });

      await service.searchSimilarMoviesFiltered(
        'query',
        { excludeWatched: true },
        42,
        10,
      );

      const [sql, params] = mockPoolQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('w."userId" = $3');
      expect(params).toEqual([JSON.stringify([0.1]), 10, 42]);
    });

    it('should filter out rows beyond the relevance distance threshold', async () => {
      mockFetchOk([0.1]);
      mockPoolQuery.mockResolvedValueOnce({
        rows: [
          { text: 'Close match', metadata: { tmdbId: 1 }, distance: 0.2 },
          { text: 'Far match', metadata: { tmdbId: 2 }, distance: 0.9 },
        ],
      });

      const result = await service.searchSimilarMoviesFiltered('query', {});

      expect(result).toEqual([
        { pageContent: 'Close match', metadata: { tmdbId: 1 } },
      ]);
    });

    it('should return an empty array when the DB returns no rows', async () => {
      mockFetchOk([0.1]);
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.searchSimilarMoviesFiltered('query', {});

      expect(result).toEqual([]);
    });
  });

  describe('searchSimilarToMovie', () => {
    it('should exclude the source movie and query without extra filters', async () => {
      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ text: 'Similar movie', metadata: { tmdbId: 2 } }],
      });

      const result = await service.searchSimilarToMovie(550, {}, undefined, 10);

      const [sql, params] = mockPoolQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain(`WHERE metadata->>'tmdbId' != $1`);
      expect(params).toEqual(['550', 10]);
      expect(result).toEqual([
        { pageContent: 'Similar movie', metadata: { tmdbId: 2 } },
      ]);
    });

    it('should combine additional filters with the exclusion clause', async () => {
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });

      await service.searchSimilarToMovie(550, { genreId: 18 }, undefined, 10);

      const [sql, params] = mockPoolQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain(`AND metadata->>'tmdbId' != $1`);
      expect(sql).toContain('genre_ids @> ARRAY[$3]::int[]');
      expect(params).toEqual(['550', 10, 18]);
    });

    it('should return an empty array when no similar movie is found', async () => {
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.searchSimilarToMovie(9999, {});

      expect(result).toEqual([]);
    });
  });

  describe('computeTasteCompatibility', () => {
    it('should return null without querying when either id list is empty', async () => {
      const result = await service.computeTasteCompatibility([], [1, 2, 3]);

      expect(result).toBeNull();
      expect(mockPoolQuery).not.toHaveBeenCalled();
    });

    it('should return the similarity score for a valid comparison', async () => {
      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ countA: '5', countB: '4', similarity: 0.82 }],
      });

      const result = await service.computeTasteCompatibility([1, 2, 3], [4, 5, 6]);

      expect(result).toBe(0.82);
      expect(mockPoolQuery).toHaveBeenCalledWith(expect.any(String), [
        [1, 2, 3],
        [4, 5, 6],
      ]);
    });

    it('should return null when either sample size is below the minimum', async () => {
      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ countA: '2', countB: '4', similarity: 0.82 }],
      });

      const result = await service.computeTasteCompatibility([1], [4, 5, 6]);

      expect(result).toBeNull();
    });

    it('should return null when the query fails', async () => {
      mockPoolQuery.mockRejectedValueOnce(new Error('db error'));

      const result = await service.computeTasteCompatibility([1, 2, 3], [4, 5, 6]);

      expect(result).toBeNull();
    });
  });

  describe('getRelevantUserFactsWithScores', () => {
    it('should embed the query and return mapped preference scores', async () => {
      mockFetchOk([0.3]);
      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ text: 'Loves horror', similarity: 0.91 }],
      });

      const result = await service.getRelevantUserFactsWithScores(7, 'scary movies', 3);

      expect(result).toEqual([
        { preferenceText: 'Loves horror', similarityScore: 0.91 },
      ]);
      expect(mockPoolQuery).toHaveBeenCalledWith(
        expect.stringContaining(`metadata->>'userId' = $1`),
        ['7', JSON.stringify([0.3]), 3],
      );
    });

    it('should return an empty array when there are no matching facts', async () => {
      mockFetchOk([0.3]);
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.getRelevantUserFactsWithScores(7, 'query');

      expect(result).toEqual([]);
    });

    it('should return an empty array when the embedding call fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('network error'));

      const result = await service.getRelevantUserFactsWithScores(7, 'query');

      expect(result).toEqual([]);
      expect(mockPoolQuery).not.toHaveBeenCalled();
    });

    it('should return an empty array when the query fails', async () => {
      mockFetchOk([0.3]);
      mockPoolQuery.mockRejectedValueOnce(new Error('db error'));

      const result = await service.getRelevantUserFactsWithScores(7, 'query');

      expect(result).toEqual([]);
    });
  });

  describe('searchPersonalizedForUser', () => {
    it('should return an empty array without querying when likedTmdbIds is empty', async () => {
      const result = await service.searchPersonalizedForUser([], [], 10);

      expect(result).toEqual([]);
      expect(mockPoolQuery).not.toHaveBeenCalled();
    });

    it('should map metadata rows (object and string forms) to candidates', async () => {
      mockPoolQuery.mockResolvedValueOnce({
        rows: [
          { metadata: { tmdbId: 1, title: 'Movie A' } },
          { metadata: JSON.stringify({ tmdbId: 2, title: 'Movie B' }) },
        ],
      });

      const result = await service.searchPersonalizedForUser([1, 2], [3], 10);

      expect(result).toEqual([
        { tmdbId: 1, title: 'Movie A' },
        { tmdbId: 2, title: 'Movie B' },
      ]);
      expect(mockPoolQuery).toHaveBeenCalledWith(expect.any(String), [
        [1, 2],
        [3],
        10,
      ]);
    });

    it('should return an empty array when there are no candidates', async () => {
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });

      const result = await service.searchPersonalizedForUser([1], [], 10);

      expect(result).toEqual([]);
    });
  });

  describe('searchDiverseForUser', () => {
    it('should omit the genre-exclusion condition when familiarGenreIds is empty', async () => {
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });

      await service.searchDiverseForUser([], [1, 2], 5, 10);

      const [sql, params] = mockPoolQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).not.toContain('genre_ids &&');
      expect(sql).toContain('LIMIT $3');
      expect(params).toEqual([[1, 2], 5, 10]);
    });

    it('should include the genre-exclusion condition when familiarGenreIds is provided', async () => {
      mockPoolQuery.mockResolvedValueOnce({ rows: [] });

      await service.searchDiverseForUser([18, 27], [1, 2], 5, 10);

      const [sql, params] = mockPoolQuery.mock.calls[0] as [string, unknown[]];
      expect(sql).toContain('NOT (genre_ids && $3::int[])');
      expect(sql).toContain('LIMIT $4');
      expect(params).toEqual([[1, 2], 5, [18, 27], 10]);
    });

    it('should map returned metadata rows to candidates', async () => {
      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ metadata: { tmdbId: 9, title: 'Discovery Movie' } }],
      });

      const result = await service.searchDiverseForUser([], [], 0, 10);

      expect(result).toEqual([{ tmdbId: 9, title: 'Discovery Movie' }]);
    });
  });
});

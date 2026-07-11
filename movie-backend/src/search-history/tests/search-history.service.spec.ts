import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SearchHistoryService } from '../search-history.service';
import { SearchHistory } from '../search-history.entity';

const mockSearchHistoryRepo = {
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn((data) => data),
  save: jest.fn(),
};

const buildModule = async (): Promise<TestingModule> =>
  Test.createTestingModule({
    providers: [
      SearchHistoryService,
      {
        provide: getRepositoryToken(SearchHistory),
        useValue: mockSearchHistoryRepo,
      },
    ],
  }).compile();

describe('SearchHistoryService', () => {
  let service: SearchHistoryService;

  beforeEach(async () => {
    const module = await buildModule();
    service = module.get<SearchHistoryService>(SearchHistoryService);
    jest.clearAllMocks();
  });

  describe('logSearch', () => {
    it('does nothing for a blank query', async () => {
      await service.logSearch(1, '   ');
      expect(mockSearchHistoryRepo.findOne).not.toHaveBeenCalled();
      expect(mockSearchHistoryRepo.save).not.toHaveBeenCalled();
    });

    it('inserts a new row when there is no recent duplicate', async () => {
      mockSearchHistoryRepo.findOne.mockResolvedValue(null);
      const created = { queryText: 'batman', user: { id: 1 } };
      mockSearchHistoryRepo.create.mockReturnValue(created);

      await service.logSearch(1, ' batman ');

      expect(mockSearchHistoryRepo.create).toHaveBeenCalledWith({
        queryText: 'batman',
        user: { id: 1 },
      });
      expect(mockSearchHistoryRepo.save).toHaveBeenCalledWith(created);
    });

    it('bumps createdAt instead of inserting when the same query was searched recently', async () => {
      const originalCreatedAt = new Date(Date.now() - 60 * 1000);
      const existing = {
        id: 5,
        queryText: 'batman',
        createdAt: originalCreatedAt,
      };
      mockSearchHistoryRepo.findOne.mockResolvedValue(existing);

      await service.logSearch(1, 'batman');

      expect(mockSearchHistoryRepo.create).not.toHaveBeenCalled();
      expect(mockSearchHistoryRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ id: 5 }),
      );
      const savedArg = mockSearchHistoryRepo.save.mock.calls[0][0];
      expect(savedArg.createdAt.getTime()).toBeGreaterThan(
        originalCreatedAt.getTime(),
      );
    });
  });

  describe('getRecentQueries', () => {
    it('de-duplicates case-insensitively, keeping the most recent occurrence', async () => {
      const now = Date.now();
      mockSearchHistoryRepo.find.mockResolvedValue([
        { queryText: 'Batman', createdAt: new Date(now) },
        { queryText: 'inception', createdAt: new Date(now - 1000) },
        { queryText: 'batman', createdAt: new Date(now - 2000) },
      ]);

      const result = await service.getRecentQueries(1, 10);

      expect(result.map((r) => r.queryText)).toEqual(['Batman', 'inception']);
    });

    it('respects the limit', async () => {
      const now = Date.now();
      mockSearchHistoryRepo.find.mockResolvedValue(
        Array.from({ length: 5 }, (_, i) => ({
          queryText: `query-${i}`,
          createdAt: new Date(now - i * 1000),
        })),
      );

      const result = await service.getRecentQueries(1, 2);

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.queryText)).toEqual(['query-0', 'query-1']);
    });
  });
});

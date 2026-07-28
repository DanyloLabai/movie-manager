import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, MoreThan, Repository } from 'typeorm';
import { SearchHistory } from './search-history.entity';
import { User } from '../users/users.entity';

export interface SearchHistoryItemDto {
  queryText: string;
  createdAt: Date;
}

// Re-searching the same thing within this window just bumps createdAt
// instead of inserting a new row, so chips don't fill up with repeats.
const RECENT_DUPLICATE_WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_LIMIT = 10;

@Injectable()
export class SearchHistoryService {
  constructor(
    @InjectRepository(SearchHistory)
    private searchHistoryRepo: Repository<SearchHistory>,
  ) {}

  async logSearch(userId: number, queryText: string): Promise<void> {
    const trimmed = queryText.trim();
    if (!trimmed) return;

    const recentSince = new Date(Date.now() - RECENT_DUPLICATE_WINDOW_MS);
    const existing = await this.searchHistoryRepo.findOne({
      where: {
        user: { id: userId },
        queryText: ILike(trimmed),
        createdAt: MoreThan(recentSince),
      },
      order: { createdAt: 'DESC' },
    });

    if (existing) {
      existing.createdAt = new Date();
      await this.searchHistoryRepo.save(existing);
      return;
    }

    const entry = this.searchHistoryRepo.create({
      queryText: trimmed,
      user: { id: userId } as User,
    });
    await this.searchHistoryRepo.save(entry);
  }

  async getRecentQueries(
    userId: number,
    limit = DEFAULT_LIMIT,
  ): Promise<SearchHistoryItemDto[]> {
    // Pull extra rows before de-duping, since older, out-of-window
    // duplicates (different casing included) can still share a query text.
    const entries = await this.searchHistoryRepo.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
      take: limit * 5,
    });

    const seen = new Set<string>();
    const result: SearchHistoryItemDto[] = [];
    for (const entry of entries) {
      const key = entry.queryText.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ queryText: entry.queryText, createdAt: entry.createdAt });
      if (result.length >= limit) break;
    }
    return result;
  }

  async clearHistory(userId: number): Promise<void> {
    await this.searchHistoryRepo.delete({ user: { id: userId } });
  }
}

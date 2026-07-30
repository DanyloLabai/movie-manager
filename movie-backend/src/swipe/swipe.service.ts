import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SwipeAction } from './swipe-action.entity';
import { WatchlistItem } from '../movies/watchlist-entity';
import { MoviesService } from '../movies/movies.service';
import { DiscoveryCandidate, VectorService } from '../vector/vector.service';
import { SwipeActionDto } from './dto/swipe-action.dto';
import { SwipeCardDto, SwipeFeedResponseDto } from './dto/swipe-card.dto';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class SwipeService {
  private readonly logger = new Logger(SwipeService.name);

  private readonly DAILY_LIMIT = 15;
  private readonly SKIP_COOLDOWN_DAYS = 45;
  private readonly PERSONALIZED_RATIO = 0.6;
  private readonly MIN_LIKED_FOR_PERSONALIZATION = 3;
  private readonly DIVERSE_MIN_RATING = 6.0;
  private readonly FAMILIAR_GENRE_TOP_N = 3;
  private readonly HOOK_MAX_LENGTH = 140;
  // The search-page promo strip introduces the feature to new users; once
  // they've actually tried it a few times it just becomes clutter.
  private readonly PROMO_HIDE_AFTER_USES = 3;

  constructor(
    @InjectRepository(SwipeAction)
    private readonly swipeActionRepo: Repository<SwipeAction>,
    @InjectRepository(WatchlistItem)
    private readonly watchlistRepo: Repository<WatchlistItem>,
    private readonly moviesService: MoviesService,
    private readonly vectorService: VectorService,
  ) {}

  private async getUsage(
    userId: number,
  ): Promise<{ count: number; resetAt: string | null }> {
    const since = new Date(Date.now() - ONE_DAY_MS);
    const count = await this.swipeActionRepo
      .createQueryBuilder('a')
      .where('a."userId" = :userId', { userId })
      .andWhere('a."createdAt" >= :since', { since })
      .getCount();

    let resetAt: string | null = null;
    if (count >= this.DAILY_LIMIT) {
      const oldest = await this.swipeActionRepo
        .createQueryBuilder('a')
        .select('a."createdAt"', 'createdAt')
        .where('a."userId" = :userId', { userId })
        .orderBy('a."createdAt"', 'DESC')
        .limit(this.DAILY_LIMIT)
        .getRawMany<{ createdAt: Date }>();

      const oldestOfWindow = oldest[oldest.length - 1]?.createdAt;
      if (oldestOfWindow) {
        resetAt = new Date(
          new Date(oldestOfWindow).getTime() + ONE_DAY_MS,
        ).toISOString();
      }
    }

    return { count, resetAt };
  }

  // Cheap status check for surfaces outside the feed itself (e.g. the
  // search-page entry button/promo strip) — reuses the same rolling-24h
  // usage query as getFeed but never runs the vector/TMDB hydration work.
  async getStatus(userId: number): Promise<{
    remainingToday: number;
    dailyLimit: number;
    showPromo: boolean;
  }> {
    const { count } = await this.getUsage(userId);
    const totalActionsEver = await this.swipeActionRepo.count({
      where: { user: { id: userId } },
    });

    return {
      remainingToday: Math.max(0, this.DAILY_LIMIT - count),
      dailyLimit: this.DAILY_LIMIT,
      showPromo: totalActionsEver < this.PROMO_HIDE_AFTER_USES,
    };
  }

  async getFeed(userId: number): Promise<SwipeFeedResponseDto> {
    const { count, resetAt } = await this.getUsage(userId);

    if (count >= this.DAILY_LIMIT) {
      return {
        movies: [],
        remainingToday: 0,
        dailyLimit: this.DAILY_LIMIT,
        resetAt,
      };
    }

    const batchSize = this.DAILY_LIMIT - count;

    const watchlistItems = await this.watchlistRepo.find({
      where: { user: { id: userId } },
      select: ['tmdbId', 'isWatched', 'isFavorite'],
    });

    const permanentExcludeIds = watchlistItems.map((w) => w.tmdbId);
    const likedTmdbIds = watchlistItems
      .filter((w) => w.isWatched || w.isFavorite)
      .map((w) => w.tmdbId);

    const cooldownSince = new Date(
      Date.now() - this.SKIP_COOLDOWN_DAYS * ONE_DAY_MS,
    );
    const recentSkips = await this.swipeActionRepo
      .createQueryBuilder('a')
      .select('a."tmdbId"', 'tmdbId')
      .where('a."userId" = :userId', { userId })
      .andWhere('a.action = :action', { action: 'skip' })
      .andWhere('a."createdAt" >= :cooldownSince', { cooldownSince })
      .getRawMany<{ tmdbId: number }>();

    const excludeTmdbIds = Array.from(
      new Set([...permanentExcludeIds, ...recentSkips.map((s) => s.tmdbId)]),
    );

    const usePersonalization =
      likedTmdbIds.length >= this.MIN_LIKED_FOR_PERSONALIZATION;
    const personalizedCount = usePersonalization
      ? Math.round(batchSize * this.PERSONALIZED_RATIO)
      : 0;
    const diverseCount = batchSize - personalizedCount;

    const familiarGenreIds = usePersonalization
      ? await this.getTopGenreIds(likedTmdbIds, this.FAMILIAR_GENRE_TOP_N)
      : [];

    const personalized = usePersonalization
      ? await this.vectorService.searchPersonalizedForUser(
          likedTmdbIds,
          excludeTmdbIds,
          personalizedCount,
        )
      : [];

    const seenSoFar = new Set(personalized.map((p) => p.tmdbId));
    let diverse = await this.vectorService.searchDiverseForUser(
      familiarGenreIds,
      [...excludeTmdbIds, ...seenSoFar],
      this.DIVERSE_MIN_RATING,
      diverseCount,
    );

    const shortfall = batchSize - personalized.length - diverse.length;
    if (shortfall > 0) {
      const alreadySeen = new Set([
        ...excludeTmdbIds,
        ...personalized.map((p) => p.tmdbId),
        ...diverse.map((d) => d.tmdbId),
      ]);
      const backfill = await this.vectorService.searchDiverseForUser(
        [],
        Array.from(alreadySeen),
        this.DIVERSE_MIN_RATING,
        shortfall,
      );
      diverse = [...diverse, ...backfill];
    }

    type CandidateWithMatch = DiscoveryCandidate & {
      matchType: 'personalized' | 'diverse';
    };
    const interleaved = this.interleave<CandidateWithMatch>(
      personalized.map((c) => ({ ...c, matchType: 'personalized' })),
      diverse.map((c) => ({ ...c, matchType: 'diverse' })),
    );

    const movies = await this.hydrateCards(interleaved);

    return {
      movies,
      remainingToday: batchSize,
      dailyLimit: this.DAILY_LIMIT,
      resetAt: null,
    };
  }

  private async getTopGenreIds(
    tmdbIds: number[],
    topN: number,
  ): Promise<number[]> {
    const details = await Promise.all(
      tmdbIds.map((id) =>
        this.moviesService.getMovieDetails(id, 'movie').catch(() => null),
      ),
    );

    const freq = new Map<number, number>();
    for (const d of details) {
      if (!d) continue;
      for (const g of d.genres) {
        freq.set(g.id, (freq.get(g.id) ?? 0) + 1);
      }
    }

    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([id]) => id);
  }

  private interleave<T>(a: T[], b: T[]): T[] {
    const result: T[] = [];
    const max = Math.max(a.length, b.length);
    for (let i = 0; i < max; i++) {
      if (i < a.length) result.push(a[i]);
      if (i < b.length) result.push(b[i]);
    }
    return result;
  }

  private async hydrateCards(
    candidates: Array<{
      tmdbId: number;
      matchType: 'personalized' | 'diverse';
    }>,
  ): Promise<SwipeCardDto[]> {
    const results = await Promise.all(
      candidates.map(async (c) => {
        try {
          const details = await this.moviesService.getMovieDetails(
            c.tmdbId,
            'movie',
          );
          const hook =
            details.overview.length > this.HOOK_MAX_LENGTH
              ? `${details.overview.slice(0, this.HOOK_MAX_LENGTH - 1).trimEnd()}…`
              : details.overview;

          const card: SwipeCardDto = {
            id: details.id,
            title: details.title,
            hook,
            releaseYear: details.releaseDate
              ? details.releaseDate.split('-')[0]
              : 'N/A',
            releaseDate: details.releaseDate || null,
            genres: details.genres.slice(0, 2).map((g) => g.name),
            runtime: details.runtime ?? null,
            voteAverage: details.voteAverage ?? 0,
            posterUrl: details.posterPath
              ? `https://image.tmdb.org/t/p/w500${details.posterPath}`
              : null,
            mediaType: 'movie',
            matchType: c.matchType,
          };
          return card;
        } catch (error) {
          this.logger.warn(
            `Failed to hydrate swipe card for tmdbId ${c.tmdbId}: ${(error as Error).message}`,
          );
          return null;
        }
      }),
    );

    return results.filter((r): r is SwipeCardDto => r !== null);
  }

  async recordAction(
    userId: number,
    dto: SwipeActionDto,
  ): Promise<{ success: true; remainingToday: number; dailyLimit: number }> {
    if (dto.action === 'watched') {
      if (dto.rating === undefined) {
        throw new BadRequestException('Rating is required to mark as watched');
      }

      const existing = await this.moviesService.getMovieUserStatus(
        userId,
        dto.tmdbId,
      );
      if (!existing) {
        await this.moviesService.addToWatchlist(
          userId,
          dto.tmdbId,
          dto.title,
          dto.posterUrl,
          'movie',
          dto.releaseDate,
        );
      }
      await this.moviesService.rateMovie(userId, dto.tmdbId, dto.rating);
    } else if (dto.action === 'watchlist') {
      try {
        await this.moviesService.addToWatchlist(
          userId,
          dto.tmdbId,
          dto.title,
          dto.posterUrl,
          'movie',
          dto.releaseDate,
        );
      } catch (error) {
        if (!(error instanceof BadRequestException)) throw error;
      }
    }

    await this.swipeActionRepo.save(
      this.swipeActionRepo.create({
        tmdbId: dto.tmdbId,
        mediaType: 'movie',
        action: dto.action,
        user: { id: userId },
      }),
    );

    const { count } = await this.getUsage(userId);
    return {
      success: true,
      remainingToday: Math.max(0, this.DAILY_LIMIT - count),
      dailyLimit: this.DAILY_LIMIT,
    };
  }
}

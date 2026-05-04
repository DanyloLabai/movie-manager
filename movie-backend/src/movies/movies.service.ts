import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { InjectRepository } from '@nestjs/typeorm';
import { WatchlistItem } from './watchlist-entity';
import { Repository } from 'typeorm';
import {
  TmdbMultiSearchResponseDto,
  TmdbMultiSearchResultDto,
} from './dto/multi-search-res.dto';
import { MovieResultDto } from './dto/movie-result.dto';
import { MovieDetailsResponse } from './dto/movies-details-response.dto';
import { isAxiosError } from 'axios';
import { TmdbTvDetailsResponse } from './dto/tv-details-response.dto';
import Groq from 'groq-sdk';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { Cron } from '@nestjs/schedule';
import { User } from 'src/users/users.entity';

@Injectable()
export class MoviesService {
  private readonly logger = new Logger(MoviesService.name);
  private readonly tmdbToken: string;
  private readonly baseUrl = 'https://api.themoviedb.org/3';
  private readonly resendApiKey: string;
  private readonly frontendUrl: string;
  private groq: Groq;

  private readonly TTL_24H: number;
  private readonly TTL_1H: number;
  private readonly TTL_7D: number;

  private readonly SEARCH_RESULTS_LIMIT: number;
  private readonly TRENDING_LIMIT: number;
  private readonly UPCOMING_LIMIT: number;
  private readonly SIMILAR_LIMIT: number;
  private readonly ACTOR_KNOWN_FOR_LIMIT: number;
  private readonly CAST_LIMIT: number;
  private readonly PROFILE_RECENT_LIMIT: number;
  private readonly PROFILE_FAVORITES_LIMIT: number;
  private readonly PROFILE_ANALYZE_LIMIT: number;
  private readonly PROFILE_TOP_RATED_LIMIT: number;
  private readonly RECOMMENDATIONS_LIMIT: number;
  private readonly RECOMMENDATIONS_REFERENCE_LIMIT: number;
  private readonly GENRE_DISTRIBUTION_LIMIT: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(WatchlistItem)
    private watchlistRepo: Repository<WatchlistItem>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.tmdbToken = this.configService.get<string>('TMDB_API_TOKEN') as string;
    if (!this.tmdbToken) {
      throw new Error('TMDB_API_TOKEN is not set in environment variables');
    }

    const groqKey = this.configService.get<string>('GROQ_API_KEY') || '';
    this.groq = new Groq({ apiKey: groqKey });

    this.resendApiKey = this.configService.get<string>('RESEND_API_KEY') || '';
    this.frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';

    this.TTL_24H = this.configService.get<number>('CACHE_TTL_24H') || 86400000;
    this.TTL_1H = this.configService.get<number>('CACHE_TTL_1H') || 3600000;
    this.TTL_7D = this.configService.get<number>('CACHE_TTL_7D') || 604800000;

    this.SEARCH_RESULTS_LIMIT =
      this.configService.get<number>('SEARCH_RESULTS_LIMIT') || 20;
    this.TRENDING_LIMIT =
      this.configService.get<number>('TRENDING_LIMIT') || 12;
    this.UPCOMING_LIMIT =
      this.configService.get<number>('UPCOMING_LIMIT') || 16;
    this.SIMILAR_LIMIT = this.configService.get<number>('SIMILAR_LIMIT') || 10;
    this.ACTOR_KNOWN_FOR_LIMIT =
      this.configService.get<number>('ACTOR_KNOWN_FOR_LIMIT') || 20;
    this.CAST_LIMIT = this.configService.get<number>('CAST_LIMIT') || 12;
    this.PROFILE_RECENT_LIMIT =
      this.configService.get<number>('PROFILE_RECENT_LIMIT') || 10;
    this.PROFILE_FAVORITES_LIMIT =
      this.configService.get<number>('PROFILE_FAVORITES_LIMIT') || 5;
    this.PROFILE_ANALYZE_LIMIT =
      this.configService.get<number>('PROFILE_ANALYZE_LIMIT') || 30;
    this.PROFILE_TOP_RATED_LIMIT =
      this.configService.get<number>('PROFILE_TOP_RATED_LIMIT') || 3;

    this.RECOMMENDATIONS_LIMIT =
      this.configService.get<number>('RECOMMENDATIONS_LIMIT') || 20;

    this.RECOMMENDATIONS_REFERENCE_LIMIT =
      this.configService.get<number>('RECOMMENDATIONS_REFERENCE_LIMIT') || 10;
    this.GENRE_DISTRIBUTION_LIMIT =
      this.configService.get<number>('GENRE_DISTRIBUTION_LIMIT') || 5;
  }

  async searchMovies(query: string): Promise<MovieResultDto[]> {
    const cacheKey = `search_v3:${query.toLowerCase().trim().replace(/\s+/g, '_')}`;

    const cached = await this.cacheManager.get<MovieResultDto[]>(cacheKey);
    if (cached) return cached;

    try {
      const requests = [1, 2].map((page) =>
        firstValueFrom(
          this.httpService.get<TmdbMultiSearchResponseDto>(
            `${this.baseUrl}/search/multi`,
            {
              params: { query, language: 'en-US', page },
              headers: { Authorization: `Bearer ${this.tmdbToken}` },
            },
          ),
        ).catch(() => null),
      );

      const responses = await Promise.all(requests);
      let allResults: TmdbMultiSearchResultDto[] = [];

      responses.forEach((res) => {
        if (res?.data?.results) {
          const existingIds = new Set(allResults.map((item) => item.id));
          const newItems = res.data.results.filter(
            (item) => !existingIds.has(item.id),
          );
          allResults = [...allResults, ...newItems];
        }
      });

      if (allResults.length === 0) return [];

      const results = allResults
        .filter(
          (item: TmdbMultiSearchResultDto) =>
            (item.media_type === 'movie' || item.media_type === 'tv') &&
            item.original_language !== 'ru' &&
            item.poster_path,
        )
        .sort((a, b) => {
          const scoreA = (a.vote_average || 0) * (a.vote_count || 0);
          const scoreB = (b.vote_average || 0) * (b.vote_count || 0);
          return scoreB - scoreA;
        })
        .slice(0, 70)
        .map((media: TmdbMultiSearchResultDto) =>
          this.mapMediaToDto(media, media.media_type as 'movie' | 'tv'),
        );

      await this.cacheManager.set(cacheKey, results, this.TTL_24H);
      return results;
    } catch (error: any) {
      this.logger.error(`Search error: ${error.message}`);
      return [];
    }
  }

  async findMovieByTitle(
    title: string,
    year?: number,
  ): Promise<MovieResultDto | null> {
    const cacheKey = `find_title_v2:${title.toLowerCase()}:${year || 'any'}`;
    const cached = await this.cacheManager.get<MovieResultDto>(cacheKey);
    if (cached) return cached;

    try {
      const { data } = await firstValueFrom(
        this.httpService.get<TmdbMultiSearchResponseDto>(
          `${this.baseUrl}/search/multi`,
          {
            params: { query: title, language: 'en-US' },
            headers: { Authorization: `Bearer ${this.tmdbToken}` },
          },
        ),
      );

      if (!data.results || data.results.length === 0) return null;

      let results: TmdbMultiSearchResultDto[] = data.results.filter(
        (r: TmdbMultiSearchResultDto) =>
          (r.media_type === 'movie' || r.media_type === 'tv') &&
          r.original_language !== 'ru',
      );

      if (year && results.length > 0) {
        const exactMatch = results.find((r: TmdbMultiSearchResultDto) => {
          const rYear = (r.release_date || r.first_air_date || '').split(
            '-',
          )[0];
          return rYear === year.toString();
        });
        if (exactMatch) results = [exactMatch];
      }

      if (results.length === 0) return null;

      const media = results[0];
      const result = this.mapMediaToDto(
        media,
        media.media_type as 'movie' | 'tv',
      );

      await this.cacheManager.set(cacheKey, result, this.TTL_24H);
      return result;
    } catch (error: any) {
      this.logger.error(`Error finding media in TMDB: ${error.message}`);
      return null;
    }
  }

  async getTrendingMovies(): Promise<MovieResultDto[]> {
    const cacheKey = 'trending_weekly_v2';
    const cached = await this.cacheManager.get<MovieResultDto[]>(cacheKey);
    if (cached) return cached;

    try {
      const { data } = await firstValueFrom(
        this.httpService.get<TmdbMultiSearchResponseDto>(
          `${this.baseUrl}/trending/all/week`,
          {
            params: { language: 'en-US' },
            headers: { Authorization: `Bearer ${this.tmdbToken}` },
          },
        ),
      );

      if (!data.results) return [];

      const results = data.results
        .filter(
          (item: TmdbMultiSearchResultDto) =>
            item.media_type === 'movie' || item.media_type === 'tv',
        )
        .slice(0, this.TRENDING_LIMIT)
        .map((media: TmdbMultiSearchResultDto) =>
          this.mapMediaToDto(media, media.media_type as 'movie' | 'tv'),
        );

      await this.cacheManager.set(cacheKey, results, this.TTL_24H);
      return results;
    } catch (error: any) {
      this.logger.error(`Error fetching trending: ${error.message}`);
      return [];
    }
  }

  async getUpcomingMovies(): Promise<MovieResultDto[]> {
    const cacheKey = 'upcoming_movies_v2';
    const cached = await this.cacheManager.get<MovieResultDto[]>(cacheKey);
    if (cached) return cached;

    try {
      const today = new Date().toISOString().split('T')[0];
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);
      const futureDate = nextYear.toISOString().split('T')[0];

      const { data } = await firstValueFrom(
        this.httpService.get<any>(`${this.baseUrl}/discover/movie`, {
          params: {
            language: 'en-US',
            page: 1,
            sort_by: 'popularity.desc',
            'primary_release_date.gte': today,
            'primary_release_date.lte': futureDate,
            with_release_type: '2|3',
          },
          headers: { Authorization: `Bearer ${this.tmdbToken}` },
        }),
      );

      const results = data.results
        .filter((media: any) => media.poster_path && media.overview)
        .slice(0, this.UPCOMING_LIMIT)
        .map((media: any) => ({
          id: media.id,
          title: media.title,
          originalTitle: media.original_title || media.title,
          description: media.overview,
          releaseYear: media.release_date
            ? media.release_date.split('-')[0]
            : 'N/A',
          releaseDate: media.release_date || null,
          rating: media.vote_average || 0,
          posterUrl: media.poster_path
            ? `https://image.tmdb.org/t/p/w500${media.poster_path}`
            : null,
          mediaType: 'movie' as const,
        }));

      await this.cacheManager.set(cacheKey, results, this.TTL_24H);
      return results;
    } catch (error: any) {
      this.logger.error(`Error fetching upcoming: ${error.message}`);
      return [];
    }
  }

  async getMovieDetails(tmdbId: number, type: string = 'movie'): Promise<any> {
    const cacheKey = `details_v2:${type}:${tmdbId}`;
    const cached = await this.cacheManager.get<any>(cacheKey);
    if (cached) return cached;

    try {
      const endpoint = type === 'tv' ? 'tv' : 'movie';

      const { data } = await firstValueFrom(
        this.httpService.get<any>(`${this.baseUrl}/${endpoint}/${tmdbId}`, {
          params: {
            language: 'en-US',
            append_to_response: 'videos,watch/providers,credits',
          },
          headers: { Authorization: `Bearer ${this.tmdbToken}` },
        }),
      );

      type TmdbVideo = { site: string; type: string; key: string };
      const videos: TmdbVideo[] = data.videos?.results || [];
      const trailer = videos.find(
        (v) => v.site === 'YouTube' && v.type === 'Trailer',
      );
      const trailerUrl = trailer
        ? `https://www.youtube.com/embed/${trailer.key}`
        : null;

      const watchProviders = data['watch/providers']?.results?.US || null;
      const productionCountries =
        data.production_countries?.map((c: any) => c.name) || [];
      const cast =
        data.credits?.cast?.slice(0, this.CAST_LIMIT).map((actor: any) => ({
          id: actor.id,
          name: actor.name,
          character: actor.character,
          profile_path: actor.profile_path,
        })) || [];

      let result: any;

      if (endpoint === 'tv') {
        const tvData = data as TmdbTvDetailsResponse;
        result = {
          id: tvData.id,
          title: tvData.name,
          overview: tvData.overview,
          release_date: tvData.first_air_date,
          vote_average: tvData.vote_average,
          poster_path: tvData.poster_path,
          backdrop_path: tvData.backdrop_path,
          runtime: tvData.episode_run_time?.[0] || 0,
          genres: tvData.genres,
          mediaType: 'tv',
          trailerUrl,
          watchProviders,
          productionCountries,
          cast,
        };
      } else {
        result = {
          ...(data as MovieDetailsResponse),
          mediaType: 'movie',
          trailerUrl,
          watchProviders,
          productionCountries,
          cast,
        };
      }

      await this.cacheManager.set(cacheKey, result, this.TTL_24H);
      return result;
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        this.logger.error(
          `TMDB Error: ${error.response?.status} - ${error.message}`,
        );
      }
      throw new NotFoundException('Media details not found');
    }
  }

  async getSimilarMovies(
    tmdbId: number,
    type: string = 'movie',
  ): Promise<MovieResultDto[]> {
    const cacheKey = `similar_v2:${type}:${tmdbId}`;
    const cached = await this.cacheManager.get<MovieResultDto[]>(cacheKey);
    if (cached) return cached;

    try {
      const endpoint = type === 'tv' ? 'tv' : 'movie';

      const { data } = await firstValueFrom(
        this.httpService.get<TmdbMultiSearchResponseDto>(
          `${this.baseUrl}/${endpoint}/${tmdbId}/recommendations`,
          {
            params: { language: 'en-US', page: 1 },
            headers: { Authorization: `Bearer ${this.tmdbToken}` },
          },
        ),
      );

      if (!data.results) return [];

      const results = data.results
        .slice(0, this.SIMILAR_LIMIT)
        .map((media: TmdbMultiSearchResultDto) =>
          this.mapMediaToDto(media, type as 'movie' | 'tv'),
        );

      await this.cacheManager.set(cacheKey, results, this.TTL_24H);
      return results;
    } catch (error: any) {
      this.logger.error(`Error fetching similar movies: ${error.message}`);
      return [];
    }
  }

  async getActorDetails(personId: number): Promise<any> {
    const cacheKey = `actor_v2:${personId}`;
    const cached = await this.cacheManager.get<any>(cacheKey);
    if (cached) return cached;

    try {
      const { data } = await firstValueFrom(
        this.httpService.get<any>(`${this.baseUrl}/person/${personId}`, {
          params: {
            language: 'en-US',
            append_to_response: 'combined_credits',
          },
          headers: { Authorization: `Bearer ${this.tmdbToken}` },
        }),
      );

      const credits = data.combined_credits?.cast || [];

      const knownFor = credits
        .sort((a: any, b: any) => (b.popularity || 0) - (a.popularity || 0))
        .slice(0, this.ACTOR_KNOWN_FOR_LIMIT)
        .map((media: any) => ({
          id: media.id,
          title: media.title || media.name || 'Unknown',
          posterUrl: media.poster_path
            ? `https://image.tmdb.org/t/p/w500${media.poster_path}`
            : null,
          mediaType: media.media_type,
          releaseYear:
            (media.release_date || media.first_air_date || '').split('-')[0] ||
            'N/A',
          character: media.character || '',
        }));

      const result = {
        id: data.id,
        name: data.name,
        biography: data.biography,
        profileUrl: data.profile_path
          ? `https://image.tmdb.org/t/p/h632${data.profile_path}`
          : null,
        birthday: data.birthday,
        placeOfBirth: data.place_of_birth,
        knownFor,
      };

      await this.cacheManager.set(cacheKey, result, this.TTL_7D);
      return result;
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        this.logger.error(
          `TMDB Error: ${error.response?.status} - ${error.message}`,
        );
      }
      throw new NotFoundException('Actor details not found');
    }
  }

  async getProfileData(userId: number) {
    const [user, favorites, recent, watchedItems, inPlansItems, totalCount] =
      await Promise.all([
        this.usersRepo.findOne({ where: { id: userId } }),
        this.watchlistRepo.find({
          where: { user: { id: userId }, isFavorite: true },
          order: { updatedAt: 'DESC' },
          take: this.PROFILE_FAVORITES_LIMIT,
        }),
        this.watchlistRepo.find({
          where: { user: { id: userId } },
          order: { updatedAt: 'DESC' },
          take: this.PROFILE_RECENT_LIMIT,
        }),
        this.watchlistRepo.find({
          where: { user: { id: userId }, isWatched: true },
        }),
        this.watchlistRepo.find({
          where: { user: { id: userId }, isWatched: false },
        }),
        this.watchlistRepo.count({
          where: { user: { id: userId } },
        }),
      ]);

    const topRated = watchedItems
      .filter((item) => item.rating && item.rating > 0)
      .sort((a, b) => {
        if (b.rating !== a.rating) return (b.rating || 0) - (a.rating || 0);
        const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, this.PROFILE_TOP_RATED_LIMIT);

    let totalMinutes = 0;
    const genreCounts: Record<string, number> = {};
    let longestMovie = { title: 'None', runtime: 0 };
    const actorCounts: Record<
      string,
      { count: number; name: string; profileUrl: string | null }
    > = {};

    const itemsToAnalyze = watchedItems.slice(-this.PROFILE_ANALYZE_LIMIT);

    const detailsResults = await Promise.all(
      itemsToAnalyze.map((item) =>
        this.getMovieDetails(item.tmdbId, item.mediaType).catch(() => null),
      ),
    );

    detailsResults.forEach((detail) => {
      if (!detail) return;

      totalMinutes += detail.runtime || 0;
      detail.genres?.forEach((g: any) => {
        genreCounts[g.name] = (genreCounts[g.name] || 0) + 1;
      });

      if (detail.runtime && detail.runtime > longestMovie.runtime) {
        longestMovie = { title: detail.title, runtime: detail.runtime };
      }

      if (detail.cast && Array.isArray(detail.cast)) {
        detail.cast.slice(0, 5).forEach((actor: any) => {
          if (!actorCounts[actor.id]) {
            actorCounts[actor.id] = {
              count: 0,
              name: actor.name,
              profileUrl: actor.profile_path
                ? `https://image.tmdb.org/t/p/w185${actor.profile_path}`
                : null,
            };
          }
          actorCounts[actor.id].count += 1;
        });
      }
    });

    const genreDistribution = Object.entries(genreCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, this.GENRE_DISTRIBUTION_LIMIT);

    const topGenre =
      genreDistribution.length > 0 ? genreDistribution[0].name : 'N/A';

    const ratingDistribution = [1, 2, 3, 4, 5].map((star) => ({
      name: String(star),
      value: 0,
    }));
    let totalRatingSum = 0;
    let ratedCount = 0;

    watchedItems.forEach((item) => {
      if (item.rating && item.rating >= 1 && item.rating <= 5) {
        ratingDistribution[item.rating - 1].value += 1;
        totalRatingSum += item.rating;
        ratedCount += 1;
      }
    });

    const averageRating =
      ratedCount > 0 ? (totalRatingSum / ratedCount).toFixed(1) : '0.0';

    const totalWatchlist = watchedItems.length + inPlansItems.length;
    const completionRate =
      totalWatchlist > 0
        ? Math.round((watchedItems.length / totalWatchlist) * 100)
        : 0;

    const sortedActors = Object.values(actorCounts).sort(
      (a, b) => b.count - a.count,
    );
    const topActor =
      sortedActors.length > 0 && sortedActors[0].count > 1
        ? sortedActors[0]
        : null;

    const moviesCount = watchedItems.filter(
      (item) => item.mediaType === 'movie',
    ).length;
    const tvCount = watchedItems.filter(
      (item) => item.mediaType === 'tv',
    ).length;

    const decadeCounts: Record<string, number> = {};
    watchedItems.forEach((item) => {
      const yearStr = item.releaseDate ? item.releaseDate.split('-')[0] : null;
      if (yearStr) {
        const year = parseInt(yearStr, 10);
        if (!isNaN(year)) {
          const decade = `${Math.floor(year / 10) * 10}s`;
          decadeCounts[decade] = (decadeCounts[decade] || 0) + 1;
        }
      }
    });
    const favoriteDecade =
      Object.entries(decadeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

    return {
      id: user?.id,
      username: user?.username,
      avatarUrl: user?.avatarUrl,
      favorites,
      recent,
      watchedIds: watchedItems.map((item) => item.tmdbId),
      inPlansIds: inPlansItems.map((item) => item.tmdbId),
      watchedCount: watchedItems.length,
      totalCount,
      stats: {
        totalMinutes,
        topGenre,
        genreDistribution,
        topRated,
        averageRating,
        moviesCount,
        tvCount,
        favoriteDecade,
        ratingDistribution,
        completionRate,
        longestMovie,
        topActor,
      },
    };
  }

  async addToWatchlist(
    userId: number,
    tmdbId: number,
    title: string,
    posterUrl?: string,
    mediaType: 'movie' | 'tv' = 'movie',
    releaseDate?: string,
  ) {
    const existing = await this.watchlistRepo.findOne({
      where: { user: { id: userId }, tmdbId },
    });

    if (existing) {
      throw new BadRequestException('Media is already in your watchlist');
    }

    const newItem = this.watchlistRepo.create({
      tmdbId,
      title,
      posterUrl,
      mediaType,
      releaseDate,
      user: { id: userId },
    });

    await this.cacheManager
      .del(`recommendations:user:${userId}`)
      .catch(() => {});

    return this.watchlistRepo.save(newItem);
  }

  async getWatchlist(userId: number) {
    return this.watchlistRepo.find({
      where: { user: { id: userId }, isWatched: false },
      order: { addedAt: 'DESC' },
    });
  }

  async getWatchedMovies(userId: number) {
    return this.watchlistRepo.find({
      where: { user: { id: userId }, isWatched: true },
      order: { addedAt: 'DESC' },
    });
  }

  async markAsWatched(userId: number, tmdbId: number) {
    const item = await this.watchlistRepo.findOne({
      where: { user: { id: userId }, tmdbId },
    });

    if (!item) throw new NotFoundException('Media not found in your list');

    item.isWatched = true;
    item.updatedAt = new Date();

    await this.cacheManager
      .del(`recommendations:user:${userId}`)
      .catch(() => {});

    return this.watchlistRepo.save(item);
  }

  async rateMovie(userId: number, tmdbId: number, rating: number) {
    const item = await this.watchlistRepo.findOne({
      where: { user: { id: userId }, tmdbId },
    });

    if (!item) throw new NotFoundException('Media not found in your list');

    item.rating = rating;
    item.isWatched = true;
    item.updatedAt = new Date();

    await this.cacheManager
      .del(`recommendations:user:${userId}`)
      .catch(() => {});

    return this.watchlistRepo.save(item);
  }

  async toggleFavorite(userId: number, tmdbId: number) {
    const item = await this.watchlistRepo.findOne({
      where: { user: { id: userId }, tmdbId },
    });

    if (!item) throw new NotFoundException('Media not found in your list');

    item.isFavorite = !item.isFavorite;
    item.updatedAt = new Date();

    await this.cacheManager
      .del(`recommendations:user:${userId}`)
      .catch(() => {});

    return this.watchlistRepo.save(item);
  }

  async getMovieUserStatus(userId: number, tmdbId: number) {
    return (
      (await this.watchlistRepo.findOne({
        where: { user: { id: userId }, tmdbId },
      })) || null
    );
  }

  async removeFromWatchlist(userId: number, tmdbId: number) {
    const result = await this.watchlistRepo.delete({
      user: { id: userId },
      tmdbId,
    });

    if (result.affected === 0) {
      throw new NotFoundException(
        `Media with TMDB ID ${tmdbId} not found in your watchlist`,
      );
    }

    await this.cacheManager
      .del(`recommendations:user:${userId}`)
      .catch(() => {});

    return { message: 'Successfully removed' };
  }

  async getRecommendationsForUser(userId: number): Promise<MovieResultDto[]> {
    const cacheKey = `recommendations:user:${userId}`;
    const cached = await this.cacheManager.get<MovieResultDto[]>(cacheKey);
    if (cached) return cached;

    try {
      let userItems = await this.watchlistRepo.find({
        where: { user: { id: userId }, isFavorite: true },
        take: 30,
      });

      if (userItems.length < this.RECOMMENDATIONS_REFERENCE_LIMIT) {
        const existingIds = new Set(userItems.map((i) => i.tmdbId));
        const watchedItems = await this.watchlistRepo.find({
          where: { user: { id: userId }, isWatched: true },
          order: { rating: 'DESC', updatedAt: 'DESC' },
        });
        for (const item of watchedItems) {
          if (userItems.length >= this.RECOMMENDATIONS_REFERENCE_LIMIT) break;
          if (!existingIds.has(item.tmdbId)) {
            userItems.push(item);
            existingIds.add(item.tmdbId);
          }
        }
      }

      if (userItems.length < 3) {
        const existingIds2 = new Set(userItems.map((i) => i.tmdbId));
        const inPlansItems = await this.watchlistRepo.find({
          where: { user: { id: userId }, isWatched: false },
          order: { addedAt: 'DESC' },
        });
        for (const item of inPlansItems) {
          if (userItems.length >= this.RECOMMENDATIONS_REFERENCE_LIMIT) break;
          if (!existingIds2.has(item.tmdbId)) {
            userItems.push(item);
            existingIds2.add(item.tmdbId);
          }
        }
      }

      if (userItems.length === 0) return [];

      const referenceTitles = userItems.map((item) => item.title).join(', ');

      const prompt = `
        You are an elite movie recommendation engine. The user likes these movies/shows: ${referenceTitles}.
        Suggest exactly ${this.RECOMMENDATIONS_LIMIT} highly relevant movies or tv shows that they would love.
        Do not include the ones they already like.
        CRITICAL RULE: DO NOT recommend any Russian or Soviet movies/shows.
        Return ONLY a raw JSON array of strings containing the titles. No markdown, no explanations, no backticks.
        Example format: ["Title 1", "Title 2", "Title 3"]
      `;

      const chatCompletion = await this.groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
      });

      const aiResponseText =
        chatCompletion.choices[0]?.message?.content || '[]';
      const cleanedText = aiResponseText
        .replace(/```json/gi, '')
        .replace(/```/g, '')
        .trim();

      const recommendedTitles = JSON.parse(cleanedText) as string[];

      const tmdbResults = await Promise.all(
        recommendedTitles.map((title) => this.findMovieByTitle(title)),
      );

      const results = tmdbResults
        .filter((movie): movie is MovieResultDto => movie !== null)
        .slice(0, this.RECOMMENDATIONS_LIMIT);

      await this.cacheManager.set(cacheKey, results, this.TTL_1H);
      return results;
    } catch (error: any) {
      this.logger.error(
        `Error generating AI recommendations: ${error.message}`,
      );
      return [];
    }
  }

  @Cron('0 9 * * *')
  async notifyAboutReleasedMovies() {
    this.logger.log('Running daily check for released movies...');

    const today = new Date().toISOString().split('T')[0];

    try {
      const releasedToday = await this.watchlistRepo.find({
        where: {
          releaseDate: today,
          isWatched: false,
        },
        relations: ['user'],
      });

      if (releasedToday.length === 0) {
        this.logger.log('No unreleased movies released today.');
        return;
      }

      for (const item of releasedToday) {
        if (!item.user?.email) continue;

        try {
          await firstValueFrom(
            this.httpService.post(
              'https://api.resend.com/emails',
              {
                from: 'Lumen Movie Tracker <noreply@movietracker.ink>',
                to: [item.user.email],
                subject: `🍿 "${item.title}" is officially out today!`,
                html: `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #12100e; color: #f0e6cc; padding: 30px; border-radius: 12px; border: 1px solid #c8963c40;">
                    <h2 style="color: #c8963c; text-transform: uppercase;">It's Premiere Day! 🎬</h2>
                    <p>Hi ${item.user.username},</p>
                    <p>Great news! <strong>${item.title}</strong>, which you added to your "In Plans" list, is officially released today (${today}).</p>
                    ${item.posterUrl ? `<img src="${item.posterUrl}" alt="${item.title}" style="max-width: 200px; border-radius: 8px; margin: 20px 0; border: 1px solid #c8963c;" />` : ''}
                    <p>Grab some popcorn and enjoy the show! Don't forget to mark it as "Watched" and leave a rating.</p>
                    <a href="${this.frontendUrl}/movie/${item.tmdbId}?type=${item.mediaType}"
                       style="display: inline-block; padding: 12px 24px; background-color: #c8963c; color: #12100e; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 10px;">
                      View Details
                    </a>
                  </div>
                `,
              },
              {
                headers: {
                  Authorization: `Bearer ${this.resendApiKey}`,
                  'Content-Type': 'application/json',
                },
              },
            ),
          );

          this.logger.log(
            `Sent release email to ${item.user.email} for "${item.title}"`,
          );
        } catch (emailError: any) {
          this.logger.error(
            `Failed to send email for "${item.title}": ${emailError.message}`,
          );
        }
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to process daily movie releases: ${error.message}`,
      );
    }
  }

  private mapMediaToDto(
    media: TmdbMultiSearchResultDto,
    mediaType: 'movie' | 'tv',
  ): MovieResultDto {
    return {
      id: media.id,
      title: media.title || media.name || 'Unknown',
      originalTitle:
        media.original_title ||
        media.original_name ||
        media.title ||
        media.name ||
        'Unknown',
      description: media.overview || '',
      releaseYear:
        (media.release_date || media.first_air_date || '').split('-')[0] ||
        'N/A',
      releaseDate: media.release_date || media.first_air_date || null,
      rating: media.vote_average || 0,
      posterUrl: media.poster_path
        ? `https://image.tmdb.org/t/p/w500${media.poster_path}`
        : null,
      mediaType,
    };
  }

  async getTop100(type: 'movie' | 'tv'): Promise<MovieResultDto[]> {
    const cacheKey = `top_100_v2_${type}_filtered`;
    const cached = await this.cacheManager.get<MovieResultDto[]>(cacheKey);
    if (cached) return cached;

    try {
      const endpoint = type === 'tv' ? 'discover/tv' : 'discover/movie';
      const minVotes = type === 'movie' ? 10000 : 3000;

      const requests = Array.from({ length: 5 }, (_, i) =>
        firstValueFrom(
          this.httpService.get<any>(`${this.baseUrl}/${endpoint}`, {
            params: {
              language: 'en-US',
              page: i + 1,
              sort_by: 'vote_average.desc',
              'vote_count.gte': minVotes,
              without_original_language: 'ru',
              ...(type === 'tv' ? { without_genres: '10763,10767' } : {}),
            },
            headers: { Authorization: `Bearer ${this.tmdbToken}` },
          }),
        ),
      );

      const responses = await Promise.all(requests);
      let results: MovieResultDto[] = [];

      responses.forEach((response) => {
        const mapped = response.data.results
          .filter((media: any) => media.poster_path)
          .map((media: any) => ({
            id: media.id,
            title: media.title || media.name,
            originalTitle: media.original_title || media.original_name,
            description: media.overview || '',
            releaseYear:
              (media.release_date || media.first_air_date || '').split(
                '-',
              )[0] || 'N/A',
            releaseDate: media.release_date || media.first_air_date || null,
            rating: media.vote_average || 0,
            posterUrl: `https://image.tmdb.org/t/p/w500${media.poster_path}`,
            mediaType: type,
          }));
        results = [...results, ...mapped];
      });

      const final100 = results.slice(0, 100);
      await this.cacheManager.set(cacheKey, final100, this.TTL_7D);
      return final100;
    } catch (error: any) {
      this.logger.error(`Error fetching Top 100 ${type}: ${error.message}`);
      return [];
    }
  }
}

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
import { Cache } from 'cache-manager';

@Injectable()
export class MoviesService {
  private readonly logger = new Logger(MoviesService.name);
  private readonly tmdbToken: string;
  private readonly baseUrl = 'https://api.themoviedb.org/3';
  private groq: Groq;

  private readonly TTL_24H = 86400000;
  private readonly TTL_1H = 3600000;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectRepository(WatchlistItem)
    private watchlistRepo: Repository<WatchlistItem>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.tmdbToken = this.configService.get<string>('TMDB_API_TOKEN') as string;
    if (!this.tmdbToken) {
      throw new Error('Api key is not set in environment variable');
    }

    const groqKey = this.configService.get<string>('GROQ_API_KEY') || '';
    this.groq = new Groq({ apiKey: groqKey });
  }

  async searchMovies(query: string): Promise<MovieResultDto[]> {
    const cacheKey = `search:${query.toLowerCase().trim().replace(/\s+/g, '_')}`;

    const cached = await this.cacheManager.get<MovieResultDto[]>(cacheKey);
    if (cached) return cached;

    try {
      const { data } = await firstValueFrom(
        this.httpService.get<TmdbMultiSearchResponseDto>(
          `${this.baseUrl}/search/multi`,
          {
            params: { query, language: 'en-US' },
            headers: { Authorization: `Bearer ${this.tmdbToken}` },
          },
        ),
      );

      if (!data.results) return [];

      const mediaResults = data.results.filter(
        (item: TmdbMultiSearchResultDto) =>
          item.media_type === 'movie' || item.media_type === 'tv',
      );

      const results = mediaResults.map((media: TmdbMultiSearchResultDto) => ({
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
        rating: media.vote_average || 0,
        posterUrl: media.poster_path
          ? `https://image.tmdb.org/t/p/w500${media.poster_path}`
          : null,
        mediaType: media.media_type as 'movie' | 'tv',
      }));

      await this.cacheManager.set(cacheKey, results, this.TTL_24H);
      return results;
    } catch {
      return [];
    }
  }

  async findMovieByTitle(
    title: string,
    year?: number,
  ): Promise<MovieResultDto | null> {
    const cacheKey = `find_title:${title.toLowerCase()}:${year || 'any'}`;
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
          r.media_type === 'movie' || r.media_type === 'tv',
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

      const media: TmdbMultiSearchResultDto = results[0];

      const result = {
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
        rating: media.vote_average || 0,
        posterUrl: media.poster_path
          ? `https://image.tmdb.org/t/p/w500${media.poster_path}`
          : null,
        mediaType: media.media_type as 'movie' | 'tv',
      };

      await this.cacheManager.set(cacheKey, result, this.TTL_24H);
      return result;
    } catch (error: any) {
      this.logger.error(`Error finding media in TMDB: ${error.message}`);
      return null;
    }
  }

  async getProfileData(userId: number) {
    const [favorites, recent, watchedItems, totalCount] = await Promise.all([
      this.watchlistRepo.find({
        where: { user: { id: userId }, isFavorite: true },
        order: { updatedAt: 'DESC' },
        take: 5,
      }),
      this.watchlistRepo.find({
        where: { user: { id: userId } },
        order: { updatedAt: 'DESC' },
        take: 10,
      }),
      this.watchlistRepo.find({
        where: { user: { id: userId }, isWatched: true },
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
      .slice(0, 3);

    let totalMinutes = 0;
    const genreCounts: Record<string, number> = {};
    const itemsToAnalyze = watchedItems.slice(-30);
    const detailsPromises = itemsToAnalyze.map((item) =>
      this.getMovieDetails(item.tmdbId, item.mediaType).catch(() => null),
    );

    const detailsResults = await Promise.all(detailsPromises);

    detailsResults.forEach((detail) => {
      if (detail) {
        totalMinutes += detail.runtime || 0;
        detail.genres?.forEach((g) => {
          genreCounts[g.name] = (genreCounts[g.name] || 0) + 1;
        });
      }
    });

    const genreDistribution = Object.entries(genreCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const topGenre =
      genreDistribution.length > 0 ? genreDistribution[0].name : 'N/A';

    return {
      favorites,
      recent,
      watchedCount: watchedItems.length,
      totalCount,
      stats: {
        totalMinutes,
        topGenre,
        genreDistribution,
        topRated,
      },
    };
  }

  async getTrendingMovies(): Promise<MovieResultDto[]> {
    const cacheKey = 'trending_weekly';
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

      const mediaResults = data.results.filter(
        (item: TmdbMultiSearchResultDto) =>
          item.media_type === 'movie' || item.media_type === 'tv',
      );

      const results = mediaResults
        .slice(0, 12)
        .map((media: TmdbMultiSearchResultDto) => ({
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
          rating: media.vote_average || 0,
          posterUrl: media.poster_path
            ? `https://image.tmdb.org/t/p/w500${media.poster_path}`
            : null,
          mediaType: media.media_type as 'movie' | 'tv',
        }));

      await this.cacheManager.set(cacheKey, results, this.TTL_24H);
      return results;
    } catch (error: any) {
      this.logger.error(`Error fetching trending: ${error.message}`);
      return [];
    }
  }

  async getMovieDetails(
    tmdbId: number,
    type: string = 'movie',
  ): Promise<MovieDetailsResponse> {
    const cacheKey = `details:${type}:${tmdbId}`;
    const cached = await this.cacheManager.get<MovieDetailsResponse>(cacheKey);
    if (cached) return cached;

    try {
      const endpoint = type === 'tv' ? 'tv' : 'movie';

      const { data } = await firstValueFrom(
        this.httpService.get<any>(`${this.baseUrl}/${endpoint}/${tmdbId}`, {
          params: { language: 'en-US', append_to_response: 'videos' },
          headers: { Authorization: `Bearer ${this.tmdbToken}` },
        }),
      );

      type TmdbVideo = { site: string; type: string; key: string };
      const videoData = data as { videos?: { results: TmdbVideo[] } };
      const videos = videoData.videos?.results || [];
      const trailer = videos.find(
        (v) => v.site === 'YouTube' && v.type === 'Trailer',
      );

      const trailerUrl = trailer
        ? `https://www.youtube.com/embed/${trailer.key}`
        : null;

      let result: MovieDetailsResponse;

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
        };
      } else {
        const movieData = data as MovieDetailsResponse;
        result = {
          ...movieData,
          mediaType: 'movie',
          trailerUrl,
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
    const cacheKey = `similar:${type}:${tmdbId}`;
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
        .slice(0, 10)
        .map((media: TmdbMultiSearchResultDto) => ({
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
          rating: media.vote_average || 0,
          posterUrl: media.poster_path
            ? `https://image.tmdb.org/t/p/w500${media.poster_path}`
            : null,
          mediaType: type as 'movie' | 'tv',
        }));

      await this.cacheManager.set(cacheKey, results, this.TTL_24H);
      return results;
    } catch (error: any) {
      this.logger.error(`Error fetching similar movies: ${error.message}`);
      return [];
    }
  }

  async addToWatchlist(
    userId: number,
    tmdbId: number,
    title: string,
    posterUrl?: string,
    mediaType: 'movie' | 'tv' = 'movie',
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
      user: { id: userId },
    });

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
    return this.watchlistRepo.save(item);
  }

  async toggleFavorite(userId: number, tmdbId: number) {
    const item = await this.watchlistRepo.findOne({
      where: { user: { id: userId }, tmdbId },
    });

    if (!item) throw new NotFoundException('Media not found in your list');

    item.isFavorite = !item.isFavorite;
    item.updatedAt = new Date();
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
      tmdbId: tmdbId,
    });

    if (result.affected === 0) {
      throw new NotFoundException(
        `Media with TMDB ID ${tmdbId} not found in your watchlist`,
      );
    }

    return { message: 'Successfully removed' };
  }

  async getRecommendationsForUser(userId: number): Promise<MovieResultDto[]> {
    try {
      let userItems = await this.watchlistRepo.find({
        where: { user: { id: userId }, isFavorite: true },
        take: 30,
      });

      if (userItems.length < 10) {
        const existingTmdbIds = userItems.map((item) => item.tmdbId);

        const watchedItems = await this.watchlistRepo.find({
          where: { user: { id: userId }, isWatched: true },
          order: { rating: 'DESC', updatedAt: 'DESC' },
        });

        for (const item of watchedItems) {
          if (userItems.length >= 10) break;
          if (!existingTmdbIds.includes(item.tmdbId)) {
            userItems.push(item);
            existingTmdbIds.push(item.tmdbId);
          }
        }
      }

      if (userItems.length < 3) {
        const existingTmdbIds = userItems.map((item) => item.tmdbId);

        const inPlansItems = await this.watchlistRepo.find({
          where: { user: { id: userId }, isWatched: false },
          order: { addedAt: 'DESC' },
        });

        for (const item of inPlansItems) {
          if (userItems.length >= 10) break;
          if (!existingTmdbIds.includes(item.tmdbId)) {
            userItems.push(item);
            existingTmdbIds.push(item.tmdbId);
          }
        }
      }

      if (!userItems || userItems.length === 0) {
        return [];
      }

      const referenceTitles = userItems.map((item) => item.title).join(', ');

      const prompt = `
        You are an elite movie recommendation engine. The user likes these movies/shows: ${referenceTitles}.
        Suggest exactly 8 highly relevant movies or tv shows that they would love.
        Do not include the ones they already like.
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

      const tmdbRequests = recommendedTitles.map(async (title) => {
        return this.findMovieByTitle(title);
      });

      const tmdbResults = await Promise.all(tmdbRequests);

      return tmdbResults
        .filter((movie): movie is MovieResultDto => movie !== null)
        .slice(0, 8);
    } catch (error: any) {
      this.logger.error(
        `Error generating AI recommendations: ${error.message}`,
      );
      return [];
    }
  }
}

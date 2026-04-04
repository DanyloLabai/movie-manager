import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
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

@Injectable()
export class MoviesService {
  private readonly logger = new Logger(MoviesService.name);
  private readonly tmdbToken: string;
  private readonly baseUrl = 'https://api.themoviedb.org/3';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    @InjectRepository(WatchlistItem)
    private watchlistRepo: Repository<WatchlistItem>,
  ) {
    this.tmdbToken = this.configService.get<string>('TMDB_API_TOKEN') as string;
    if (!this.tmdbToken) {
      throw new Error('Api key is not set in environment variable');
    }
  }

  async searchMovies(query: string): Promise<MovieResultDto[]> {
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

      return mediaResults.map((media: TmdbMultiSearchResultDto) => ({
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
    } catch {
      return [];
    }
  }

  async findMovieByTitle(
    title: string,
    year?: number,
  ): Promise<MovieResultDto | null> {
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
        rating: media.vote_average || 0,
        posterUrl: media.poster_path
          ? `https://image.tmdb.org/t/p/w500${media.poster_path}`
          : null,
        mediaType: media.media_type as 'movie' | 'tv',
      };
    } catch (error: any) {
      this.logger.error(`Error finding media in TMDB: ${error.message}`);
      return null;
    }
  }

  async addToWatchlist(
    userId: string,
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

  async getWatchlist(userId: string) {
    return this.watchlistRepo.find({
      where: { user: { id: userId }, isWatched: false },
      order: { addedAt: 'DESC' },
    });
  }

  async getWatchedMovies(userId: string) {
    return this.watchlistRepo.find({
      where: { user: { id: userId }, isWatched: true },
      order: { addedAt: 'DESC' },
    });
  }

  async markAsWatched(userId: string, tmdbId: number) {
    const item = await this.watchlistRepo.findOne({
      where: { user: { id: userId }, tmdbId },
    });

    if (!item) throw new NotFoundException('Media not found in your list');

    item.isWatched = true;
    item.updatedAt = new Date();
    return this.watchlistRepo.save(item);
  }

  async rateMovie(userId: string, tmdbId: number, rating: number) {
    const item = await this.watchlistRepo.findOne({
      where: { user: { id: userId }, tmdbId },
    });

    if (!item) throw new NotFoundException('Media not found in your list');

    item.rating = rating;
    item.isWatched = true;
    item.updatedAt = new Date();
    return this.watchlistRepo.save(item);
  }

  async toggleFavorite(userId: string, tmdbId: number) {
    const item = await this.watchlistRepo.findOne({
      where: { user: { id: userId }, tmdbId },
    });

    if (!item) throw new NotFoundException('Media not found in your list');

    item.isFavorite = !item.isFavorite;
    item.updatedAt = new Date();
    return this.watchlistRepo.save(item);
  }

  async getProfileData(userId: string) {
    const [favorites, recent, watchedCount, totalCount] = await Promise.all([
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
      this.watchlistRepo.count({
        where: { user: { id: userId }, isWatched: true },
      }),
      this.watchlistRepo.count({
        where: { user: { id: userId } },
      }),
    ]);

    return {
      favorites,
      recent,
      watchedCount,
      totalCount,
    };
  }

  async getTrendingMovies(): Promise<MovieResultDto[]> {
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

      return mediaResults
        .slice(0, 6)
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
    } catch (error: any) {
      this.logger.error(`Error fetching trending: ${error.message}`);
      return [];
    }
  }

  async getMovieDetails(
    tmdbId: number,
    type: string = 'movie',
  ): Promise<MovieDetailsResponse> {
    try {
      const endpoint = type === 'tv' ? 'tv' : 'movie';

      const { data } = await firstValueFrom(
        this.httpService.get<TmdbTvDetailsResponse | MovieDetailsResponse>(
          `${this.baseUrl}/${endpoint}/${tmdbId}`,
          {
            params: { language: 'en-US' },
            headers: { Authorization: `Bearer ${this.tmdbToken}` },
          },
        ),
      );

      if (endpoint === 'tv') {
        const tvData = data as TmdbTvDetailsResponse;

        return {
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
        };
      }

      const movieData = data as MovieDetailsResponse;
      return { ...movieData, mediaType: 'movie' };
    } catch (error: unknown) {
      if (isAxiosError(error)) {
        this.logger.error(
          `TMDB Error: ${error.response?.status} - ${error.message}`,
        );
      }
      throw new NotFoundException('Media details not found');
    }
  }

  async getMovieUserStatus(userId: string, tmdbId: number) {
    return (
      (await this.watchlistRepo.findOne({
        where: { user: { id: userId }, tmdbId },
      })) || null
    );
  }

  async removeFromWatchlist(userId: string, tmdbId: number) {
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
}

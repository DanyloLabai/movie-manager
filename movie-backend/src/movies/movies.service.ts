import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { MovieResultDto } from './dto/movie-result.dto';
import { TmdbSearchResponseDto } from './dto/tmdb-response.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { WatchlistItem } from './watchlist-entity';
import { Repository } from 'typeorm';
export interface MovieDetailsResponse {
  id: number;
  title: string;
  overview: string;
  release_date: string;
  vote_average: number;
  poster_path: string | null;
  backdrop_path: string | null;
  runtime: number;
  genres: { id: number; name: string }[];
  [key: string]: unknown;
}

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
    if (this.tmdbToken === undefined || this.tmdbToken === '') {
      throw new Error('Api key is not set in environment variable');
    }
  }

  async searchMovies(title: string): Promise<MovieResultDto[]> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<TmdbSearchResponseDto>(
          `${this.baseUrl}/search/movie`,
          {
            params: { query: title, language: 'en-US' },
            headers: { Authorization: `Bearer ${this.tmdbToken}` },
          },
        ),
      );

      if (!data.results) return [];

      return data.results.map((movie) => ({
        id: movie.id,
        title: movie.title,
        originalTitle: movie.original_title,
        description: movie.overview,
        releaseYear: movie.release_date
          ? movie.release_date.split('-')[0]
          : 'N/A',
        rating: movie.vote_average,
        posterUrl: movie.poster_path
          ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
          : null,
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
        this.httpService.get<TmdbSearchResponseDto>(
          `${this.baseUrl}/search/movie`,
          {
            params: {
              query: title,
              primary_release_year: year,
              language: 'en-US',
            },
            headers: { Authorization: `Bearer ${this.tmdbToken}` },
          },
        ),
      );

      if (!data.results || data.results.length === 0) return null;

      const movie = data.results[0];

      return {
        id: movie.id,
        title: movie.title,
        originalTitle: movie.original_title,
        description: movie.overview,
        releaseYear: movie.release_date
          ? movie.release_date.split('-')[0]
          : 'N/A',
        rating: movie.vote_average,
        posterUrl: movie.poster_path
          ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
          : null,
      };
    } catch (error: any) {
      this.logger.error(
        `Error finding movie by title in TMDB: ${error.message}`,
      );
      return null;
    }
  }

  async addToWatchlist(
    userId: string,
    tmdbId: number,
    title: string,
    posterUrl?: string,
  ) {
    const existing = await this.watchlistRepo.findOne({
      where: { user: { id: userId }, tmdbId },
    });

    if (existing) {
      throw new BadRequestException('Movie is already in your watchlist');
    }

    const newItem = this.watchlistRepo.create({
      tmdbId,
      title,
      posterUrl,
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

    if (!item) {
      throw new NotFoundException('Фільм не знайдено у вашому списку');
    }

    item.isWatched = true;
    return this.watchlistRepo.save(item);
  }

  async rateMovie(userId: string, tmdbId: number, rating: number) {
    const item = await this.watchlistRepo.findOne({
      where: { user: { id: userId }, tmdbId },
    });

    if (!item) {
      throw new NotFoundException('Фільм не знайдено у вашому списку');
    }

    item.rating = rating;
    item.isWatched = true;

    return this.watchlistRepo.save(item);
  }

  async getTrendingMovies(): Promise<MovieResultDto[]> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<TmdbSearchResponseDto>(
          `${this.baseUrl}/trending/movie/week`,
          {
            params: { language: 'en-US' },
            headers: { Authorization: `Bearer ${this.tmdbToken}` },
          },
        ),
      );

      if (!data.results) return [];

      return data.results.slice(0, 6).map((movie) => ({
        id: movie.id,
        title: movie.title,
        originalTitle: movie.original_title || movie.title,
        description: movie.overview,
        releaseYear: movie.release_date
          ? movie.release_date.split('-')[0]
          : 'N/A',
        rating: movie.vote_average,
        posterUrl: movie.poster_path
          ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
          : null,
      }));
    } catch (error: any) {
      this.logger.error(`Error fetching trending movies: ${error.message}`);
      return [];
    }
  }

  async getMovieDetails(tmdbId: number): Promise<MovieDetailsResponse> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<MovieDetailsResponse>(
          `${this.baseUrl}/movie/${tmdbId}`,
          {
            params: { language: 'en-US' },
            headers: { Authorization: `Bearer ${this.tmdbToken}` },
          },
        ),
      );
      return data;
    } catch (error) {
      throw new NotFoundException('Movie details not found');
    }
  }

  async getMovieUserStatus(userId: string, tmdbId: number) {
    const item = await this.watchlistRepo.findOne({
      where: { user: { id: userId }, tmdbId },
    });
    return item || null;
  }

  async removeFromWatchlist(userId: string, tmdbId: number) {
    const result = await this.watchlistRepo.delete({
      user: { id: userId },
      tmdbId: tmdbId,
    });

    if (result.affected === 0) {
      throw new NotFoundException(
        `Movie with TMDB ID ${tmdbId} not found in your watchlist`,
      );
    }

    return { message: 'Movie successfully removed from watchlist' };
  }
}

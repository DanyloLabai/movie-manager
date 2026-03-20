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
      throw new Error('Api key is not set in enviroment variable');
    }
  }

  async searchMovies(title: string): Promise<MovieResultDto[]> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<TmdbSearchResponseDto>(
          `${this.baseUrl}/search/movie`,
          {
            params: { query: title, language: 'uk-UA' },
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

  async findMovieByTitle(title: string): Promise<MovieResultDto | null> {
    const { data } = await firstValueFrom(
      this.httpService.get<TmdbSearchResponseDto>(
        `${this.baseUrl}/search/movie`,
        {
          params: { query: title, language: 'uk-UA' },
          headers: { Authorization: `Bearer ${this.tmdbToken}` },
        },
      ),
    );

    if (!data.results?.length) return null;

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
  }

  async addToWatchlist(userId: string, tmdbId: number, title: string) {
    const existing = await this.watchlistRepo.findOne({
      where: { user: { id: userId }, tmdbId },
    });

    if (existing) {
      throw new BadRequestException('Movie is already in your watchlist');
    }

    const newItem = this.watchlistRepo.create({
      tmdbId,
      title,
      user: { id: userId },
    });

    return this.watchlistRepo.save(newItem);
  }

  async getWatchlist(userId: string) {
    const items = await this.watchlistRepo.find({
      where: { user: { id: userId } },
      order: { addedAt: 'DESC' },
    });

    return items;
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

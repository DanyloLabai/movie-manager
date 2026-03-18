import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { MovieResultDto } from './dto/movie-result.dto';
import { TmdbMovieDto, TmdbSearchResponseDto } from './dto/tmdb-response.dto';

@Injectable()
export class MoviesService {
  private readonly logger = new Logger(MoviesService.name);
  private readonly tmdbToken: string;
  private readonly baseUrl = 'https://api.themoviedb.org/3';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.tmdbToken = this.configService.get<string>('TMDB_API_TOKEN') as string;
    if (this.tmdbToken === undefined || this.tmdbToken === '') {
      throw new Error('Api key is not set in enviroment variable');
    }
  }

  async findMovieByTitle(title: string): Promise<MovieResultDto | null> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get<TmdbSearchResponseDto>(
          `${this.baseUrl}/search/movie`,
          {
            params: { query: title },
            headers: { Authorization: `Bearer ${this.tmdbToken}` },
          },
        ),
      );

      if (!data.results?.length) return null;

      const movie: TmdbMovieDto = data.results[0];

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
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      this.logger.error(`TMDB Error: ${errorMessage}`);
      return null;
    }
  }
}

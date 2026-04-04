import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { MoviesService } from './movies.service';
import { MovieResultDto } from './dto/movie-result.dto';
import { AuthGuard } from '@nestjs/passport';
import { MovieDetailsResponse } from './dto/movies-details-response.dto'; // Не забудь додати цей імпорт, якщо його немає

interface RequestWithUser extends Request {
  user: {
    userId: string;
    username: string;
  };
}

@Controller('api/movies')
export class MoviesController {
  constructor(private readonly moviesService: MoviesService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('search')
  async searchByTitle(
    @Query('title') title: string,
  ): Promise<MovieResultDto[] | null> {
    return this.moviesService.searchMovies(title);
  }

  // ОНОВЛЕНО: Тепер приймає mediaType
  @UseGuards(AuthGuard('jwt'))
  @Post('watchlist')
  async addToWatchlist(
    @Req() req: RequestWithUser,
    @Body()
    body: {
      tmdbId: number;
      title: string;
      posterUrl?: string;
      mediaType: 'movie' | 'tv';
    },
  ) {
    const userId = req.user.userId;
    return this.moviesService.addToWatchlist(
      userId,
      body.tmdbId,
      body.title,
      body.posterUrl,
      body.mediaType,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('watchlist')
  async getWatchlist(@Req() req: RequestWithUser) {
    const userId = req.user.userId;
    return this.moviesService.getWatchlist(userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete('watchlist/:tmdbId')
  async removeFromWatchlist(
    @Req() req: RequestWithUser,
    @Param('tmdbId', ParseIntPipe) tmdbId: number,
  ) {
    const userId = req.user.userId;
    return this.moviesService.removeFromWatchlist(userId, tmdbId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('watched')
  async getWatchedMovies(@Req() req: RequestWithUser) {
    const userId = req.user.userId;
    return this.moviesService.getWatchedMovies(userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('watchlist/:tmdbId/watched')
  async markAsWatched(
    @Req() req: RequestWithUser,
    @Param('tmdbId', ParseIntPipe) tmdbId: number,
  ) {
    const userId = req.user.userId;
    return this.moviesService.markAsWatched(userId, tmdbId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('watchlist/:tmdbId/rate')
  async rateMovie(
    @Req() req: RequestWithUser,
    @Param('tmdbId', ParseIntPipe) tmdbId: number,
    @Body('rating', ParseIntPipe) rating: number,
  ) {
    const userId = req.user.userId;
    return this.moviesService.rateMovie(userId, tmdbId, rating);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch('watchlist/:tmdbId/favorite')
  async toggleFavorite(
    @Req() req: RequestWithUser,
    @Param('tmdbId', ParseIntPipe) tmdbId: number,
  ) {
    const userId = req.user.userId;
    return this.moviesService.toggleFavorite(userId, tmdbId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('profile')
  async getProfileData(@Req() req: RequestWithUser) {
    const userId = req.user.userId;
    return this.moviesService.getProfileData(userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('trending')
  async getTrendingMovies(): Promise<MovieResultDto[]> {
    return this.moviesService.getTrendingMovies();
  }

  // ОНОВЛЕНО: Додано @Query('type')
  @UseGuards(AuthGuard('jwt'))
  @Get(':tmdbId/details')
  async getMovieDetails(
    @Param('tmdbId', ParseIntPipe) tmdbId: number,
    @Query('type') type?: string, // Зчитуємо тип з URL
  ): Promise<MovieDetailsResponse> {
    return this.moviesService.getMovieDetails(tmdbId, type);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':tmdbId/status')
  async getMovieStatus(
    @Req() req: RequestWithUser,
    @Param('tmdbId', ParseIntPipe) tmdbId: number,
  ) {
    const userId = req.user.userId;
    return this.moviesService.getMovieUserStatus(userId, tmdbId);
  }
}

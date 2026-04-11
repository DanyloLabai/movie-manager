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
import { MovieDetailsResponse } from './dto/movies-details-response.dto';

interface RequestWithUser extends Request {
  user: {
    userId: number;
    username: string;
  };
}

@Controller('api/movies')
export class MoviesController {
  constructor(private readonly moviesService: MoviesService) {}

  @Get('upcoming')
  async getUpcomingMovies() {
    return this.moviesService.getUpcomingMovies();
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('search')
  async searchByTitle(
    @Query('title') title: string,
  ): Promise<MovieResultDto[] | null> {
    return this.moviesService.searchMovies(title);
  }

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
      releaseDate?: string;
    },
  ) {
    const userId = req.user.userId;
    return this.moviesService.addToWatchlist(
      userId,
      body.tmdbId,
      body.title,
      body.posterUrl,
      body.mediaType,
      body.releaseDate,
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

  @UseGuards(AuthGuard('jwt'))
  @Get(':tmdbId/details')
  async getMovieDetails(
    @Param('tmdbId', ParseIntPipe) tmdbId: number,
    @Query('type') type?: string,
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

  @UseGuards(AuthGuard('jwt'))
  @Get('recommendations')
  async getRecommendations(@Req() req: RequestWithUser) {
    const userId = Number(req.user.userId);
    return this.moviesService.getRecommendationsForUser(userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':id/similar')
  async getSimilar(@Param('id') id: string, @Query('type') type: string) {
    return this.moviesService.getSimilarMovies(+id, type);
  }
}

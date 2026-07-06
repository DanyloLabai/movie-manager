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
  Logger,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { MoviesService } from './movies.service';
import { MovieResultDto } from './dto/movie-result.dto';
import { Public } from '../auth/decorators/public.decorator';
import { MovieDetailsExtendedDto } from './dto/movie-details-extended.dto';
import { VectorService } from '../vector/vector.service';

interface RequestWithUser extends Request {
  user: {
    userId: number;
    username: string;
  };
}

@ApiTags('Movies')
@Controller('api/movies')
export class MoviesController {
  private readonly logger = new Logger(MoviesController.name);

  constructor(
    private readonly moviesService: MoviesService,
    private readonly vectorService: VectorService, // Додали VectorService
  ) {}

  @Public()
  @Get('upcoming')
  @ApiOperation({
    summary: 'Get upcoming movies',
    description: 'Fetch list of upcoming movies',
  })
  @ApiResponse({ status: 200, description: 'List of upcoming movies' })
  async getUpcomingMovies() {
    return this.moviesService.getUpcomingMovies();
  }

  @Public()
  @Get('top100/:type')
  @ApiOperation({
    summary: 'Get top 100 movies/TV shows',
    description: 'Fetch top 100 movies or TV shows',
  })
  @ApiParam({
    name: 'type',
    enum: ['movie', 'tv'],
    description: 'Type of media',
  })
  @ApiResponse({ status: 200, description: 'List of top 100 movies/TV shows' })
  async getTop100(@Param('type') type: 'movie' | 'tv') {
    return this.moviesService.getTop100(type);
  }

  @Get('search')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Search movies',
    description: 'Search for movies by title (requires authentication)',
  })
  @ApiQuery({
    name: 'title',
    required: true,
    description: 'Movie title to search for',
  })
  @ApiResponse({
    status: 200,
    description: 'List of matching movies',
    type: [MovieResultDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async searchByTitle(
    @Query('title') title: string,
  ): Promise<MovieResultDto[] | null> {
    return this.moviesService.searchMovies(title);
  }

  @Post('watchlist')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Add to watchlist',
    description: 'Add a movie/TV show to watchlist (requires authentication)',
  })
  @ApiResponse({ status: 201, description: 'Added to watchlist' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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

  @Get('watchlist')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get watchlist',
    description: 'Get user watchlist (requires authentication)',
  })
  @ApiResponse({ status: 200, description: 'User watchlist' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getWatchlist(@Req() req: RequestWithUser) {
    const userId = req.user.userId;
    return this.moviesService.getWatchlist(userId);
  }

  @Delete('watchlist/:tmdbId')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Remove from watchlist',
    description:
      'Remove a movie/TV show from watchlist (requires authentication)',
  })
  @ApiParam({
    name: 'tmdbId',
    type: 'number',
    description: 'TMDB ID of the media',
  })
  @ApiResponse({ status: 200, description: 'Removed from watchlist' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async removeFromWatchlist(
    @Req() req: RequestWithUser,
    @Param('tmdbId', ParseIntPipe) tmdbId: number,
  ) {
    const userId = req.user.userId;
    return this.moviesService.removeFromWatchlist(userId, tmdbId);
  }

  @Get('watched')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get watched movies',
    description: 'Get list of watched movies (requires authentication)',
  })
  @ApiResponse({ status: 200, description: 'List of watched movies' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getWatchedMovies(@Req() req: RequestWithUser) {
    const userId = req.user.userId;
    return this.moviesService.getWatchedMovies(userId);
  }

  @Post('watchlist/:tmdbId/watched')
  async markAsWatched(
    @Req() req: RequestWithUser,
    @Param('tmdbId', ParseIntPipe) tmdbId: number,
  ) {
    const userId = req.user.userId;
    return this.moviesService.markAsWatched(userId, tmdbId);
  }

  @Patch('watchlist/:tmdbId/rate')
  async rateMovie(
    @Req() req: RequestWithUser,
    @Param('tmdbId', ParseIntPipe) tmdbId: number,
    @Body('rating', ParseIntPipe) rating: number,
  ) {
    const userId = req.user.userId;
    return this.moviesService.rateMovie(userId, tmdbId, rating);
  }

  @Patch('watchlist/:tmdbId/favorite')
  async toggleFavorite(
    @Req() req: RequestWithUser,
    @Param('tmdbId', ParseIntPipe) tmdbId: number,
  ) {
    const userId = req.user.userId;
    return this.moviesService.toggleFavorite(userId, tmdbId);
  }

  @Get('profile')
  async getProfileData(@Req() req: RequestWithUser) {
    const userId = req.user.userId;
    return this.moviesService.getProfileData(userId);
  }

  @Get('trending')
  async getTrendingMovies(): Promise<MovieResultDto[]> {
    return this.moviesService.getTrendingMovies();
  }

  @Get(':tmdbId/details')
  async getMovieDetails(
    @Param('tmdbId', ParseIntPipe) tmdbId: number,
    @Query('type') type?: string,
  ): Promise<MovieDetailsExtendedDto> {
    return this.moviesService.getMovieDetails(tmdbId, type);
  }

  @Get(':tmdbId/status')
  async getMovieStatus(
    @Req() req: RequestWithUser,
    @Param('tmdbId', ParseIntPipe) tmdbId: number,
  ) {
    const userId = req.user.userId;
    return this.moviesService.getMovieUserStatus(userId, tmdbId);
  }

  @Get('recommendations')
  async getRecommendations(@Req() req: RequestWithUser) {
    const userId = Number(req.user.userId);
    return this.moviesService.getRecommendationsForUser(userId);
  }

  @Get(':id/similar')
  async getSimilar(@Param('id') id: string, @Query('type') type: string) {
    return this.moviesService.getSimilarMovies(+id, type);
  }

  @Get('actor/:id')
  async getActorDetails(@Param('id', ParseIntPipe) id: number) {
    return this.moviesService.getActorDetails(id);
  }

  @Post('sync')
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Sync movies to the vector database' })
  async syncMoviesToVectorDB() {
    return this.moviesService.syncMoviesToVectorDB();
  }
}

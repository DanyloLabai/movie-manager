import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseFloatPipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  Logger,
} from '@nestjs/common';
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
import { SmartSearchQueryDto } from './dto/smart-search-query.dto';
import { MovieFilterQueryDto } from './dto/movie-filter-query.dto';
import { BecauseYouWatchedResponseDto } from './dto/because-you-watched-response.dto';
import { VectorService } from '../vector/vector.service';

interface RequestWithUser extends Request {
  user: {
    userId: number;
    username: string;
  };
}

const DEFAULT_PAGE_SIZE = 30;

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

  @Get('notifications')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get notifications',
    description:
      'Get recent in-app notifications (movie releases, etc.) for the current user (requires authentication)',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of notifications' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getNotifications(
    @Req() req: RequestWithUser,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.moviesService.getNotifications(
      req.user.userId,
      limit !== undefined ? Number(limit) : DEFAULT_PAGE_SIZE,
      offset !== undefined ? Number(offset) : 0,
    );
  }

  @Patch('notifications/:id/read')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Mark notification as read',
    description: 'Mark a single notification as read (requires authentication)',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Notification ID' })
  @ApiResponse({ status: 200, description: 'Notification marked as read' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async markNotificationRead(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.moviesService.markNotificationRead(req.user.userId, id);
  }

  @Patch('notifications/read-all')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Mark all notifications as read',
    description: 'Mark all of the current user\'s notifications as read (requires authentication)',
  })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async markAllNotificationsRead(@Req() req: RequestWithUser) {
    return this.moviesService.markAllNotificationsRead(req.user.userId);
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

  @Get('search/smart')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Smart search',
    description:
      'Semantic search with optional genre/year/rating/runtime filters (requires authentication)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of matching movies',
    type: [MovieResultDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async smartSearch(
    @Req() req: RequestWithUser,
    @Query() dto: SmartSearchQueryDto,
  ): Promise<MovieResultDto[]> {
    return this.moviesService.smartSearchMovies(dto, req.user.userId);
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
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'User watchlist' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getWatchlist(
    @Req() req: RequestWithUser,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const userId = req.user.userId;
    return this.moviesService.getWatchlist(
      userId,
      limit !== undefined ? Number(limit) : DEFAULT_PAGE_SIZE,
      offset !== undefined ? Number(offset) : 0,
    );
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
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of watched movies' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getWatchedMovies(
    @Req() req: RequestWithUser,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const userId = req.user.userId;
    return this.moviesService.getWatchedMovies(
      userId,
      limit !== undefined ? Number(limit) : DEFAULT_PAGE_SIZE,
      offset !== undefined ? Number(offset) : 0,
    );
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
    @Body('rating', ParseFloatPipe) rating: number,
  ) {
    const userId = req.user.userId;
    return this.moviesService.rateMovie(userId, tmdbId, rating);
  }

  @Patch('watchlist/:tmdbId/progress')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update episode progress',
    description:
      'Set the current season/episode for a TV show in the watchlist (requires authentication)',
  })
  @ApiResponse({ status: 200, description: 'Progress updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Media not found in watchlist' })
  async updateEpisodeProgress(
    @Req() req: RequestWithUser,
    @Param('tmdbId', ParseIntPipe) tmdbId: number,
    @Body() body: { season: number; episode: number },
  ) {
    const userId = req.user.userId;
    return this.moviesService.updateEpisodeProgress(
      userId,
      tmdbId,
      Number(body.season),
      Number(body.episode),
    );
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

  @Get(':tmdbId/friends-watched')
  async getFriendsWhoWatched(
    @Req() req: RequestWithUser,
    @Param('tmdbId', ParseIntPipe) tmdbId: number,
    @Query('type') type?: string,
  ) {
    const userId = req.user.userId;
    return this.moviesService.getFriendsWhoWatched(
      userId,
      tmdbId,
      type || 'movie',
    );
  }

  @Get('recommendations')
  async getRecommendations(@Req() req: RequestWithUser) {
    const userId = Number(req.user.userId);
    return this.moviesService.getRecommendationsForUser(userId);
  }

  @Get('recommendations/because-you-watched')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Because you watched',
    description:
      "Semantic recommendations based on the user's most recently watched movie rated 6+ (requires authentication)",
  })
  @ApiResponse({ status: 200, type: BecauseYouWatchedResponseDto })
  async getBecauseYouWatched(
    @Req() req: RequestWithUser,
  ): Promise<BecauseYouWatchedResponseDto | null> {
    return this.moviesService.getBecauseYouWatchedRecommendations(
      req.user.userId,
    );
  }

  @Get(':id/similar')
  async getSimilar(@Param('id') id: string, @Query('type') type: string) {
    return this.moviesService.getSimilarMovies(+id, type);
  }

  @Get(':id/similar/semantic')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Semantically similar movies',
    description:
      'Vector-search movies similar to the given movie, reusing its stored embedding (requires authentication)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of matching movies',
    type: [MovieResultDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getSimilarSemantic(
    @Req() req: RequestWithUser,
    @Param('id', ParseIntPipe) id: number,
    @Query() dto: MovieFilterQueryDto,
  ): Promise<MovieResultDto[]> {
    return this.moviesService.findSimilarBySemantic(id, dto, req.user.userId);
  }

  @Get('actor/:id')
  async getActorDetails(@Param('id', ParseIntPipe) id: number) {
    return this.moviesService.getActorDetails(id);
  }

}

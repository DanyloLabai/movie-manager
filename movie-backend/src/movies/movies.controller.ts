// src/movies/movies.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { MoviesService } from './movies.service';
import { MovieResultDto } from './dto/movie-result.dto';
import { AuthGuard } from '@nestjs/passport';

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

  @UseGuards(AuthGuard('jwt'))
  @Post('watchlist')
  async addToWatchlist(
    @Req() req: RequestWithUser,
    @Body() body: { tmdbId: number; title: string },
  ) {
    const userId = req.user.userId;
    return this.moviesService.addToWatchlist(userId, body.tmdbId, body.title);
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
}

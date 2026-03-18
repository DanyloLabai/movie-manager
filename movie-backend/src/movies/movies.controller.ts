// src/movies/movies.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { MoviesService } from './movies.service';
import { MovieResultDto } from './dto/movie-result.dto';

@Controller('movies')
export class MoviesController {
  constructor(private readonly moviesService: MoviesService) {}

  @Get('search')
  async searchByTitle(
    @Query('title') title: string,
  ): Promise<MovieResultDto | null> {
    return this.moviesService.findMovieByTitle(title);
  }
}

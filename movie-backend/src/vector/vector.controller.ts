import { Controller, Logger, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MoviesService } from '../movies/movies.service';
import { VectorService } from './vector.service';

@ApiTags('Vector DB')
@Controller('api/vector')
export class VectorController {
  private readonly logger = new Logger(VectorController.name);

  constructor(
    private readonly vectorService: VectorService,
    private readonly moviesService: MoviesService,
  ) {}

  @Post('sync')
  @ApiOperation({ summary: 'Sync movies to the vector database' })
  async syncMoviesToVectorDB() {
    const movies = await this.moviesService.getTop100('movie');
    const total = movies.length;
    let syncedCount = 0;

    for (const movie of movies) {
      await this.vectorService.addMovieToVectorStore({
        id: movie.id,
        title: movie.title,
        description: movie.description || '',
        genres: [],
      });

      syncedCount += 1;
      this.logger.log(`Synced movie ${syncedCount}/${total}: ${movie.title}`);
    }

    return {
      syncedMovies: syncedCount,
      message: `Successfully synced ${syncedCount} movie(s) to the vector database.`,
    };
  }
}

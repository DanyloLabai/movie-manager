import { ApiProperty } from '@nestjs/swagger';
import { MovieResultDto } from './movie-result.dto';

export class BasedOnMovieDto {
  @ApiProperty()
  id!: number;
  @ApiProperty()
  title!: string;
  @ApiProperty({ nullable: true })
  posterUrl!: string | null;
}

export class BecauseYouWatchedResponseDto {
  @ApiProperty({ type: () => BasedOnMovieDto })
  basedOnMovie!: BasedOnMovieDto;
  @ApiProperty({ type: () => [MovieResultDto] })
  similarMovies!: MovieResultDto[];
}

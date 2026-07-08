import { ApiProperty } from '@nestjs/swagger';
import { GenreDto } from './genre.dto';
import { CastMemberDto } from './cast-member.dto';
import { WatchProviderDto } from './watch-provider.dto';

export class MovieDetailsExtendedDto {
  @ApiProperty()
  id!: number;
  @ApiProperty()
  title!: string;
  @ApiProperty()
  overview!: string;
  @ApiProperty()
  releaseDate!: string;
  @ApiProperty()
  voteAverage!: number;
  @ApiProperty({ nullable: true })
  posterPath!: string | null;
  @ApiProperty({ nullable: true })
  backdropPath!: string | null;
  @ApiProperty()
  runtime!: number;
  @ApiProperty({ type: () => [GenreDto] })
  genres!: GenreDto[];
  @ApiProperty()
  mediaType!: 'movie' | 'tv';
  @ApiProperty({ nullable: true })
  trailerUrl!: string | null;
  @ApiProperty({ type: () => [WatchProviderDto], nullable: true })
  watchProviders!: WatchProviderDto[] | null;
  @ApiProperty()
  productionCountries!: string[];
  @ApiProperty({ type: () => [CastMemberDto] })
  cast!: CastMemberDto[];
}

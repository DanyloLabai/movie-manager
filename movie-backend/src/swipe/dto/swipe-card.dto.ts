import { ApiProperty } from '@nestjs/swagger';

export class SwipeCardDto {
  @ApiProperty()
  id!: number;
  @ApiProperty()
  title!: string;
  @ApiProperty()
  hook!: string;
  @ApiProperty()
  releaseYear!: string;
  @ApiProperty()
  releaseDate!: string | null;
  @ApiProperty({ type: [String] })
  genres!: string[];
  @ApiProperty({ nullable: true })
  runtime!: number | null;
  @ApiProperty()
  voteAverage!: number;
  @ApiProperty({ nullable: true })
  posterUrl!: string | null;
  @ApiProperty()
  mediaType!: 'movie';
  @ApiProperty({ enum: ['personalized', 'diverse'] })
  matchType!: 'personalized' | 'diverse';
}

export class SwipeFeedResponseDto {
  @ApiProperty({ type: () => [SwipeCardDto] })
  movies!: SwipeCardDto[];
  @ApiProperty()
  remainingToday!: number;
  @ApiProperty()
  dailyLimit!: number;
  @ApiProperty({
    nullable: true,
    description:
      'ISO timestamp when the daily cap resets, set only once it has been reached',
  })
  resetAt!: string | null;
}

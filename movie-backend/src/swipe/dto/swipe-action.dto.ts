import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class SwipeActionDto {
  @IsInt()
  tmdbId!: number;

  @IsString()
  @MaxLength(300)
  title!: string;

  @IsOptional()
  @IsString()
  posterUrl?: string;

  @IsOptional()
  @IsString()
  releaseDate?: string;

  @IsIn(['watched', 'watchlist', 'skip'])
  action!: 'watched' | 'watchlist' | 'skip';

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  rating?: number;
}

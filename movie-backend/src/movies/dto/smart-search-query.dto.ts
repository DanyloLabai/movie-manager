import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { MovieFilterQueryDto } from './movie-filter-query.dto';

export class SmartSearchQueryDto extends MovieFilterQueryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  query!: string;
}

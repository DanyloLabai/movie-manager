import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class SearchByMoodDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(300)
  moodDescription: string;
}

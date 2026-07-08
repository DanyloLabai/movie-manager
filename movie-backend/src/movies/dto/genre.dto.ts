import { ApiProperty } from '@nestjs/swagger';

export class GenreDto {
  @ApiProperty()
  id!: number;
  @ApiProperty()
  name!: string;
}

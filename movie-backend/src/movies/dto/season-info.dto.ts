import { ApiProperty } from '@nestjs/swagger';

export class SeasonInfoDto {
  @ApiProperty()
  seasonNumber!: number;
  @ApiProperty()
  name!: string;
  @ApiProperty()
  episodeCount!: number;
}

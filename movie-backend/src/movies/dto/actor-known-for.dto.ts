import { ApiProperty } from '@nestjs/swagger';

export class ActorKnownForDto {
  @ApiProperty()
  id!: number;
  @ApiProperty()
  title!: string;
  @ApiProperty({ nullable: true })
  posterUrl!: string | null;
  @ApiProperty()
  mediaType!: string;
  @ApiProperty()
  releaseYear!: string;
  @ApiProperty()
  character!: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { ActorKnownForDto } from './actor-known-for.dto';

export class ActorDetailsDto {
  @ApiProperty()
  id!: number;
  @ApiProperty()
  name!: string;
  @ApiProperty({ nullable: true })
  biography!: string | null;
  @ApiProperty({ nullable: true })
  profileUrl!: string | null;
  @ApiProperty({ nullable: true })
  birthday!: string | null;
  @ApiProperty({ nullable: true })
  placeOfBirth!: string | null;
  @ApiProperty({ type: () => [ActorKnownForDto] })
  knownFor!: ActorKnownForDto[];
}

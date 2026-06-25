import { ApiProperty } from '@nestjs/swagger';

export class CastMemberDto {
  @ApiProperty()
  id!: number;
  @ApiProperty()
  name!: string;
  @ApiProperty()
  character!: string;
  @ApiProperty({ nullable: true })
  profile_path!: string | null;
}

import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserProfileDto {
  @ApiProperty()
  id!: number;
  @ApiProperty()
  username!: string;
  @ApiProperty()
  email!: string;
  @ApiProperty({ nullable: true })
  avatarUrl!: string | null;
}

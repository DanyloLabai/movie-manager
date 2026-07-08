import { ApiProperty } from '@nestjs/swagger';

export class FriendDto {
  @ApiProperty()
  id!: number;
  @ApiProperty()
  username!: string;
  @ApiProperty({ nullable: true })
  avatarUrl!: string | null;
}

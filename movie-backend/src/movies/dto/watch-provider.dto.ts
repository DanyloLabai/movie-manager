import { ApiProperty } from '@nestjs/swagger';

export class WatchProviderDto {
  @ApiProperty({ nullable: true })
  logo_path!: string | null;
  @ApiProperty()
  provider_id!: number;
  @ApiProperty()
  provider_name!: string;
}

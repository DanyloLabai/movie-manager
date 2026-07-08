import { ApiProperty } from '@nestjs/swagger';

export class CloudinaryUploadResponseDto {
  @ApiProperty()
  public_id!: string;
  @ApiProperty()
  version!: number;
  @ApiProperty()
  signature!: string;
  @ApiProperty()
  width!: number;
  @ApiProperty()
  height!: number;
  @ApiProperty()
  format!: string;
  @ApiProperty()
  resource_type!: string;
  @ApiProperty()
  created_at!: string;
  @ApiProperty()
  tags!: string[];
  @ApiProperty()
  bytes!: number;
  @ApiProperty()
  type!: string;
  @ApiProperty()
  etag!: string;
  @ApiProperty()
  placeholder!: boolean;
  @ApiProperty()
  url!: string;
  @ApiProperty()
  secure_url!: string;
  @ApiProperty()
  folder!: string;
  @ApiProperty()
  original_filename!: string;
}

import { ApiProperty } from '@nestjs/swagger';

export class HttpErrorResponseDto {
  @ApiProperty()
  statusCode!: number;
  @ApiProperty()
  message!: string | string[];
  @ApiProperty({ nullable: true })
  error?: string | null;
}

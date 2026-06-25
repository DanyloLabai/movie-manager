import { ApiProperty } from '@nestjs/swagger';

export class DatabaseErrorDto {
  @ApiProperty()
  code!: string;
  @ApiProperty()
  message!: string;
}

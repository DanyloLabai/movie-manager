import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

export class UpdatePasswordDto {
  @IsString()
  @Matches(/^[a-zA-Z0-9!@#$%^&*()_+-.]+$/, {
    message:
      'Password must contain only English letters, numbers and basic symbols',
  })
  oldPassword: string;

  @IsString()
  @MinLength(8)
  @MaxLength(32)
  @Matches(/^[a-zA-Z0-9!@#$%^&*()_+-.]+$/, {
    message:
      'Password must contain only English letters, numbers and basic symbols',
  })
  newPassword: string;
}

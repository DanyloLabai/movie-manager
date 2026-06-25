import {
  IsEmail,
  IsNotEmpty,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SignInDto {
  @IsEmail()
  @MaxLength(50)
  email: string;

  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(32)
  @Matches(/^[a-zA-Z0-9!@#$%^&*()_+-.]+$/, {
    message:
      'Password must contain only English letters, numbers and basic symbols',
  })
  password: string;
}

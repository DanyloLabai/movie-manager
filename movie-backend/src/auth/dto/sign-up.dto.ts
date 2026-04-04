import {
  IsEmail,
  IsNotEmpty,
  MinLength,
  IsString,
  MaxLength,
  Matches,
} from 'class-validator';

export class SignUpDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message:
      'Username can only contain English letters, numbers and underscores',
  })
  username: string;

  @IsEmail({}, { message: 'Please provide a valid email' })
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

  @IsNotEmpty({ message: 'Captcha token is required' })
  @IsString()
  captchaToken: string;
}

import {
  IsEmail,
  IsNotEmpty,
  MinLength,
  IsString,
  MaxLength,
} from 'class-validator';

export class SignUpDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(20)
  username: string;

  @IsEmail({}, { message: 'Please provide a valid email' })
  @MaxLength(50)
  email: string;

  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(32)
  password: string;

  @IsNotEmpty({ message: 'Captcha token is required' })
  @IsString()
  captchaToken: string;
}

import { Exclude } from 'class-transformer';

export class SignUpResponseDto {
  message: string;
}

export class SignInResponseDto {
  access_token: string;
  user: {
    id: number;
    username: string;
    email: string;
  };
}

export class VerifyEmailResponseDto {
  message: string;
  verified: boolean;
}

export class PasswordChangeResponseDto {
  message: string;
}

export class ResendVerificationResponseDto {
  message: string;
}

export class ForgotPasswordResponseDto {
  message: string;
}

export class ResetPasswordResponseDto {
  message: string;
  access_token?: string;
}

export class RefreshResponseDto {
  access_token: string;
  user: {
    id: number;
    username: string;
    email: string;
  };
}

export class LogoutResponseDto {
  message: string;
}

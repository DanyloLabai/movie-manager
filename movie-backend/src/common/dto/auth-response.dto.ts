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
  // Only present when the request carries `X-Client-Platform: mobile` — web
  // relies on the httpOnly refresh_token cookie instead, since exposing this
  // to JS would defeat the point of it being httpOnly.
  refresh_token?: string;
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
  // See SignInResponseDto.refresh_token — same mobile-only gating.
  refresh_token?: string;
}

export class LogoutResponseDto {
  message: string;
}

import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Patch,
  Get,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { SignUpDto } from './dto/sign-up.dto';
import { SignInDto } from './dto/sign-in.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import {
  SignUpResponseDto,
  SignInResponseDto,
  RefreshResponseDto,
  LogoutResponseDto,
  VerifyEmailResponseDto,
  PasswordChangeResponseDto,
  ResendVerificationResponseDto,
  ForgotPasswordResponseDto,
  ResetPasswordResponseDto,
} from '../common/dto/auth-response.dto';

interface AuthenticatedRequest extends Request {
  user: { userId: number; username: string; refreshToken?: string | null };
}

const REFRESH_COOKIE_NAME = 'refresh_token';
const REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as
    | 'none'
    | 'lax',
  path: '/api/auth',
};

@ApiTags('Auth')
@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @ApiOperation({
    summary: 'User registration',
    description: 'Create a new user account',
  })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
    type: SignUpResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input or user already exists',
  })
  async signUp(@Body() signUpDto: SignUpDto): Promise<SignUpResponseDto> {
    return this.authService.signUp(signUpDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('signin')
  @ApiOperation({
    summary: 'User login',
    description: 'Authenticate user and return JWT token',
  })
  @ApiResponse({
    status: 200,
    description: 'User logged in successfully',
    type: SignInResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async signIn(
    @Body() signInDto: SignInDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SignInResponseDto> {
    const result = await this.authService.signIn(signInDto);

    res.cookie(REFRESH_COOKIE_NAME, result.refresh_token, {
      ...refreshCookieOptions,
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    });

    return result;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt-refresh'))
  @ApiOperation({
    summary: 'Refresh access token',
    description:
      'Exchange a valid refresh token (httpOnly cookie) for a new access token and rotated refresh token',
  })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    type: RefreshResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RefreshResponseDto> {
    const { userId, refreshToken } = req.user;
    const result = await this.authService.refreshTokens(
      userId,
      refreshToken ?? null,
    );

    res.cookie(REFRESH_COOKIE_NAME, result.refresh_token, {
      ...refreshCookieOptions,
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    });

    return {
      access_token: result.access_token,
      user: result.user,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Logout',
    description: 'Revoke the refresh token and clear the refresh cookie',
  })
  @ApiResponse({
    status: 200,
    description: 'Logged out successfully',
    type: LogoutResponseDto,
  })
  async logout(
    @Req() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LogoutResponseDto> {
    const result = await this.authService.logout(req.user.userId);
    res.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions);
    return result;
  }

  @Patch('change-password')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Change password',
    description: 'Update user password (requires authentication)',
  })
  @ApiResponse({
    status: 200,
    description: 'Password changed successfully',
    type: PasswordChangeResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async changePassword(
    @Body() updatePasswordDto: UpdatePasswordDto,
  ): Promise<PasswordChangeResponseDto> {
    return this.authService.changePassword(updatePasswordDto);
  }

  @Get('verify-email')
  @ApiOperation({
    summary: 'Verify email',
    description: 'Verify user email with token',
  })
  @ApiQuery({
    name: 'token',
    required: true,
    description: 'Verification token',
  })
  @ApiResponse({
    status: 200,
    description: 'Email verified successfully',
    type: VerifyEmailResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async verifyEmail(
    @Query('token') token: string,
  ): Promise<VerifyEmailResponseDto> {
    return this.authService.verifyEmail(token);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend verification email',
    description: 'Resend verification email to user',
  })
  @ApiResponse({
    status: 200,
    description: 'Verification email sent',
    type: ResendVerificationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Email not found' })
  async resendVerification(
    @Body('email') email: string,
  ): Promise<ResendVerificationResponseDto> {
    return this.authService.resendVerificationEmail(email);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Forgot password',
    description: 'Send password reset link to email',
  })
  @ApiResponse({
    status: 200,
    description: 'Reset link sent to email',
    type: ForgotPasswordResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Email not found' })
  async forgotPassword(
    @Body('email') email: string,
  ): Promise<ForgotPasswordResponseDto> {
    return this.authService.forgotPassword(email);
  }

  @Patch('reset-password')
  @ApiOperation({
    summary: 'Reset password',
    description: 'Reset password using reset token',
  })
  @ApiResponse({
    status: 200,
    description: 'Password reset successfully',
    type: ResetPasswordResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid or expired reset token' })
  async resetPassword(
    @Body('token') token: string,
    @Body('newPassword') newPassword: string,
  ): Promise<ResetPasswordResponseDto> {
    return this.authService.resetPassword(token, newPassword);
  }
}

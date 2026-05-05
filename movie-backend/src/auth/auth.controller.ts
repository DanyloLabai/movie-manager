import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Patch,
  Get,
  Query,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignUpDto } from './dto/sign-up.dto';
import { SignInDto } from './dto/sign-in.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import {
  SignUpResponseDto,
  SignInResponseDto,
  VerifyEmailResponseDto,
  PasswordChangeResponseDto,
  ResendVerificationResponseDto,
  ForgotPasswordResponseDto,
  ResetPasswordResponseDto,
} from '../common/dto/auth-response.dto';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  async signUp(@Body() signUpDto: SignUpDto): Promise<SignUpResponseDto> {
    return this.authService.signUp(signUpDto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('signin')
  async signIn(@Body() signInDto: SignInDto): Promise<SignInResponseDto> {
    return this.authService.signIn(signInDto);
  }

  @Patch('change-password')
  async changePassword(
    @Body() updatePasswordDto: UpdatePasswordDto,
  ): Promise<PasswordChangeResponseDto> {
    return this.authService.changePassword(updatePasswordDto);
  }

  @Get('verify-email')
  async verifyEmail(
    @Query('token') token: string,
  ): Promise<VerifyEmailResponseDto> {
    return this.authService.verifyEmail(token);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(
    @Body('email') email: string,
  ): Promise<ResendVerificationResponseDto> {
    return this.authService.resendVerificationEmail(email);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body('email') email: string,
  ): Promise<ForgotPasswordResponseDto> {
    return this.authService.forgotPassword(email);
  }

  @Patch('reset-password')
  async resetPassword(
    @Body('token') token: string,
    @Body('newPassword') newPassword: string,
  ): Promise<ResetPasswordResponseDto> {
    return this.authService.resetPassword(token, newPassword);
  }
}

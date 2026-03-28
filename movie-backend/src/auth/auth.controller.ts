import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Patch, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignUpDto } from './dto/sign-up.dto';
import { SignInDto } from './dto/sign-in.dto';
import { AuthGuard } from '@nestjs/passport';
import { UpdatePasswordDto } from './dto/update-password.dto';

@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  async signUp(@Body() signUpDto: SignUpDto) {
    return this.authService.signUp(signUpDto);
  }
  @HttpCode(HttpStatus.OK)
  @Post('signin')
  async signIn(@Body() signInDto: SignInDto) {
    return this.authService.signIn(signInDto);
  }

  @Patch('change-password')
  @UseGuards(AuthGuard('jwt'))
  async changePassword(
    @Req() req,
    @Body() updatePasswordDto: UpdatePasswordDto,
  ) {
    return this.authService.changePassword(req.user.id, updatePasswordDto);
  }
}

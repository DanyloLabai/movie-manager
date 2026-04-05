import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from '../users/users.entity';
import { SignUpDto } from './dto/sign-up.dto';
import { SignInDto } from './dto/sign-in.dto';
import { JwtService } from '@nestjs/jwt';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private jwtService: JwtService,
    private httpService: HttpService,
    private configService: ConfigService,
    private mailerService: MailerService,
  ) {}

  async signUp(signUpDto: SignUpDto): Promise<{ message: string }> {
    const { email, password, username, captchaToken } = signUpDto;

    const isCaptchaValid = await this.verifyCaptcha(captchaToken);
    if (!isCaptchaValid) {
      throw new BadRequestException('Invalid captcha verification');
    }

    const existingUser = await this.usersRepository.findOne({
      where: [{ email }, { username }],
    });

    if (existingUser) {
      throw new ConflictException('Email or Username is already in use');
    }

    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const user = this.usersRepository.create({
      username,
      email,
      password: hashedPassword,
      verificationToken: null,
      isVerified: true,
    });

    try {
      await this.usersRepository.save(user);

      /* ТИМЧАСОВО ВИМИКАЄМО ВІДПРАВКУ ЛИСТІВ ЧЕРЕЗ БЛОКУВАННЯ RAILWAY
      const frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
      const verificationUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;

      await this.mailerService.sendMail({
        to: user.email,
        subject: 'Welcome to Movie Tracker! Please verify your email',
        html: `...`
      });
      */

      return {
        message:
          'Successfully registered! (Email verification bypassed for development). You can now log in.',
      };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException('Registration failed.');
    }
  }
  async changePassword(dto: UpdatePasswordDto) {
    const user = await this.usersRepository.findOne({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isMatch = await bcrypt.compare(dto.oldPassword, user.password);
    if (!isMatch) {
      throw new BadRequestException('Current password is incorrect');
    }

    const salt = await bcrypt.genSalt();
    const hashedPath = await bcrypt.hash(dto.newPassword, salt);

    user.password = hashedPath;
    await this.usersRepository.save(user);

    return { message: 'Password updated successfully' };
  }

  async signIn(signInDto: SignInDto): Promise<{ accessToken: string }> {
    const { email, password } = signInDto;

    const user = await this.usersRepository.findOne({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isVerified) {
      throw new UnauthorizedException(
        'Please verify your email before logging in',
      );
    }

    const payload = {
      sub: user.id,
      username: user.username,
      email: user.email,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
    };
  }

  private async verifyCaptcha(token: string): Promise<boolean> {
    const secret = this.configService.get<string>('RECAPTCHA_SECRET_KEY');

    try {
      const { data } = await firstValueFrom(
        this.httpService.post(
          `https://www.google.com/recaptcha/api/siteverify?secret=${secret}&response=${token}`,
        ),
      );
      return data.success;
    } catch {
      return false;
    }
  }

  async verifyEmail(token: string) {
    const user = await this.usersRepository.findOne({
      where: { verificationToken: token },
    });
    if (!user) throw new BadRequestException('Invalid token');

    user.isVerified = true;
    user.verificationToken = null;
    await this.usersRepository.save(user);

    return { message: 'Email verified successfully!' };
  }
}

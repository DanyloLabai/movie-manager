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
    private mailerService: MailerService, // <-- Інжектимо сервіс пошти
  ) {}

  async signUp(signUpDto: SignUpDto): Promise<{ message: string }> {
    // Змінили return, бо тепер треба перевірити пошту
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

    // 1. Генеруємо унікальний токен для пошти
    const verificationToken = crypto.randomBytes(32).toString('hex');

    const user = this.usersRepository.create({
      username,
      email,
      password: hashedPassword,
      verificationToken, // <-- Зберігаємо токен у базу
    });

    try {
      await this.usersRepository.save(user);

      const frontendUrl =
        this.configService.get<string>('FRONTEND_URL') ||
        'http://localhost:5173';
      const verificationUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;

      await this.mailerService.sendMail({
        to: user.email,
        subject: 'Welcome to Movie Tracker! Please verify your email',
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
            <h1 style="color: #3b82f6;">Hello ${user.username}!</h1>
            <p>Thank you for signing up for Movie Tracker.</p>
            <p>Please click the button below to verify your email address and activate your account:</p>
            <a href="${verificationUrl}" style="display: inline-block; padding: 12px 24px; margin-top: 20px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Verify Email
            </a>
            <p style="margin-top: 30px; font-size: 12px; color: #6b7280;">If you didn't create an account, you can safely ignore this email.</p>
          </div>
        `,
      });

      return {
        message:
          'Successfully registered! Please check your email to verify your account.',
      };
    } catch (error) {
      console.error(error);
      throw new InternalServerErrorException(
        'Registration failed. Mail server might be down.',
      );
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

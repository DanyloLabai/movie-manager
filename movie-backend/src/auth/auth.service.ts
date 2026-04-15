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
import { Resend } from 'resend';

@Injectable()
export class AuthService {
  private resend: Resend;

  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private jwtService: JwtService,
    private httpService: HttpService,
    private configService: ConfigService,
  ) {
    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
  }

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

    const verificationToken = crypto.randomBytes(32).toString('hex');

    const user = this.usersRepository.create({
      username,
      email,
      password: hashedPassword,
      verificationToken,
      isVerified: false,
    });

    await this.usersRepository.save(user);

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const verificationUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;

    try {
      await this.resend.emails.send({
        from: 'Movie Tracker <noreply@movietracker.ink>',
        to: email,
        subject: 'Welcome to Movie Tracker! Please verify your email',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #12100e; color: #f0e6cc; padding: 40px; border-radius: 16px;">
            <h2 style="color: #c8963c; text-transform: uppercase; letter-spacing: 0.1em;">Welcome to Movie Tracker! 🎬</h2>
            <p>Hi <strong>${username}</strong>,</p>
            <p>Thanks for creating an account. To complete your registration, please verify your email address:</p>
            <a href="${verificationUrl}"
               style="display: inline-block; padding: 14px 28px; background-color: #c8963c; color: #12100e; text-decoration: none; border-radius: 12px; font-weight: 900; margin: 24px 0; text-transform: uppercase; letter-spacing: 0.1em;">
              Verify Email
            </a>
            <p style="color: #f0e6cc99; font-size: 13px;">Or copy and paste this link:</p>
            <p style="word-break: break-all; color: #c8963c; font-size: 13px;">${verificationUrl}</p>
            <p style="color: #f0e6cc66; font-size: 12px; margin-top: 32px;">If you didn't create this account, you can safely ignore this email.</p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      await this.usersRepository.delete({ id: user.id });
      throw new InternalServerErrorException(
        'Failed to send verification email. Please try again.',
      );
    }

    return {
      message:
        'Successfully registered! Please check your email to verify your account.',
    };
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

    if (!user) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    user.isVerified = true;
    user.verificationToken = null;
    await this.usersRepository.save(user);

    return { message: 'Email verified successfully!' };
  }

  async resendVerificationEmail(email: string) {
    const user = await this.usersRepository.findOne({ where: { email } });

    if (!user) {
      return {
        message: 'If this email exists, a verification link has been sent.',
      };
    }

    if (user.isVerified) {
      throw new BadRequestException('This email is already verified.');
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.verificationToken = verificationToken;
    await this.usersRepository.save(user);

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const verificationUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;

    try {
      await this.resend.emails.send({
        from: 'Movie Tracker <noreply@movietracker.ink>',
        to: email,
        subject: 'Verify your Movie Tracker email',
        html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #12100e; color: #f0e6cc; padding: 40px; border-radius: 16px;">
          <h2 style="color: #c8963c; text-transform: uppercase; letter-spacing: 0.1em;">Verify your email 🎬</h2>
          <p>Hi <strong>${user.username}</strong>,</p>
          <p>Here's your new verification link:</p>
          <a href="${verificationUrl}"
             style="display: inline-block; padding: 14px 28px; background-color: #c8963c; color: #12100e; text-decoration: none; border-radius: 12px; font-weight: 900; margin: 24px 0; text-transform: uppercase; letter-spacing: 0.1em;">
            Verify Email
          </a>
          <p style="color: #f0e6cc99; font-size: 13px;">Or copy and paste this link:</p>
          <p style="word-break: break-all; color: #c8963c; font-size: 13px;">${verificationUrl}</p>
          <p style="color: #f0e6cc66; font-size: 12px; margin-top: 32px;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
      });
    } catch (emailError) {
      console.error('Failed to resend verification email:', emailError);
      throw new InternalServerErrorException(
        'Failed to send email. Please try again.',
      );
    }

    return {
      message: 'If this email exists, a verification link has been sent.',
    };
  }

  async forgotPassword(email: string) {
    const user = await this.usersRepository.findOne({ where: { email } });
    if (!user) {
      return { message: 'If this email exists, a reset link has been sent.' };
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetToken = resetToken;
    await this.usersRepository.save(user);

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    try {
      await this.resend.emails.send({
        from: 'Movie Tracker <noreply@movietracker.ink>',
        to: email,
        subject: 'Reset Your Password - Movie Tracker',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #12100e; color: #f0e6cc; padding: 40px; border-radius: 16px;">
            <h2 style="color: #c8963c; text-transform: uppercase; letter-spacing: 0.1em;">Password Reset 🎬</h2>
            <p>Hi <strong>${user.username}</strong>,</p>
            <p>We received a request to reset your password. Click the button below to create a new one:</p>
            <a href="${resetUrl}"
               style="display: inline-block; padding: 14px 28px; background-color: #c8963c; color: #12100e; text-decoration: none; border-radius: 12px; font-weight: 900; margin: 24px 0; text-transform: uppercase; letter-spacing: 0.1em;">
              Reset Password
            </a>
            <p style="color: #f0e6cc66; font-size: 12px; margin-top: 32px;">If you didn't request this, you can safely ignore this email.</p>
          </div>
        `,
      });
    } catch (emailError) {
      throw new InternalServerErrorException('Failed to send reset email.');
    }

    return { message: 'If this email exists, a reset link has been sent.' };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.usersRepository.findOne({
      where: { resetToken: token },
    });

    if (!user) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const salt = await bcrypt.genSalt();
    const hashedPath = await bcrypt.hash(newPassword, salt);

    user.password = hashedPath;
    user.resetToken = null;
    await this.usersRepository.save(user);

    return { message: 'Password successfully reset!' };
  }
}

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
import { User } from '../users/users.entity';
import { SignUpDto } from './dto/sign-up.dto';
import { SignInDto } from './dto/sign-in.dto';
import { JwtService } from '@nestjs/jwt';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { UpdatePasswordDto } from './dto/update-password.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private jwtService: JwtService,
    private httpService: HttpService,
    private configService: ConfigService,
  ) {}

  async signUp(
    signUpDto: SignUpDto,
  ): Promise<{ id: string; username: string; email: string }> {
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
    });

    try {
      await this.usersRepository.save(user);

      return {
        id: user.id,
        username: user.username,
        email: user.email,
      };
    } catch {
      throw new InternalServerErrorException('Registration failed');
    }
  }

  async changePassword(userId: string, dto: UpdatePasswordDto) {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
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
}

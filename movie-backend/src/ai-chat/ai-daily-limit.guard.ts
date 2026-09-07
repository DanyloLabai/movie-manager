import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AiUsageLogService } from './ai-usage-log.service';
import { AuthenticatedRequest } from './interfaces/authenticated-request.interface';
import { APP_TIME_ZONE, startOfDayInTimeZone } from '../common/timezone.util';
import { User } from '../users/users.entity';

export const DEFAULT_DAILY_REQUEST_LIMIT = 15;
export const DEFAULT_DAILY_TOKEN_LIMIT = 60000;

@Injectable()
export class AiDailyLimitGuard implements CanActivate {
  private readonly requestLimit: number;
  private readonly tokenLimit: number;

  constructor(
    private readonly aiUsageLogService: AiUsageLogService,
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {
    this.requestLimit = Number(
      this.configService.get<string>('AI_DAILY_REQUEST_LIMIT') ??
        DEFAULT_DAILY_REQUEST_LIMIT,
    );
    this.tokenLimit = Number(
      this.configService.get<string>('AI_DAILY_TOKEN_LIMIT') ??
        DEFAULT_DAILY_TOKEN_LIMIT,
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = req.user?.userId;
    if (!userId) return true;

    const user = await this.usersRepo.findOne({
      where: { id: userId },
      select: ['timezone'],
    });
    const since = startOfDayInTimeZone(user?.timezone || APP_TIME_ZONE);
    const { requestCount, totalTokens } =
      await this.aiUsageLogService.getUserUsageSince(userId, since);

    if (requestCount >= this.requestLimit) {
      throw new HttpException(
        {
          message: 'Daily AI request limit reached. Please try again tomorrow.',
          code: 'AI_DAILY_LIMIT_REACHED',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (totalTokens >= this.tokenLimit) {
      throw new HttpException(
        {
          message: 'Daily AI token limit reached. Please try again tomorrow.',
          code: 'AI_DAILY_LIMIT_REACHED',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}

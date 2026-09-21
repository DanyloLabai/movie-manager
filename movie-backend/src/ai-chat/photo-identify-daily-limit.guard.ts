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

export const DEFAULT_PHOTO_IDENTIFY_DAILY_LIMIT = 3;

@Injectable()
export class PhotoIdentifyDailyLimitGuard implements CanActivate {
  private readonly requestLimit: number;

  constructor(
    private readonly aiUsageLogService: AiUsageLogService,
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {
    this.requestLimit = Number(
      this.configService.get<string>('PHOTO_IDENTIFY_DAILY_LIMIT') ??
        DEFAULT_PHOTO_IDENTIFY_DAILY_LIMIT,
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
    const { requestCount } = await this.aiUsageLogService.getUserUsageSince(
      userId,
      since,
      'photo_identify',
    );

    if (requestCount >= this.requestLimit) {
      throw new HttpException(
        {
          message: `Daily photo-identify limit (${this.requestLimit}) reached. Please try again tomorrow.`,
          code: 'PHOTO_IDENTIFY_DAILY_LIMIT_REACHED',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}

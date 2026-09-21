import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiUsageLogService } from './ai-usage-log.service';
import { AuthenticatedRequest } from './interfaces/authenticated-request.interface';
import { APP_TIME_ZONE, startOfDayInTimeZone } from '../common/timezone.util';

export const DEFAULT_TASTE_MATCH_DAILY_LIMIT = 3;

@Injectable()
export class TasteMatchDailyLimitGuard implements CanActivate {
  private readonly requestLimit: number;

  constructor(
    private readonly aiUsageLogService: AiUsageLogService,
    private readonly configService: ConfigService,
  ) {
    this.requestLimit = Number(
      this.configService.get<string>('TASTE_MATCH_DAILY_LIMIT') ??
        DEFAULT_TASTE_MATCH_DAILY_LIMIT,
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = req.user?.userId;
    if (!userId) return true;

    const since = startOfDayInTimeZone(APP_TIME_ZONE);
    const { requestCount } = await this.aiUsageLogService.getUserUsageSince(
      userId,
      since,
      'watch_together',
    );

    if (requestCount >= this.requestLimit) {
      throw new HttpException(
        {
          message: `Daily taste-match limit (${this.requestLimit}) reached. Please try again tomorrow.`,
          code: 'TASTE_MATCH_DAILY_LIMIT_REACHED',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}

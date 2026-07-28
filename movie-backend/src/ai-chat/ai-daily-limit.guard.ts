import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiUsageLogService } from './ai-usage-log.service';
import { AuthenticatedRequest } from './ai-chat.controller';

export const DEFAULT_DAILY_REQUEST_LIMIT = 15;
export const DEFAULT_DAILY_TOKEN_LIMIT = 60000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Protects our shared Groq/Gemini API keys from being exhausted by a single
// user — without this, one chatty user could burn through the whole
// account's daily quota and take the AI chat down for everyone else.
@Injectable()
export class AiDailyLimitGuard implements CanActivate {
  private readonly requestLimit: number;
  private readonly tokenLimit: number;

  constructor(
    private readonly aiUsageLogService: AiUsageLogService,
    private readonly configService: ConfigService,
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

    const since = new Date(Date.now() - ONE_DAY_MS);
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

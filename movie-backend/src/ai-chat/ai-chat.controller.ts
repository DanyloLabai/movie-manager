import {
  Body,
  Controller,
  Post,
  Get,
  Req,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { AiChatService } from './ai-chat.service';
import {
  AiDailyLimitGuard,
  DEFAULT_DAILY_REQUEST_LIMIT,
  DEFAULT_DAILY_TOKEN_LIMIT,
} from './ai-daily-limit.guard';
import { AiUsageLogService } from './ai-usage-log.service';
import type { ChatMessage } from './interfaces/chat-message.interface';
import type { AuthenticatedRequest } from './interfaces/authenticated-request.interface';
import { APP_TIME_ZONE, startOfDayInTimeZone } from '../common/timezone.util';
import { User } from '../users/users.entity';

@ApiTags('AI Chat')
@Controller('api/ai')
export class AiChatController {
  private readonly requestLimit: number;
  private readonly tokenLimit: number;

  constructor(
    private readonly aiChatService: AiChatService,
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

  @Get('usage')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current user AI usage',
    description:
      "Get the current user's AI request/token usage since their local midnight (Kyiv by default, or the user's own reported timezone), plus the daily limits (requires authentication)",
  })
  @ApiResponse({ status: 200, description: 'User AI usage stats' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUsage(@Req() req: AuthenticatedRequest) {
    const userId = req.user.userId;
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      select: ['timezone'],
    });
    const since = startOfDayInTimeZone(user?.timezone || APP_TIME_ZONE);
    const { requestCount, totalTokens } =
      await this.aiUsageLogService.getUserUsageSince(userId, since);
    return {
      requestCount,
      totalTokens,
      requestLimit: this.requestLimit,
      tokenLimit: this.tokenLimit,
    };
  }

  @Post('search')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UseGuards(AiDailyLimitGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Search movies with AI',
    description: 'Search for movies using AI chat (requires authentication)',
  })
  @ApiResponse({ status: 200, description: 'AI search results' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async search(
    @Req() req: AuthenticatedRequest,
    @Body() body: { messages: ChatMessage[]; shownMovieIds?: number[] },
  ) {
    const userId = req.user.userId;
    return this.aiChatService.searchMovieByDescription(
      body.messages,
      userId,
      body.shownMovieIds || [],
    );
  }

  @Post('watch-together/:friendId')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(AiDailyLimitGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get AI movie picks for watching with a friend',
    description:
      'Suggests movies both the current user and the given friend would enjoy, excluding anything either has already watched or added to their watchlist (requires authentication)',
  })
  @ApiParam({ name: 'friendId', type: 'number', description: 'Friend user ID' })
  @ApiResponse({ status: 200, description: 'Shared AI movie picks' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async watchTogether(
    @Req() req: AuthenticatedRequest,
    @Param('friendId', ParseIntPipe) friendId: number,
  ) {
    const userId = req.user.userId;
    return this.aiChatService.recommendForTwo(userId, friendId);
  }

  @Get('history')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get chat history',
    description: 'Get user AI chat history (requires authentication)',
  })
  @ApiResponse({ status: 200, description: 'User chat history' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getHistory(@Req() req: AuthenticatedRequest) {
    const userId = req.user.userId;
    return this.aiChatService.getHistory(userId);
  }

  @Post('history')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Save chat history',
    description: 'Save user AI chat history (requires authentication)',
  })
  @ApiResponse({ status: 200, description: 'Chat history saved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async saveHistory(
    @Req() req: AuthenticatedRequest,
    @Body() body: { messages: ChatMessage[] },
  ) {
    const userId = req.user.userId;
    await this.aiChatService.saveHistory(userId, body.messages);
    return { success: true };
  }
}

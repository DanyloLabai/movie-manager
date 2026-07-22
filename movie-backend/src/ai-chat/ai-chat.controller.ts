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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AiChatService } from './ai-chat.service';
import { AiDailyLimitGuard } from './ai-daily-limit.guard';
import { MovieResultDto } from '../movies/dto/movie-result.dto';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  movies?: MovieResultDto[];
}

export interface AuthenticatedRequest extends Request {
  user: {
    userId: number;
  };
}

@ApiTags('AI Chat')
@Controller('api/ai')
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) {}

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

import { Body, Controller, Post, Get, Req, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AiChatService } from './ai-chat.service';
import { AuthGuard } from '@nestjs/passport';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
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
  @UseGuards(AuthGuard('jwt'))
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

  @Get('history')
  @UseGuards(AuthGuard('jwt'))
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
  @UseGuards(AuthGuard('jwt'))
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

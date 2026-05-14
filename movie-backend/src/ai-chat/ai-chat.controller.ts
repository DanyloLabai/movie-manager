import { Body, Controller, Post, Get, Req, UseGuards } from '@nestjs/common';
import { AiChatService } from './ai-chat.service';
import { AuthGuard } from '@nestjs/passport';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Controller('api/ai')
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) {}

  @Post('search')
  @UseGuards(AuthGuard('jwt'))
  async search(@Req() req, @Body('messages') messages: ChatMessage[]) {
    const userId = req.user.userId;
    return this.aiChatService.searchMovieByDescription(messages, userId);
  }

  @Get('history')
  @UseGuards(AuthGuard('jwt'))
  async getHistory(@Req() req) {
    const userId = req.user.userId;
    return this.aiChatService.getHistory(userId);
  }

  @Post('history')
  @UseGuards(AuthGuard('jwt'))
  async saveHistory(@Req() req, @Body() body: { messages: any[] }) {
    const userId = req.user.userId;
    await this.aiChatService.saveHistory(userId, body.messages);
    return { success: true };
  }
}

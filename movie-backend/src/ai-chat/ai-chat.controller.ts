import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
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
}

import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AiChatService } from './ai-chat.service';
import { AuthGuard } from '@nestjs/passport';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Controller('api/ai')
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post('search')
  async searchMovie(@Body('messages') messages: ChatMessage[]) {
    return this.aiChatService.searchMovieByDescription(messages);
  }
}

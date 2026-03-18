// src/ai-chat/ai-chat.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { AiChatService } from './ai-chat.service';

@Controller('api/ai')
export class AiChatController {
  constructor(private readonly aiChatService: AiChatService) {}

  @Post('search')
  async searchMovie(@Body('prompt') prompt: string) {
    return this.aiChatService.searchMovieByDescription(prompt);
  }
}

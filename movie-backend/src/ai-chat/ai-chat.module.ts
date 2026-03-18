import { Module } from '@nestjs/common';
import { AiChatService } from './ai-chat.service';
import { AiChatController } from './ai-chat.controller';
import { MoviesModule } from 'src/movies/movies.module';

@Module({
  imports: [MoviesModule],
  providers: [AiChatService],
  controllers: [AiChatController],
})
export class AiChatModule {}

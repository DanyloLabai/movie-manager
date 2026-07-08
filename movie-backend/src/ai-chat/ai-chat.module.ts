import { Module } from '@nestjs/common';
import { AiChatService } from './ai-chat.service';
import { AiChatController } from './ai-chat.controller';
import { MoviesModule } from 'src/movies/movies.module';
import { VectorModule } from 'src/vector/vector.module';

@Module({
  imports: [MoviesModule, VectorModule],
  providers: [AiChatService],
  controllers: [AiChatController],
})
export class AiChatModule {}

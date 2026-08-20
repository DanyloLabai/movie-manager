import { Module } from '@nestjs/common';
import { AiChatService } from './ai-chat.service';
import { AiChatController } from './ai-chat.controller';
import { AiUsageModule } from './ai-usage.module';
import { MoviesModule } from 'src/movies/movies.module';
import { VectorModule } from 'src/vector/vector.module';

@Module({
  imports: [MoviesModule, VectorModule, AiUsageModule],
  providers: [AiChatService],
  controllers: [AiChatController],
  exports: [AiUsageModule],
})
export class AiChatModule {}

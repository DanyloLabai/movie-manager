import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MoviesModule } from '../movies/movies.module';
import { VectorController } from './vector.controller';
import { VectorService } from './vector.service';
import { AiChatModule } from 'src/ai-chat/ai-chat.module';

@Module({
  imports: [ConfigModule],
  providers: [VectorService],
  controllers: [VectorController],
  exports: [VectorService],
})
export class VectorModule {}

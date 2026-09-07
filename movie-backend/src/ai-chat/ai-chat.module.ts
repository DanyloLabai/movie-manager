import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiChatService } from './ai-chat.service';
import { AiChatController } from './ai-chat.controller';
import { AiUsageModule } from './ai-usage.module';
import { MoviesModule } from 'src/movies/movies.module';
import { VectorModule } from 'src/vector/vector.module';
import { User } from 'src/users/users.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    MoviesModule,
    VectorModule,
    AiUsageModule,
  ],
  providers: [AiChatService],
  controllers: [AiChatController],
  exports: [AiUsageModule],
})
export class AiChatModule {}

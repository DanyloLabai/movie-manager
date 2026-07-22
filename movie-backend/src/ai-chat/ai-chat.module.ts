import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiChatService } from './ai-chat.service';
import { AiChatController } from './ai-chat.controller';
import { AiUsageLogService } from './ai-usage-log.service';
import { AiUsageLog } from './ai-usage-log.entity';
import { AiDailyLimitGuard } from './ai-daily-limit.guard';
import { MoviesModule } from 'src/movies/movies.module';
import { VectorModule } from 'src/vector/vector.module';

@Module({
  imports: [MoviesModule, VectorModule, TypeOrmModule.forFeature([AiUsageLog])],
  providers: [AiChatService, AiUsageLogService, AiDailyLimitGuard],
  controllers: [AiChatController],
  exports: [AiUsageLogService],
})
export class AiChatModule {}

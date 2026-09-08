import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiUsageLogService } from './ai-usage-log.service';
import { AiUsageLog } from './ai-usage-log.entity';
import { AiDailyLimitGuard } from './ai-daily-limit.guard';
import { TasteMatchDailyLimitGuard } from './taste-match-daily-limit.guard';
import { User } from '../users/users.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AiUsageLog, User])],
  providers: [AiUsageLogService, AiDailyLimitGuard, TasteMatchDailyLimitGuard],
  exports: [AiUsageLogService, AiDailyLimitGuard, TasteMatchDailyLimitGuard],
})
export class AiUsageModule {}

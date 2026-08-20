import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiUsageLogService } from './ai-usage-log.service';
import { AiUsageLog } from './ai-usage-log.entity';
import { AiDailyLimitGuard } from './ai-daily-limit.guard';

@Module({
  imports: [TypeOrmModule.forFeature([AiUsageLog])],
  providers: [AiUsageLogService, AiDailyLimitGuard],
  exports: [AiUsageLogService, AiDailyLimitGuard],
})
export class AiUsageModule {}

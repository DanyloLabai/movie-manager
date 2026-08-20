import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MoviesService } from './movies.service';
import { WatchedReminderService } from './watched-reminder.service';
import { MoviesController } from './movies.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WatchlistItem } from './watchlist-entity';
import { AuthModule } from 'src/auth/auth.module';
import { User } from 'src/users/users.entity';
import { VectorModule } from 'src/vector/vector.module';
import { ActivityModule } from 'src/activity/activity.module';
import { PushModule } from 'src/push/push.module';
import { SearchHistoryModule } from 'src/search-history/search-history.module';
import { AchievementsModule } from 'src/achievements/achievements.module';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { AiUsageModule } from 'src/ai-chat/ai-usage.module';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([WatchlistItem, User]),
    AuthModule,
    VectorModule,
    ActivityModule,
    PushModule,
    SearchHistoryModule,
    AchievementsModule,
    NotificationsModule,
    AiUsageModule,
  ],
  providers: [MoviesService, WatchedReminderService],
  controllers: [MoviesController],
  exports: [MoviesService],
})
export class MoviesModule {}

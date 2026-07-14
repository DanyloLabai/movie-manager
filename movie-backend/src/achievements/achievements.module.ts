import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserAchievement } from './user-achievement.entity';
import { WatchlistItem } from '../movies/watchlist-entity';
import { QuizAttempt } from '../quiz/quiz-attempt.entity';
import { AchievementsService } from './achievements.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserAchievement, WatchlistItem, QuizAttempt]),
    NotificationsModule,
  ],
  providers: [AchievementsService],
  exports: [AchievementsService],
})
export class AchievementsModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuizMoviePool } from './quiz-movie-pool.entity';
import { DailyMovieQuiz } from './daily-movie-quiz.entity';
import { QuizAttempt } from './quiz-attempt.entity';
import { QuizService } from './quiz.service';
import { QuizController } from './quiz.controller';
import { QuizHintsService } from './quiz-hints.service';
import { QuizSchedulerService } from './quiz-scheduler.service';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AchievementsModule } from '../achievements/achievements.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([QuizMoviePool, DailyMovieQuiz, QuizAttempt]),
    UsersModule,
    NotificationsModule,
    AchievementsModule,
  ],
  providers: [QuizService, QuizHintsService, QuizSchedulerService],
  controllers: [QuizController],
})
export class QuizModule {}

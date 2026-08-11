import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { QuizService } from './quiz.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class QuizSchedulerService {
  private readonly logger = new Logger(QuizSchedulerService.name);

  constructor(
    private readonly quizService: QuizService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron('0 0 * * *')
  async generateTodayQuiz() {
    this.logger.log('Generating daily movie quiz...');
    try {
      const quiz = await this.quizService.getOrCreateTodayQuiz();
      this.logger.log(
        `Daily quiz ready for ${quiz.date} (poolId=${quiz.poolId}).`,
      );
      await this.notifyPastPlayers();
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to generate daily quiz: ${errorMsg}`);
    }
  }

  private async notifyPastPlayers() {
    const userIds = await this.quizService.getEverPlayedUserIds();
    for (const userId of userIds) {
      try {
        await this.notificationsService.notify(userId, {
          type: 'quiz',
          title: 'New daily quiz!',
          body: 'Play today to keep your streak alive.',
          pushTitle: '🎬 New daily quiz',
          pushBody: 'Play today to keep your streak alive.',
          url: '/quiz',
        });
      } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Failed to notify user ${userId} about the daily quiz: ${errorMsg}`,
        );
      }
    }
    if (userIds.length > 0) {
      this.logger.log(
        `Sent daily quiz reminders to ${userIds.length} player(s).`,
      );
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { Resend } from 'resend';
import { User } from 'src/users/users.entity';
import { WatchlistItem } from './watchlist-entity';

@Injectable()
export class WatchedReminderService {
  private readonly logger = new Logger(WatchedReminderService.name);
  private readonly resend: Resend;
  private readonly frontendUrl: string;
  private readonly reminderDays: number;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(WatchlistItem)
    private readonly watchlistRepo: Repository<WatchlistItem>,
  ) {
    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
    this.frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    this.reminderDays =
      this.configService.get<number>('WATCHED_REMINDER_DAYS') || 14;
  }

  @Cron('0 10 * * *')
  async sendInactivityReminders() {
    this.logger.log('Running daily check for inactive users...');

    const cutoff = new Date(
      Date.now() - this.reminderDays * 24 * 60 * 60 * 1000,
    );

    try {
      const inactiveRows = await this.watchlistRepo
        .createQueryBuilder('w')
        .innerJoin('w.user', 'user')
        .select('user.id', 'userId')
        .addSelect('MAX(w.watchedAt)', 'lastWatchedAt')
        .where('w.watchedAt IS NOT NULL')
        .groupBy('user.id')
        .having('MAX(w.watchedAt) < :cutoff', { cutoff })
        .getRawMany<{ userId: number; lastWatchedAt: Date }>();

      if (inactiveRows.length === 0) {
        this.logger.log('No inactive users found.');
        return;
      }

      const inactiveUserIds = inactiveRows.map((row) => row.userId);

      const usersToNotify = await this.usersRepo
        .createQueryBuilder('user')
        .where('user.id IN (:...inactiveUserIds)', { inactiveUserIds })
        .andWhere(
          '(user.lastReminderSentAt IS NULL OR user.lastReminderSentAt < :cutoff)',
          { cutoff },
        )
        .getMany();

      if (usersToNotify.length === 0) {
        this.logger.log('All inactive users were already reminded recently.');
        return;
      }

      for (const user of usersToNotify) {
        if (!user.email) continue;

        try {
          await this.resend.emails.send({
            from: 'Lumen Movie Tracker <noreply@movietracker.ink>',
            to: user.email,
            subject: "🎬 You haven't logged a watch in a while",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #12100e; color: #f0e6cc; padding: 40px; border-radius: 16px;">
                <h2 style="color: #c8963c; text-transform: uppercase; letter-spacing: 0.1em;">We miss you! 🍿</h2>
                <p>Hi <strong>${user.username}</strong>,</p>
                <p>It's been ${this.reminderDays}+ days since you last marked something as watched. Your watchlist is waiting for you.</p>
                <a href="${this.frontendUrl}/watchlist"
                   style="display: inline-block; padding: 14px 28px; background-color: #c8963c; color: #12100e; text-decoration: none; border-radius: 12px; font-weight: 900; margin: 24px 0; text-transform: uppercase; letter-spacing: 0.1em;">
                  View Watchlist
                </a>
              </div>
            `,
          });

          user.lastReminderSentAt = new Date();
          await this.usersRepo.save(user);

          this.logger.log(`Sent inactivity reminder to ${user.email}`);
        } catch (emailError: unknown) {
          const errorMsg =
            emailError instanceof Error
              ? emailError.message
              : String(emailError);
          this.logger.error(
            `Failed to send inactivity reminder to ${user.email}: ${errorMsg}`,
          );
        }
      }
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to process inactivity reminders: ${errorMsg}`);
    }
  }
}

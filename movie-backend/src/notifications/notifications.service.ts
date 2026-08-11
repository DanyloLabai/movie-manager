import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { Notification, NotificationType } from './notification.entity';
import { User } from '../users/users.entity';
import { PushService } from '../push/push.service';

export interface NotifyInput {
  type: NotificationType;
  title: string;
  body: string;
  pushTitle?: string;
  pushBody?: string;
  tmdbId?: number | null;
  posterUrl?: string | null;
  mediaType?: string | null;
  url?: string | null;
}

const RETENTION_DAYS = 30;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationRepo: Repository<Notification>,
    private pushService: PushService,
  ) {}

  async notify(userId: number, input: NotifyInput): Promise<void> {
    await this.notificationRepo.save(
      this.notificationRepo.create({
        type: input.type,
        title: input.title,
        body: input.body,
        tmdbId: input.tmdbId ?? null,
        posterUrl: input.posterUrl ?? undefined,
        mediaType: input.mediaType ?? null,
        url: input.url ?? null,
        user: { id: userId } as User,
      }),
    );

    await this.pushService
      .sendToUser(userId, {
        title: input.pushTitle ?? input.title,
        body: input.pushBody ?? input.body,
        url: input.url ?? undefined,
      })
      .catch((err: unknown) =>
        this.logger.warn(
          `Failed to send push for notification "${input.title}": ${
            err instanceof Error ? err.message : String(err)
          }`,
        ),
      );
  }

  async getNotifications(userId: number, limit = 30, offset = 0) {
    return this.notificationRepo.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async markNotificationRead(userId: number, notificationId: number) {
    const notification = await this.notificationRepo.findOne({
      where: { id: notificationId, user: { id: userId } },
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    notification.isRead = true;
    await this.notificationRepo.save(notification);
    return { message: 'Notification marked as read' };
  }

  async markAllNotificationsRead(userId: number) {
    await this.notificationRepo.update(
      { user: { id: userId }, isRead: false },
      { isRead: true },
    );
    return { message: 'All notifications marked as read' };
  }

  @Cron('0 5 * * *')
  async deleteOldNotifications() {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

    const result = await this.notificationRepo.delete({
      createdAt: LessThan(cutoff),
    });

    if (result.affected) {
      this.logger.log(
        `Deleted ${result.affected} notification(s) older than ${RETENTION_DAYS} days.`,
      );
    }
  }
}

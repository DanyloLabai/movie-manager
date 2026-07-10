import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as webpush from 'web-push';
import { PushSubscription } from './push-subscription.entity';
import { User } from '../users/users.entity';

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  private readonly publicKey: string;
  private readonly enabled: boolean;

  constructor(
    private configService: ConfigService,
    @InjectRepository(PushSubscription)
    private pushSubRepo: Repository<PushSubscription>,
  ) {
    this.publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY') || '';
    const privateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');
    const subject = this.configService.get<string>('VAPID_SUBJECT');

    this.enabled = Boolean(this.publicKey && privateKey && subject);
    if (this.enabled) {
      webpush.setVapidDetails(subject!, this.publicKey, privateKey!);
    } else {
      this.logger.warn(
        'VAPID keys not configured — push notifications are disabled.',
      );
    }
  }

  getPublicKey(): string {
    return this.publicKey;
  }

  async saveSubscription(
    userId: number,
    endpoint: string,
    p256dh: string,
    auth: string,
  ) {
    const existing = await this.pushSubRepo.findOne({ where: { endpoint } });
    if (existing) {
      existing.p256dh = p256dh;
      existing.auth = auth;
      existing.user = { id: userId } as User;
      return this.pushSubRepo.save(existing);
    }

    return this.pushSubRepo.save(
      this.pushSubRepo.create({
        endpoint,
        p256dh,
        auth,
        user: { id: userId } as User,
      }),
    );
  }

  async removeSubscription(userId: number, endpoint: string) {
    await this.pushSubRepo.delete({ endpoint, user: { id: userId } as User });
    return { message: 'Unsubscribed' };
  }

  async sendToUser(userId: number, payload: PushPayload): Promise<void> {
    if (!this.enabled) return;

    const subscriptions = await this.pushSubRepo.find({
      where: { user: { id: userId } as User },
    });
    if (subscriptions.length === 0) return;

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify(payload),
          );
        } catch (error: unknown) {
          const statusCode = (error as { statusCode?: number }).statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await this.pushSubRepo.delete({ id: sub.id }).catch(() => {});
          } else {
            this.logger.warn(
              `Failed to send push to subscription ${sub.id}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }
        }
      }),
    );
  }
}

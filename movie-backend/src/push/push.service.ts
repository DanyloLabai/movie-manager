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
        'VAPID keys not configured- push notifications are disabled.',
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
      existing.provider = 'web';
      existing.p256dh = p256dh;
      existing.auth = auth;
      existing.user = { id: userId } as User;
      return this.pushSubRepo.save(existing);
    }

    return this.pushSubRepo.save(
      this.pushSubRepo.create({
        endpoint,
        provider: 'web',
        p256dh,
        auth,
        user: { id: userId } as User,
      }),
    );
  }

  // Expo push tokens (from mobile's expo-notifications) have no p256dh/auth
  // keys — the token itself, stored in `endpoint`, is all sendToUser needs.
  async saveExpoSubscription(userId: number, token: string) {
    const existing = await this.pushSubRepo.findOne({
      where: { endpoint: token },
    });
    if (existing) {
      existing.provider = 'expo';
      existing.p256dh = null;
      existing.auth = null;
      existing.user = { id: userId } as User;
      return this.pushSubRepo.save(existing);
    }

    return this.pushSubRepo.save(
      this.pushSubRepo.create({
        endpoint: token,
        provider: 'expo',
        p256dh: null,
        auth: null,
        user: { id: userId } as User,
      }),
    );
  }

  async removeSubscription(userId: number, endpoint: string) {
    await this.pushSubRepo.delete({ endpoint, user: { id: userId } as User });
    return { message: 'Unsubscribed' };
  }

  async sendToUser(userId: number, payload: PushPayload): Promise<void> {
    const subscriptions = await this.pushSubRepo.find({
      where: { user: { id: userId } as User },
    });
    if (subscriptions.length === 0) return;

    const webSubs = subscriptions.filter((s) => s.provider !== 'expo');
    const expoSubs = subscriptions.filter((s) => s.provider === 'expo');

    await Promise.all([
      this.enabled ? this.sendWebPush(webSubs, payload) : Promise.resolve(),
      this.sendExpoPush(expoSubs, payload),
    ]);
  }

  private async sendWebPush(
    subscriptions: PushSubscription[],
    payload: PushPayload,
  ): Promise<void> {
    await Promise.all(
      subscriptions.map(async (sub) => {
        if (!sub.p256dh || !sub.auth) return;
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
              `Failed to send web push to subscription ${sub.id}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }
        }
      }),
    );
  }

  // Expo's HTTP push API takes no API key for basic sending — just POST the
  // messages and inspect the returned tickets for delivery errors.
  private async sendExpoPush(
    subscriptions: PushSubscription[],
    payload: PushPayload,
  ): Promise<void> {
    if (subscriptions.length === 0) return;

    const messages = subscriptions.map((sub) => ({
      to: sub.endpoint,
      title: payload.title,
      body: payload.body,
      data: payload.url ? { url: payload.url } : undefined,
    }));

    try {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      });
      const json = (await res.json()) as {
        data?: Array<{ status: string; details?: { error?: string } }>;
      };
      const tickets = json.data ?? [];
      await Promise.all(
        tickets.map(async (ticket, i) => {
          if (
            ticket.status === 'error' &&
            ticket.details?.error === 'DeviceNotRegistered'
          ) {
            await this.pushSubRepo
              .delete({ id: subscriptions[i].id })
              .catch(() => {});
          }
        }),
      );
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to send Expo push: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

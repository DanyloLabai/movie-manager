import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Resend } from 'resend';
import { Feedback } from './feedback.entity';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { User } from '../users/users.entity';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);
  private readonly resend: Resend;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Feedback)
    private readonly feedbackRepo: Repository<Feedback>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {
    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
  }

  async create(userId: number, dto: CreateFeedbackDto) {
    const user = await this.usersRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const feedback = this.feedbackRepo.create({
      rating: dto.rating,
      message: dto.message?.trim() || null,
      user,
    });
    await this.feedbackRepo.save(feedback);

    this.notifyAdmins(user, feedback).catch((error: unknown) => {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to send feedback notification email: ${errorMsg}`,
      );
    });

    return { success: true };
  }

  async findAll() {
    return this.feedbackRepo.find({
      relations: ['user'],
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  private async notifyAdmins(user: User, feedback: Feedback) {
    const admins = await this.usersRepo.find({
      where: { isAdmin: true },
      select: ['email'],
    });

    const fallbackEmail = this.configService.get<string>('INITIAL_ADMIN_EMAIL');
    const recipients = admins.length
      ? admins.map((admin) => admin.email)
      : fallbackEmail
        ? [fallbackEmail]
        : [];

    if (recipients.length === 0) {
      return;
    }

    const stars =
      '⭐'.repeat(feedback.rating) + '☆'.repeat(5 - feedback.rating);

    await this.resend.emails.send({
      from: 'Lumen Movie Tracker <noreply@movietracker.ink>',
      to: recipients,
      subject: `New feedback: ${feedback.rating}/5 from ${user.username}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #12100e; color: #f0e6cc; padding: 40px; border-radius: 16px;">
          <h2 style="color: #c8963c; text-transform: uppercase; letter-spacing: 0.1em;">New feedback received</h2>
          <p><strong>${escapeHtml(user.username)}</strong> (${escapeHtml(user.email)}) rated the app <strong>${feedback.rating}/5</strong> ${stars}</p>
          ${
            feedback.message
              ? `<p style="white-space: pre-wrap;">${escapeHtml(feedback.message)}</p>`
              : '<p><em>No comment left.</em></p>'
          }
        </div>
      `,
    });
  }
}

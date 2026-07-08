import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Activity, ActivityType } from './activity.entity';
import { User } from '../users/users.entity';

export interface ActivityFeedItemDto {
  id: number;
  type: ActivityType;
  tmdbId: number;
  title: string;
  posterUrl: string | null;
  mediaType: string;
  rating: number | null;
  createdAt: Date;
  user: {
    id: number;
    username: string;
    avatarUrl: string | null;
  };
}

const FEED_PAGE_SIZE = 30;

@Injectable()
export class ActivityService {
  constructor(
    @InjectRepository(Activity)
    private activityRepo: Repository<Activity>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
  ) {}

  async logActivity(
    userId: number,
    type: ActivityType,
    item: {
      tmdbId: number;
      title: string;
      posterUrl?: string | null;
      mediaType: string;
      rating?: number | null;
    },
  ): Promise<void> {
    const activity = this.activityRepo.create({
      type,
      tmdbId: item.tmdbId,
      title: item.title,
      posterUrl: item.posterUrl || undefined,
      mediaType: item.mediaType,
      rating: item.rating ?? null,
      user: { id: userId } as User,
    });
    await this.activityRepo.save(activity);
  }

  async getFriendsFeed(
    userId: number,
    before?: Date,
  ): Promise<ActivityFeedItemDto[]> {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      relations: ['friends'],
    });

    const friendIds = (user?.friends || []).map((f) => f.id);
    if (friendIds.length === 0) return [];

    const query = this.activityRepo
      .createQueryBuilder('activity')
      .leftJoinAndSelect('activity.user', 'user')
      .where('user.id IN (:...friendIds)', { friendIds })
      .orderBy('activity.createdAt', 'DESC')
      .take(FEED_PAGE_SIZE);

    if (before) {
      query.andWhere('activity.createdAt < :before', { before });
    }

    const entries = await query.getMany();

    return entries.map((entry) => ({
      id: entry.id,
      type: entry.type,
      tmdbId: entry.tmdbId,
      title: entry.title,
      posterUrl: entry.posterUrl || null,
      mediaType: entry.mediaType,
      rating: entry.rating,
      createdAt: entry.createdAt,
      user: {
        id: entry.user.id,
        username: entry.user.username,
        avatarUrl: entry.user.avatarUrl || null,
      },
    }));
  }
}

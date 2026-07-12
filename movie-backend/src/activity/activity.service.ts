import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { Activity, ActivityType } from './activity.entity';
import { User } from '../users/users.entity';
import { WatchlistItem } from '../movies/watchlist-entity';

export interface FriendLastWatchedDto {
  tmdbId: number;
  title: string;
  posterUrl: string | null;
  mediaType: string;
  rating: number | null;
  watchedAt: Date | null;
  user: {
    id: number;
    username: string;
    avatarUrl: string | null;
  };
}

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

export interface DayActivityActionDto {
  tmdbId: number;
  title: string;
  posterUrl: string | null;
  mediaType: string;
  actionType: ActivityType;
  rating: number | null;
}

export interface DayActivityDto {
  date: string;
  count: number;
  actions: DayActivityActionDto[];
}

const FEED_PAGE_SIZE = 30;

@Injectable()
export class ActivityService {
  constructor(
    @InjectRepository(Activity)
    private activityRepo: Repository<Activity>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(WatchlistItem)
    private watchlistRepo: Repository<WatchlistItem>,
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

  async getFriendsLastWatched(userId: number): Promise<FriendLastWatchedDto[]> {
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      relations: ['friends'],
    });

    const friendIds = (user?.friends || []).map((f) => f.id);
    if (friendIds.length === 0) return [];

    const rows = await this.watchlistRepo
      .createQueryBuilder('w')
      .distinctOn(['w.userId'])
      .innerJoinAndSelect('w.user', 'friend')
      .where('w.userId IN (:...friendIds)', { friendIds })
      .andWhere('w.isWatched = true')
      .orderBy('w.userId', 'ASC')
      .addOrderBy('w.watchedAt', 'DESC', 'NULLS LAST')
      .getMany();

    return rows
      .map((row) => ({
        tmdbId: row.tmdbId,
        title: row.title,
        posterUrl: row.posterUrl || null,
        mediaType: row.mediaType,
        rating: row.rating ?? null,
        watchedAt: row.watchedAt,
        user: {
          id: row.user.id,
          username: row.user.username,
          avatarUrl: row.user.avatarUrl || null,
        },
      }))
      .sort((a, b) => {
        const aTime = a.watchedAt ? new Date(a.watchedAt).getTime() : 0;
        const bTime = b.watchedAt ? new Date(b.watchedAt).getTime() : 0;
        return bTime - aTime;
      });
  }

  async getUserActivityByDay(
    userId: number,
    year: number,
  ): Promise<DayActivityDto[]> {
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year + 1, 0, 1));

    const entries = await this.activityRepo.find({
      where: { user: { id: userId }, createdAt: Between(start, end) },
      order: { createdAt: 'ASC' },
    });

    const byDay = new Map<string, DayActivityDto>();
    for (const entry of entries) {
      const date = entry.createdAt.toISOString().slice(0, 10);
      let bucket = byDay.get(date);
      if (!bucket) {
        bucket = { date, count: 0, actions: [] };
        byDay.set(date, bucket);
      }
      bucket.count += 1;
      bucket.actions.push({
        tmdbId: entry.tmdbId,
        title: entry.title,
        posterUrl: entry.posterUrl || null,
        mediaType: entry.mediaType,
        actionType: entry.type,
        rating: entry.rating,
      });
    }

    return Array.from(byDay.values());
  }
}

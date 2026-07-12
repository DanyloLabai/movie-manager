import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserAchievement } from './user-achievement.entity';
import { WatchlistItem } from '../movies/watchlist-entity';
import { User } from '../users/users.entity';
import { NotificationsService } from '../notifications/notifications.service';

interface AchievementDefinition {
  id: string;
  name: string;
  requirement: string;
  isUnlocked: (counts: {
    totalCount: number;
    watchedCount: number;
    favoritesCount: number;
  }) => boolean;
}

const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'first_blood',
    name: 'First Blood',
    requirement: 'Add 1 movie to watchlist or mark as watched',
    isUnlocked: ({ totalCount }) => totalCount > 0,
  },
  {
    id: 'critic',
    name: 'Critic',
    requirement: 'Add 5 movies to favorites',
    isUnlocked: ({ favoritesCount }) => favoritesCount >= 5,
  },
  {
    id: 'cinephile',
    name: 'Cinephile',
    requirement: 'Mark 10 movies as watched',
    isUnlocked: ({ watchedCount }) => watchedCount >= 10,
  },
  {
    id: 'collector',
    name: 'Collector',
    requirement: 'Collect 20 movies total (watched + watchlist)',
    isUnlocked: ({ totalCount }) => totalCount >= 20,
  },
  {
    id: 'tastemaker',
    name: 'Tastemaker',
    requirement: 'Add 20 movies to favorites',
    isUnlocked: ({ favoritesCount }) => favoritesCount >= 20,
  },
  {
    id: 'filmbuff',
    name: 'Film Buff',
    requirement: 'Mark 50 movies as watched',
    isUnlocked: ({ watchedCount }) => watchedCount >= 50,
  },
  {
    id: 'librarian',
    name: 'Librarian',
    requirement: 'Collect 100 movies total (watched + watchlist)',
    isUnlocked: ({ totalCount }) => totalCount >= 100,
  },
];

@Injectable()
export class AchievementsService {
  private readonly logger = new Logger(AchievementsService.name);

  constructor(
    @InjectRepository(UserAchievement)
    private userAchievementRepo: Repository<UserAchievement>,
    @InjectRepository(WatchlistItem)
    private watchlistRepo: Repository<WatchlistItem>,
    private notificationsService: NotificationsService,
  ) {}

  async checkAndNotify(userId: number): Promise<void> {
    const [totalCount, watchedCount, favoritesCount, unlocked] =
      await Promise.all([
        this.watchlistRepo.count({ where: { user: { id: userId } } }),
        this.watchlistRepo.count({
          where: { user: { id: userId }, isWatched: true },
        }),
        this.watchlistRepo.count({
          where: { user: { id: userId }, isFavorite: true },
        }),
        this.userAchievementRepo.find({ where: { user: { id: userId } } }),
      ]);

    const unlockedIds = new Set(unlocked.map((u) => u.achievementId));
    const counts = { totalCount, watchedCount, favoritesCount };

    const newlyUnlocked = ACHIEVEMENTS.filter(
      (achievement) =>
        !unlockedIds.has(achievement.id) && achievement.isUnlocked(counts),
    );

    for (const achievement of newlyUnlocked) {
      try {
        await this.userAchievementRepo.save(
          this.userAchievementRepo.create({
            achievementId: achievement.id,
            user: { id: userId } as User,
          }),
        );

        await this.notificationsService.notify(userId, {
          type: 'achievement',
          title: achievement.name,
          body: achievement.requirement,
          pushTitle: '🏆 Achievement unlocked!',
          pushBody: `${achievement.name} — ${achievement.requirement}`,
          url: '/watchlist',
        });
      } catch (error: unknown) {
        this.logger.error(
          `Failed to unlock/notify achievement "${achievement.id}" for user ${userId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }
}

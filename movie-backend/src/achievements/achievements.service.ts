import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserAchievement } from './user-achievement.entity';
import { WatchlistItem } from '../movies/watchlist-entity';
import { QuizAttempt } from '../quiz/quiz-attempt.entity';
import { User } from '../users/users.entity';
import { NotificationsService } from '../notifications/notifications.service';

const PERFECT_QUIZ_SCORE = 100;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface AchievementCounts {
  totalCount: number;
  watchedCount: number;
  favoritesCount: number;
  quizSolvedCount: number;
  quizPerfectCount: number;
  quizCurrentStreak: number;
}

interface AchievementDefinition {
  id: string;
  name: string;
  requirement: string;
  isUnlocked: (counts: AchievementCounts) => boolean;
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
  {
    id: 'quiz_first_win',
    name: 'Quiz Rookie',
    requirement: 'Solve 1 daily movie quiz',
    isUnlocked: ({ quizSolvedCount }) => quizSolvedCount >= 1,
  },
  {
    id: 'quiz_perfectionist',
    name: 'Perfectionist',
    requirement: 'Solve a daily quiz without buying any hints',
    isUnlocked: ({ quizPerfectCount }) => quizPerfectCount >= 1,
  },
  {
    id: 'quiz_streak_7',
    name: 'Week Streak',
    requirement: 'Solve the daily quiz 7 days in a row',
    isUnlocked: ({ quizCurrentStreak }) => quizCurrentStreak >= 7,
  },
  {
    id: 'quiz_streak_30',
    name: 'Month Streak',
    requirement: 'Solve the daily quiz 30 days in a row',
    isUnlocked: ({ quizCurrentStreak }) => quizCurrentStreak >= 30,
  },
  {
    id: 'quiz_veteran',
    name: 'Quiz Veteran',
    requirement: 'Solve 50 daily quizzes total',
    isUnlocked: ({ quizSolvedCount }) => quizSolvedCount >= 50,
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
    @InjectRepository(QuizAttempt)
    private quizAttemptRepo: Repository<QuizAttempt>,
    private notificationsService: NotificationsService,
  ) {}

  async checkAndNotify(userId: number): Promise<void> {
    const [totalCount, watchedCount, favoritesCount, unlocked, solvedQuizzes] =
      await Promise.all([
        this.watchlistRepo.count({ where: { user: { id: userId } } }),
        this.watchlistRepo.count({
          where: { user: { id: userId }, isWatched: true },
        }),
        this.watchlistRepo.count({
          where: { user: { id: userId }, isFavorite: true },
        }),
        this.userAchievementRepo.find({ where: { user: { id: userId } } }),
        this.quizAttemptRepo.find({
          where: { userId, isSolved: true },
          select: ['quizDate', 'score'],
          order: { quizDate: 'ASC' },
        }),
      ]);

    const unlockedIds = new Set(unlocked.map((u) => u.achievementId));
    const counts: AchievementCounts = {
      totalCount,
      watchedCount,
      favoritesCount,
      quizSolvedCount: solvedQuizzes.length,
      quizPerfectCount: solvedQuizzes.filter(
        (q) => q.score === PERFECT_QUIZ_SCORE,
      ).length,
      quizCurrentStreak: this.computeCurrentStreak(
        solvedQuizzes.map((q) => q.quizDate),
      ),
    };

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

  /** Streak of consecutive-day solves ending today or yesterday, given ascending-sorted solved dates. */
  private computeCurrentStreak(sortedDates: string[]): number {
    if (sortedDates.length === 0) return 0;

    let run = 1;
    for (let i = 1; i < sortedDates.length; i++) {
      const diff = Date.parse(sortedDates[i]) - Date.parse(sortedDates[i - 1]);
      run = diff === MS_PER_DAY ? run + 1 : 1;
    }

    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - MS_PER_DAY)
      .toISOString()
      .slice(0, 10);
    const lastSolved = sortedDates[sortedDates.length - 1];
    return lastSolved === today || lastSolved === yesterday ? run : 0;
  }
}

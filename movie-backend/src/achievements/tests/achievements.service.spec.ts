import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AchievementsService } from '../achievements.service';
import { UserAchievement } from '../user-achievement.entity';
import { WatchlistItem } from '../../movies/watchlist-entity';
import { QuizAttempt } from '../../quiz/quiz-attempt.entity';
import { NotificationsService } from '../../notifications/notifications.service';

const mockUserAchievementRepo = {
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
};

const mockWatchlistRepo = {
  count: jest.fn(),
};

const mockQuizAttemptRepo = {
  find: jest.fn(),
};

const mockNotificationsService = {
  notify: jest.fn(),
};

describe('AchievementsService', () => {
  let service: AchievementsService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AchievementsService,
        {
          provide: getRepositoryToken(UserAchievement),
          useValue: mockUserAchievementRepo,
        },
        {
          provide: getRepositoryToken(WatchlistItem),
          useValue: mockWatchlistRepo,
        },
        {
          provide: getRepositoryToken(QuizAttempt),
          useValue: mockQuizAttemptRepo,
        },
        {
          provide: NotificationsService,
          useValue: mockNotificationsService,
        },
      ],
    }).compile();

    service = module.get<AchievementsService>(AchievementsService);
  });

  describe('checkAndNotify', () => {
    it('unlocks "first_blood" when totalCount > 0 and not yet unlocked', async () => {
      mockWatchlistRepo.count
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      mockUserAchievementRepo.find.mockResolvedValueOnce([]);
      mockQuizAttemptRepo.find.mockResolvedValueOnce([]);
      mockUserAchievementRepo.create.mockImplementation((data: object) => data);
      mockUserAchievementRepo.save.mockResolvedValueOnce(undefined);
      mockNotificationsService.notify.mockResolvedValueOnce(undefined);

      await service.checkAndNotify(1);

      expect(mockUserAchievementRepo.save).toHaveBeenCalledWith({
        achievementId: 'first_blood',
        user: { id: 1 },
      });
      expect(mockNotificationsService.notify).toHaveBeenCalledWith(1, {
        type: 'achievement',
        title: 'First Blood',
        body: 'Add 1 movie to watchlist or mark as watched',
        pushTitle: '🏆 Achievement unlocked!',
        pushBody: `First Blood- Add 1 movie to watchlist or mark as watched`,
        url: '/watchlist',
      });
    });
    it('does not re-save an achievement that is already unlocked', async () => {
      mockWatchlistRepo.count
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      mockUserAchievementRepo.find.mockResolvedValueOnce([
        { achievementId: 'first_blood' },
      ]);
      mockQuizAttemptRepo.find.mockResolvedValueOnce([]);
      mockUserAchievementRepo.create.mockImplementation((data: object) => data);
      mockUserAchievementRepo.save.mockResolvedValueOnce(undefined);
      mockNotificationsService.notify.mockResolvedValueOnce(undefined);

      await service.checkAndNotify(1);

      expect(mockUserAchievementRepo.save).not.toHaveBeenCalled();
      expect(mockNotificationsService.notify).not.toHaveBeenCalled();
    });
    it('continues unlocking other achievements if one save() throws', async () => {
      mockWatchlistRepo.count
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(0);
      mockUserAchievementRepo.find.mockResolvedValueOnce([]);
      mockQuizAttemptRepo.find.mockResolvedValueOnce([]);
      mockUserAchievementRepo.create.mockImplementation((data: object) => data);
      mockUserAchievementRepo.save
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValueOnce(undefined);
      mockNotificationsService.notify.mockResolvedValueOnce(undefined);

      await service.checkAndNotify(1);

      expect(mockUserAchievementRepo.save).toHaveBeenCalled();
      expect(mockNotificationsService.notify).toHaveBeenCalled();
    });
    it('counts a perfect quiz only when score === 100', async () => {
      mockWatchlistRepo.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      mockUserAchievementRepo.find.mockResolvedValueOnce([]);
      mockQuizAttemptRepo.find.mockResolvedValueOnce([
        { quizDate: '2026-09-01', score: 100 },
      ]);
      mockUserAchievementRepo.create.mockImplementation((data: object) => data);
      mockUserAchievementRepo.save.mockResolvedValueOnce(undefined);
      mockNotificationsService.notify.mockResolvedValueOnce(undefined);

      await service.checkAndNotify(1);

      expect(mockUserAchievementRepo.save).toHaveBeenCalledWith({
        achievementId: 'quiz_perfectionist',
        user: { id: 1 },
      });
      expect(mockNotificationsService.notify).toHaveBeenCalledWith(1, {
        type: 'achievement',
        title: 'Perfectionist',
        body: 'Solve a daily quiz without buying any hints',
        pushTitle: '🏆 Achievement unlocked!',
        pushBody: 'Perfectionist- Solve a daily quiz without buying any hints',
        url: '/watchlist',
      });
    });
  });

  describe('computeCurrentStreak (через checkAndNotify -> quiz_streak_7/30)', () => {
    it('unlocks "quiz_streak_7" for 7 consecutive solved days ending today/yesterday', async () => {
      const today = new Date();
      const sortedDate: string[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        sortedDate.push(d.toISOString().slice(0, 10));
      }

      mockWatchlistRepo.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      mockUserAchievementRepo.find.mockResolvedValueOnce([]);
      mockQuizAttemptRepo.find.mockResolvedValueOnce(
        sortedDate.map((quizDate) => ({ quizDate, score: 100 })),
      );
      mockUserAchievementRepo.create.mockImplementation((data: object) => data);
      mockUserAchievementRepo.save.mockResolvedValue(undefined);
      mockNotificationsService.notify.mockResolvedValue(undefined);

      await service.checkAndNotify(1);

      expect(mockUserAchievementRepo.save).toHaveBeenCalledWith({
        achievementId: 'quiz_streak_7',
        user: { id: 1 },
      });
      expect(mockNotificationsService.notify).toHaveBeenCalledWith(1, {
        type: 'achievement',
        title: 'Week Streak',
        body: 'Solve the daily quiz 7 days in a row',
        pushTitle: '🏆 Achievement unlocked!',
        pushBody: 'Week Streak- Solve the daily quiz 7 days in a row',
        url: '/watchlist',
      });
    });
    it('resets the streak count when there is a gap between dates', async () => {
      const today = new Date();
      const sortedDate: string[] = [];
      for (let i = 6; i >= 0; i--) {
        if (i === 4) continue;
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        sortedDate.push(d.toISOString().slice(0, 10));
      }

      mockWatchlistRepo.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      mockUserAchievementRepo.find.mockResolvedValueOnce([]);
      mockQuizAttemptRepo.find.mockResolvedValueOnce(
        sortedDate.map((quizDate) => ({ quizDate, score: 100 })),
      );
      mockUserAchievementRepo.create.mockImplementation((data: object) => data);
      mockUserAchievementRepo.save.mockResolvedValue(undefined);
      mockNotificationsService.notify.mockResolvedValue(undefined);

      await service.checkAndNotify(1);

      expect(mockUserAchievementRepo.save).not.toHaveBeenCalledWith(
        expect.objectContaining({ achievementId: 'quiz_streak_7' }),
      );
      expect(mockNotificationsService.notify).not.toHaveBeenCalledWith(
        1,
        expect.objectContaining({ title: 'Week Streak' }),
      );
    });
    it('treats streak as 0 when the last solved date is older than yesterday', async () => {
      const today = new Date();
      const sortedDate: string[] = [];
      for (let i = 9; i >= 3; i--) {
        if (i === 4) continue;
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        sortedDate.push(d.toISOString().slice(0, 10));
      }

      mockWatchlistRepo.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      mockUserAchievementRepo.find.mockResolvedValueOnce([]);
      mockQuizAttemptRepo.find.mockResolvedValueOnce(
        sortedDate.map((quizDate) => ({ quizDate, score: 100 })),
      );
      mockUserAchievementRepo.create.mockImplementation((data: object) => data);
      mockUserAchievementRepo.save.mockResolvedValue(undefined);
      mockNotificationsService.notify.mockResolvedValue(undefined);

      await service.checkAndNotify(1);

      expect(mockUserAchievementRepo.save).not.toHaveBeenCalledWith(
        expect.objectContaining({ achievementId: 'quiz_streak_7' }),
      );
      expect(mockNotificationsService.notify).not.toHaveBeenCalledWith(
        1,
        expect.objectContaining({ title: 'Week Streak' }),
      );
    });
  });
});

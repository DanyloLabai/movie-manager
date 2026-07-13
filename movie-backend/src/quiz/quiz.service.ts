import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DailyMovieQuiz, QuizLanguage } from './daily-movie-quiz.entity';
import { QuizMoviePool } from './quiz-movie-pool.entity';
import { QuizAttempt, QuizDifficulty } from './quiz-attempt.entity';
import { QUIZ_DIFFICULTY_CONFIG } from './quiz-difficulty';
import { QuizHintsService } from './quiz-hints.service';
import { UsersService } from '../users/users.service';

const POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface QuizAnswer {
  title: string;
  releaseYear: number | null;
  posterUrl: string | null;
  tmdbId: number;
}

export interface QuizStreak {
  current: number;
  best: number;
}

export interface QuizStateDto {
  date: string;
  difficulty: QuizDifficulty;
  maxAttempts: number;
  hints: string[];
  guesses: string[];
  attemptsLeft: number;
  isSolved: boolean;
  isFailed: boolean;
  /** Poster of today's movie, always present — the client blurs it and
   * reduces the blur as hints get revealed. Showing it doesn't leak the
   * answer (title/tmdbId), which stay hidden in `answer` until done. */
  posterUrl: string | null;
  streak: QuizStreak;
  answer?: QuizAnswer;
}

export type QuizFriendStatus = 'solved' | 'failed' | 'not_played';

export interface QuizFriendStateDto {
  id: number;
  username: string;
  avatarUrl: string | null;
  status: QuizFriendStatus;
  guessCount: number;
}

@Injectable()
export class QuizService {
  private readonly logger = new Logger(QuizService.name);

  constructor(
    @InjectRepository(DailyMovieQuiz)
    private readonly dailyQuizRepo: Repository<DailyMovieQuiz>,
    @InjectRepository(QuizMoviePool)
    private readonly poolRepo: Repository<QuizMoviePool>,
    @InjectRepository(QuizAttempt)
    private readonly attemptRepo: Repository<QuizAttempt>,
    private readonly quizHintsService: QuizHintsService,
    private readonly usersService: UsersService,
  ) {}

  async getToday(
    userId: number,
    requestedDifficulty: QuizDifficulty,
    lang: QuizLanguage,
  ): Promise<QuizStateDto> {
    const quiz = await this.getOrCreateTodayQuiz();
    const attempt = await this.attemptRepo.findOne({
      where: { userId, quizDate: quiz.date },
    });
    // Once the player has made a guess today, the difficulty they started
    // with is locked in — otherwise they could switch tabs mid-game to
    // reveal extra hints or attempts for free.
    const difficulty = attempt?.difficulty ?? requestedDifficulty;
    const streak = await this.getStreak(userId);
    return this.buildState(quiz, difficulty, attempt, lang, streak);
  }

  async submitGuess(
    userId: number,
    requestedDifficulty: QuizDifficulty,
    guessTitle: string,
    guessTmdbId: number,
    lang: QuizLanguage,
  ): Promise<QuizStateDto & { correct: boolean }> {
    const quiz = await this.getOrCreateTodayQuiz();

    let attempt = await this.attemptRepo.findOne({
      where: { userId, quizDate: quiz.date },
    });
    if (attempt && (attempt.isSolved || attempt.isFailed)) {
      throw new BadRequestException("Today's quiz is already finished.");
    }
    const difficulty = attempt?.difficulty ?? requestedDifficulty;
    const config = QUIZ_DIFFICULTY_CONFIG[difficulty];
    if (!attempt) {
      attempt = this.attemptRepo.create({
        userId,
        quizDate: quiz.date,
        difficulty,
        guesses: [],
      });
    }
    if (attempt.guesses.length >= config.maxAttempts) {
      throw new BadRequestException('No attempts left for today.');
    }

    const isCorrect = guessTmdbId === quiz.pool.tmdbId;

    attempt.guesses = [...attempt.guesses, guessTitle];
    if (isCorrect) {
      attempt.isSolved = true;
      attempt.completedAt = new Date();
    } else if (attempt.guesses.length >= config.maxAttempts) {
      attempt.isFailed = true;
      attempt.completedAt = new Date();
    }
    await this.attemptRepo.save(attempt);

    const streak = await this.getStreak(userId);
    return {
      ...this.buildState(quiz, difficulty, attempt, lang, streak),
      correct: isCorrect,
    };
  }

  /** Current and best consecutive-day streaks of *solved* quizzes for a user. */
  async getStreak(userId: number): Promise<QuizStreak> {
    const rows = await this.attemptRepo.find({
      where: { userId, isSolved: true },
      select: ['quizDate'],
      order: { quizDate: 'ASC' },
    });
    const dates = rows.map((r) => r.quizDate);
    if (dates.length === 0) return { current: 0, best: 0 };

    let best = 1;
    let run = 1;
    for (let i = 1; i < dates.length; i++) {
      run = this.isNextCalendarDay(dates[i - 1], dates[i]) ? run + 1 : 1;
      best = Math.max(best, run);
    }

    const today = this.todayDateString();
    const yesterday = this.dateStringDaysAgo(1);
    const lastSolved = dates[dates.length - 1];
    const current = lastSolved === today || lastSolved === yesterday ? run : 0;

    return { current, best };
  }

  async getFriendsStatus(userId: number): Promise<QuizFriendStateDto[]> {
    const friends = await this.usersService.getFriends(userId);
    if (friends.length === 0) return [];

    const quiz = await this.getOrCreateTodayQuiz();
    const friendIds = friends.map((f) => f.id);
    const attempts = await this.attemptRepo.find({
      where: { userId: In(friendIds), quizDate: quiz.date },
    });
    const attemptByUserId = new Map(attempts.map((a) => [a.userId, a]));

    const result: QuizFriendStateDto[] = friends.map((friend) => {
      const attempt = attemptByUserId.get(friend.id);
      const status: QuizFriendStatus = attempt?.isSolved
        ? 'solved'
        : attempt?.isFailed
          ? 'failed'
          : 'not_played';
      return {
        id: friend.id,
        username: friend.username,
        avatarUrl: friend.avatarUrl,
        status,
        guessCount: attempt?.guesses.length ?? 0,
      };
    });

    const statusRank: Record<QuizFriendStatus, number> = {
      solved: 0,
      failed: 1,
      not_played: 2,
    };
    result.sort((a, b) => {
      const rankDiff = statusRank[a.status] - statusRank[b.status];
      if (rankDiff !== 0) return rankDiff;
      if (a.status === 'solved') return a.guessCount - b.guessCount;
      return 0;
    });

    return result;
  }

  /** userIds who have ever submitted a guess — the audience for "quiz updated" reminders. */
  async getEverPlayedUserIds(): Promise<number[]> {
    const rows = await this.attemptRepo
      .createQueryBuilder('a')
      .select('DISTINCT a."userId"', 'userId')
      .getRawMany<{ userId: number }>();
    return rows.map((r) => r.userId);
  }

  private buildState(
    quiz: DailyMovieQuiz,
    difficulty: QuizDifficulty,
    attempt: QuizAttempt | null,
    lang: QuizLanguage,
    streak: QuizStreak,
  ): QuizStateDto {
    const config = QUIZ_DIFFICULTY_CONFIG[difficulty];
    const hints = quiz.hints[lang] ?? quiz.hints.en ?? [];
    const guessCount = attempt?.guesses.length ?? 0;
    const isDone = !!attempt && (attempt.isSolved || attempt.isFailed);
    const revealedCount = isDone
      ? hints.length
      : Math.min(config.initialHints + guessCount, hints.length);

    return {
      date: quiz.date,
      difficulty,
      maxAttempts: config.maxAttempts,
      hints: hints.filter((h) => h.level <= revealedCount).map((h) => h.text),
      guesses: attempt?.guesses ?? [],
      attemptsLeft: Math.max(config.maxAttempts - guessCount, 0),
      isSolved: attempt?.isSolved ?? false,
      isFailed: attempt?.isFailed ?? false,
      posterUrl: this.buildPosterUrl(quiz.pool),
      streak,
      ...(isDone && { answer: this.buildAnswer(quiz.pool) }),
    };
  }

  private buildAnswer(pool: QuizMoviePool): QuizAnswer {
    return {
      title: pool.title,
      releaseYear: pool.releaseYear,
      posterUrl: this.buildPosterUrl(pool),
      tmdbId: pool.tmdbId,
    };
  }

  private buildPosterUrl(pool: QuizMoviePool): string | null {
    return pool.posterPath ? `${POSTER_BASE_URL}${pool.posterPath}` : null;
  }

  /** Idempotent: returns today's quiz, creating it (and claiming a pool movie) on first call of the day. */
  async getOrCreateTodayQuiz(): Promise<DailyMovieQuiz> {
    const today = this.todayDateString();
    const existing = await this.dailyQuizRepo.findOne({
      where: { date: today },
      relations: ['pool'],
    });
    if (existing) return existing;

    const pool = await this.claimNextPoolMovie();
    const hints = await this.quizHintsService.generateHints(pool);

    try {
      const quiz = this.dailyQuizRepo.create({
        date: today,
        poolId: pool.id,
        hints,
      });
      await this.dailyQuizRepo.save(quiz);
      quiz.pool = pool;
      return quiz;
    } catch (error: unknown) {
      // Unique violation on `date` means another process (e.g. concurrent
      // request racing the cron job) already created today's quiz first —
      // release the pool movie we claimed and reuse the existing quiz.
      const raceExisting = await this.dailyQuizRepo.findOne({
        where: { date: today },
        relations: ['pool'],
      });
      if (raceExisting) {
        await this.poolRepo.update(pool.id, { usedAt: null });
        return raceExisting;
      }
      throw error;
    }
  }

  private async claimNextPoolMovie(): Promise<QuizMoviePool> {
    return this.poolRepo.manager.transaction(async (manager) => {
      let pool = await manager
        .createQueryBuilder(QuizMoviePool, 'p')
        .where('p."usedAt" IS NULL')
        .orderBy('RANDOM()')
        .setLock('pessimistic_write')
        .getOne();

      if (!pool) {
        this.logger.log(
          'Quiz movie pool exhausted — starting a new rotation cycle.',
        );
        await manager
          .createQueryBuilder()
          .update(QuizMoviePool)
          .set({ usedAt: null })
          .execute();
        pool = await manager
          .createQueryBuilder(QuizMoviePool, 'p')
          .orderBy('RANDOM()')
          .setLock('pessimistic_write')
          .getOne();
      }

      if (!pool) {
        throw new InternalServerErrorException(
          'Quiz movie pool is empty — run the IMDb top-500 seed script first.',
        );
      }

      pool.usedAt = new Date();
      return manager.save(pool);
    });
  }

  private isNextCalendarDay(prev: string, next: string): boolean {
    const diff = Date.parse(next) - Date.parse(prev);
    return diff === MS_PER_DAY;
  }

  private dateStringDaysAgo(days: number): string {
    return new Date(Date.now() - days * MS_PER_DAY).toISOString().slice(0, 10);
  }

  private todayDateString(): string {
    return new Date().toISOString().slice(0, 10);
  }
}

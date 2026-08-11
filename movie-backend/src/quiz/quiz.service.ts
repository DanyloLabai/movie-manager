import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { firstValueFrom } from 'rxjs';
import sharp from 'sharp';
import { In, Repository } from 'typeorm';
import { DailyMovieQuiz, QuizLanguage } from './daily-movie-quiz.entity';
import { QuizMoviePool } from './quiz-movie-pool.entity';
import { QuizAttempt } from './quiz-attempt.entity';
import { QuizHintsService } from './quiz-hints.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/users.entity';
import { AchievementsService } from '../achievements/achievements.service';

const POSTER_BASE_URL = 'https://image.tmdb.org/t/p/w500';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const STARTING_SCORE = 100;
const TOTAL_HINTS = 5;
const FREE_HINTS = 1;
const HINT_COSTS = [10, 15, 20, 25];
const WRONG_GUESS_PENALTY = 5;
const MAX_GUESSES = 5;

/** Server-side blur applied to the poster while the quiz is unsolved, so the
 * sharp original never reaches the client — mirrors the hint-based easing
 * the UI shows (blur eases as hints unlock), but baked into the pixels. */
const MAX_BLUR_SIGMA = 28;
const MIN_BLUR_SIGMA = 9;
const POSTER_CACHE_TTL = 24 * 60 * 60 * 1000;

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
  score: number;
  hintsRevealed: number;
  nextHintCost: number | null;
  hints: string[];
  guesses: string[];
  guessesLeft: number;
  maxGuesses: number;
  isSolved: boolean;
  isFailed: boolean;
  /** Raw poster URL — null while the quiz is unsolved (fetch the
   * server-blurred version from GET /quiz/poster instead); populated once
   * `isDone`, alongside `answer`. */
  posterUrl: string | null;
  streak: QuizStreak;
  answer?: QuizAnswer;
}

export type QuizTodayStatus =
  | 'solved'
  | 'failed'
  | 'in_progress'
  | 'not_played';

export interface QuizLeaderboardEntryDto {
  id: number;
  username: string;
  avatarUrl: string | null;
  totalScore: number;
  rank: number;
  todayScore: number | null;
  todayStatus: QuizTodayStatus;
  isMe: boolean;
}

export interface QuizStatsDto {
  totalSolved: number;
  perfectSolves: number;
  currentStreak: number;
  bestStreak: number;
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
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly quizHintsService: QuizHintsService,
    private readonly usersService: UsersService,
    private readonly achievementsService: AchievementsService,
    private readonly httpService: HttpService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async getToday(userId: number, lang: QuizLanguage): Promise<QuizStateDto> {
    const quiz = await this.getOrCreateTodayQuiz();
    const attempt = await this.attemptRepo.findOne({
      where: { userId, quizDate: quiz.date },
    });
    const streak = await this.getStreak(userId);
    return this.buildState(quiz, attempt, lang, streak);
  }

  async buyHint(userId: number, lang: QuizLanguage): Promise<QuizStateDto> {
    const quiz = await this.getOrCreateTodayQuiz();
    const attempt = await this.getOrCreateAttempt(userId, quiz.date);

    if (attempt.isSolved || attempt.isFailed) {
      throw new BadRequestException("Today's quiz is already finished.");
    }
    if (attempt.hintsRevealed >= TOTAL_HINTS) {
      throw new BadRequestException('All hints are already revealed.');
    }

    const cost = HINT_COSTS[attempt.hintsRevealed - FREE_HINTS];
    attempt.hintsRevealed += 1;
    attempt.score = Math.max(attempt.score - cost, 0);
    await this.attemptRepo.save(attempt);

    const streak = await this.getStreak(userId);
    return this.buildState(quiz, attempt, lang, streak);
  }

  async submitGuess(
    userId: number,
    guessTitle: string,
    guessTmdbId: number,
    lang: QuizLanguage,
  ): Promise<QuizStateDto & { correct: boolean }> {
    const quiz = await this.getOrCreateTodayQuiz();
    const attempt = await this.getOrCreateAttempt(userId, quiz.date);

    if (attempt.isSolved || attempt.isFailed) {
      throw new BadRequestException("Today's quiz is already finished.");
    }
    if (attempt.guesses.length >= MAX_GUESSES) {
      throw new BadRequestException('No guesses left for today.');
    }

    const isCorrect = guessTmdbId === quiz.pool.tmdbId;
    attempt.guesses = [...attempt.guesses, guessTitle];

    if (isCorrect) {
      attempt.isSolved = true;
      attempt.completedAt = new Date();
    } else {
      attempt.score = Math.max(attempt.score - WRONG_GUESS_PENALTY, 0);
      if (attempt.guesses.length >= MAX_GUESSES) {
        attempt.isFailed = true;
        attempt.completedAt = new Date();
      }
    }
    await this.attemptRepo.save(attempt);

    if (isCorrect) {
      this.achievementsService
        .checkAndNotify(userId)
        .catch((err: unknown) =>
          this.logger.warn(
            `Achievement check failed for user ${userId}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          ),
        );
    }

    const streak = await this.getStreak(userId);
    return {
      ...this.buildState(quiz, attempt, lang, streak),
      correct: isCorrect,
    };
  }

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

  async getMyStats(userId: number): Promise<QuizStatsDto> {
    const solved = await this.attemptRepo.find({
      where: { userId, isSolved: true },
      select: ['score'],
    });
    const streak = await this.getStreak(userId);
    return {
      totalSolved: solved.length,
      perfectSolves: solved.filter((s) => s.score === STARTING_SCORE).length,
      currentStreak: streak.current,
      bestStreak: streak.best,
    };
  }

  async getFriendsLeaderboard(
    userId: number,
  ): Promise<QuizLeaderboardEntryDto[]> {
    const [friends, self] = await Promise.all([
      this.usersService.getFriends(userId),
      this.userRepo.findOne({
        where: { id: userId },
        select: ['id', 'username', 'avatarUrl'],
      }),
    ]);
    if (!self) return [];

    const people = [self, ...friends];
    const userIds = people.map((p) => p.id);
    const quiz = await this.getOrCreateTodayQuiz();

    const [totals, todayAttempts] = await Promise.all([
      this.attemptRepo
        .createQueryBuilder('a')
        .select('a."userId"', 'userId')
        .addSelect('COALESCE(SUM(a.score), 0)', 'totalScore')
        .where('a."userId" IN (:...userIds)', { userIds })
        .andWhere('a."isSolved" = true')
        .groupBy('a."userId"')
        .getRawMany<{ userId: number; totalScore: string }>(),
      this.attemptRepo.find({
        where: { userId: In(userIds), quizDate: quiz.date },
      }),
    ]);

    const totalsMap = new Map(
      totals.map((t) => [t.userId, Number(t.totalScore)]),
    );
    const todayMap = new Map(todayAttempts.map((a) => [a.userId, a]));

    const entries: Omit<QuizLeaderboardEntryDto, 'rank'>[] = people.map((p) => {
      const todayAttempt = todayMap.get(p.id);
      const todayStatus: QuizTodayStatus = !todayAttempt
        ? 'not_played'
        : todayAttempt.isSolved
          ? 'solved'
          : todayAttempt.isFailed
            ? 'failed'
            : 'in_progress';
      return {
        id: p.id,
        username: p.username,
        avatarUrl: p.avatarUrl,
        totalScore: totalsMap.get(p.id) ?? 0,
        todayScore: todayAttempt?.isSolved ? todayAttempt.score : null,
        todayStatus,
        isMe: p.id === userId,
      };
    });

    entries.sort((a, b) => b.totalScore - a.totalScore);
    return entries.map((e, i) => ({ ...e, rank: i + 1 }));
  }

  private async getOrCreateAttempt(
    userId: number,
    quizDate: string,
  ): Promise<QuizAttempt> {
    const existing = await this.attemptRepo.findOne({
      where: { userId, quizDate },
    });
    if (existing) return existing;

    return this.attemptRepo.save(
      this.attemptRepo.create({
        userId,
        quizDate,
        guesses: [],
        hintsRevealed: FREE_HINTS,
        score: STARTING_SCORE,
      }),
    );
  }

  private buildState(
    quiz: DailyMovieQuiz,
    attempt: QuizAttempt | null,
    lang: QuizLanguage,
    streak: QuizStreak,
  ): QuizStateDto {
    const allHints = quiz.hints[lang] ?? quiz.hints.en ?? [];
    const hintsRevealed = attempt?.hintsRevealed ?? FREE_HINTS;
    const guessCount = attempt?.guesses.length ?? 0;
    const isDone = !!attempt && (attempt.isSolved || attempt.isFailed);
    const revealedCount = isDone ? allHints.length : hintsRevealed;

    return {
      date: quiz.date,
      score: attempt?.score ?? STARTING_SCORE,
      hintsRevealed,
      nextHintCost:
        isDone || hintsRevealed >= TOTAL_HINTS
          ? null
          : HINT_COSTS[hintsRevealed - FREE_HINTS],
      hints: allHints
        .filter((h) => h.level <= revealedCount)
        .map((h) => h.text),
      guesses: attempt?.guesses ?? [],
      guessesLeft: Math.max(MAX_GUESSES - guessCount, 0),
      maxGuesses: MAX_GUESSES,
      isSolved: attempt?.isSolved ?? false,
      isFailed: attempt?.isFailed ?? false,
      // Raw poster URL only once the quiz is done — otherwise it would leak
      // the sharp original via the JSON payload, bypassing GET /quiz/poster.
      posterUrl: isDone ? this.buildPosterUrl(quiz.pool) : null,
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

  /** Serves today's poster pre-blurred server-side so the sharp original
   * never reaches the client until the quiz is solved/failed — CSS-only
   * blur can be undone by opening the raw image URL from devtools. */
  async getPosterImage(
    userId: number,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const quiz = await this.getOrCreateTodayQuiz();
    const attempt = await this.attemptRepo.findOne({
      where: { userId, quizDate: quiz.date },
    });
    const isDone = !!attempt && (attempt.isSolved || attempt.isFailed);
    const hintsRevealed = attempt?.hintsRevealed ?? FREE_HINTS;
    const sigma = isDone
      ? 0
      : Math.max(
          MAX_BLUR_SIGMA * (1 - hintsRevealed / TOTAL_HINTS),
          MIN_BLUR_SIGMA,
        );

    return this.fetchBlurredPoster(quiz.pool, sigma);
  }

  private async fetchBlurredPoster(
    pool: QuizMoviePool,
    sigma: number,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    if (!pool.posterPath) {
      throw new NotFoundException('No poster available for this quiz.');
    }

    const contentType = 'image/jpeg';
    const cacheKey = `quiz_poster_v1:${pool.tmdbId}:${sigma}`;
    const cached = await this.cacheManager.get<string>(cacheKey);
    if (cached) {
      return { buffer: Buffer.from(cached, 'base64'), contentType };
    }

    const { data } = await firstValueFrom(
      this.httpService.get<ArrayBuffer>(
        `${POSTER_BASE_URL}${pool.posterPath}`,
        { responseType: 'arraybuffer' },
      ),
    );

    const processed = await (
      sigma > 0
        ? sharp(Buffer.from(data)).blur(sigma)
        : sharp(Buffer.from(data))
    )
      .jpeg({ quality: 70 })
      .toBuffer();

    await this.cacheManager.set(
      cacheKey,
      processed.toString('base64'),
      POSTER_CACHE_TTL,
    );

    return { buffer: processed, contentType };
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
        .limit(1)
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
          .limit(1)
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

  async getEverPlayedUserIds(): Promise<number[]> {
    const rows = await this.attemptRepo
      .createQueryBuilder('a')
      .select('DISTINCT a."userId"', 'userId')
      .getRawMany<{ userId: number }>();
    return rows.map((r) => r.userId);
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

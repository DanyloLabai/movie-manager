import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { QuizService } from './quiz.service';
import { isQuizDifficulty } from './quiz-difficulty';
import { QuizDifficulty } from './quiz-attempt.entity';
import { QuizLanguage } from './daily-movie-quiz.entity';

interface RequestWithUser extends Request {
  user: {
    userId: number;
    username: string;
  };
}

const DEFAULT_DIFFICULTY: QuizDifficulty = 'normal';
const DEFAULT_LANGUAGE: QuizLanguage = 'en';

const resolveLanguage = (value?: string): QuizLanguage =>
  value === 'en' || value === 'uk' ? value : DEFAULT_LANGUAGE;

@ApiTags('Quiz')
@Controller('api/quiz')
export class QuizController {
  constructor(private readonly quizService: QuizService) {}

  @Get('today')
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Get today's movie quiz",
    description:
      "Returns today's quiz state (hints revealed so far, guesses, attempts left) for the given difficulty.",
  })
  @ApiQuery({ name: 'difficulty', required: false, enum: ['easy', 'normal', 'hard'] })
  @ApiQuery({ name: 'lang', required: false, enum: ['en', 'uk'] })
  @ApiResponse({ status: 200, description: "Today's quiz state" })
  async getToday(
    @Req() req: RequestWithUser,
    @Query('difficulty') difficulty?: string,
    @Query('lang') lang?: string,
  ) {
    const resolvedDifficulty = isQuizDifficulty(difficulty)
      ? difficulty
      : DEFAULT_DIFFICULTY;
    return this.quizService.getToday(
      req.user.userId,
      resolvedDifficulty,
      resolveLanguage(lang),
    );
  }

  @Post('guess')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Submit a guess for today\'s movie quiz',
  })
  @ApiResponse({ status: 200, description: 'Updated quiz state' })
  async guess(
    @Req() req: RequestWithUser,
    @Body()
    body: { difficulty?: string; title: string; tmdbId: number; lang?: string },
  ) {
    const resolvedDifficulty = isQuizDifficulty(body.difficulty)
      ? body.difficulty
      : DEFAULT_DIFFICULTY;
    return this.quizService.submitGuess(
      req.user.userId,
      resolvedDifficulty,
      body.title,
      body.tmdbId,
      resolveLanguage(body.lang),
    );
  }

  @Get('friends-status')
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Get friends' status on today's quiz",
    description:
      "For each friend, whether they've solved today's quiz, failed it, or haven't played yet.",
  })
  @ApiResponse({ status: 200, description: "Friends' quiz status" })
  async getFriendsStatus(@Req() req: RequestWithUser) {
    return this.quizService.getFriendsStatus(req.user.userId);
  }
}

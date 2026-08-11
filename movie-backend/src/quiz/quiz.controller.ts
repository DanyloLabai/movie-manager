import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { QuizService } from './quiz.service';
import { QuizLanguage } from './daily-movie-quiz.entity';

interface RequestWithUser extends Request {
  user: {
    userId: number;
    username: string;
  };
}

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
      "Returns today's quiz state — current score, hints revealed so far, guesses left.",
  })
  @ApiQuery({ name: 'lang', required: false, enum: ['en', 'uk'] })
  @ApiResponse({ status: 200, description: "Today's quiz state" })
  async getToday(@Req() req: RequestWithUser, @Query('lang') lang?: string) {
    return this.quizService.getToday(req.user.userId, resolveLanguage(lang));
  }

  @Post('hint')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Buy the next hint',
    description:
      "Reveals today's next hint, deducting its cost from the score.",
  })
  @ApiResponse({ status: 200, description: 'Updated quiz state' })
  async buyHint(@Req() req: RequestWithUser, @Body() body: { lang?: string }) {
    return this.quizService.buyHint(
      req.user.userId,
      resolveLanguage(body?.lang),
    );
  }

  @Post('guess')
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Submit a guess for today's movie quiz",
  })
  @ApiResponse({ status: 200, description: 'Updated quiz state' })
  async guess(
    @Req() req: RequestWithUser,
    @Body() body: { title: string; tmdbId: number; lang?: string },
  ) {
    return this.quizService.submitGuess(
      req.user.userId,
      body.title,
      body.tmdbId,
      resolveLanguage(body.lang),
    );
  }

  @Get('friends-leaderboard')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get the quiz leaderboard among you and your friends',
    description:
      "Ranks you and your friends by total lifetime quiz score, plus each of your statuses on today's quiz.",
  })
  @ApiResponse({ status: 200, description: 'Leaderboard entries' })
  async getFriendsLeaderboard(@Req() req: RequestWithUser) {
    return this.quizService.getFriendsLeaderboard(req.user.userId);
  }

  @Get('my-stats')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get your own lifetime quiz stats',
    description: 'Used to drive quiz-related achievements.',
  })
  @ApiResponse({ status: 200, description: 'Quiz stats' })
  async getMyStats(@Req() req: RequestWithUser) {
    return this.quizService.getMyStats(req.user.userId);
  }
}

import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request } from 'express';
import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';

interface RequestWithUser extends Request {
  user: { userId: number };
}

@ApiTags('Feedback')
@Controller('api/feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 600000 } })
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Submit app feedback',
    description:
      'Records a star rating (1-5) and optional comment, and emails admins a notification (requires authentication)',
  })
  @ApiResponse({ status: 201, description: 'Feedback recorded' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(@Req() req: RequestWithUser, @Body() dto: CreateFeedbackDto) {
    return this.feedbackService.create(req.user.userId, dto);
  }

  @Get('mine')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Check whether the current user has already submitted feedback',
    description:
      'Server-authoritative check so the feedback prompt stays suppressed across devices/browsers, not just in local storage (requires authentication)',
  })
  @ApiResponse({ status: 200, description: 'Submission status' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async mine(@Req() req: RequestWithUser) {
    const hasSubmitted = await this.feedbackService.hasSubmitted(
      req.user.userId,
    );
    return { hasSubmitted };
  }
}

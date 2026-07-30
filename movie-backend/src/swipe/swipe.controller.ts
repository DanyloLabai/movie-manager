import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request } from 'express';
import { SwipeService } from './swipe.service';
import { SwipeActionDto } from './dto/swipe-action.dto';
import { SwipeFeedResponseDto } from './dto/swipe-card.dto';

interface RequestWithUser extends Request {
  user: { userId: number; username: string };
}

@ApiTags('Swipe Discovery')
@Controller('api/swipe')
export class SwipeController {
  constructor(private readonly swipeService: SwipeService) {}

  @Get('status')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get swipe feed status',
    description:
      "Cheap check of the user's remaining daily allotment and whether the search-page promo should show, without generating a feed batch (requires authentication)",
  })
  @ApiResponse({ status: 200, description: 'Swipe status' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getStatus(@Req() req: RequestWithUser) {
    return this.swipeService.getStatus(req.user.userId);
  }

  @Get('feed')
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Get today's swipe discovery feed",
    description:
      "Returns the user's remaining daily allotment of personalized + diverse movie picks (requires authentication)",
  })
  @ApiResponse({
    status: 200,
    description: 'Swipe feed batch',
    type: SwipeFeedResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getFeed(@Req() req: RequestWithUser) {
    return this.swipeService.getFeed(req.user.userId);
  }

  @Post()
  @Throttle({ default: { limit: 200, ttl: 60000 } })
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Record a swipe action',
    description:
      'Records watched/watchlist/skip for a card in the swipe feed (requires authentication)',
  })
  @ApiResponse({ status: 201, description: 'Action recorded' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async recordAction(@Req() req: RequestWithUser, @Body() dto: SwipeActionDto) {
    return this.swipeService.recordAction(req.user.userId, dto);
  }
}

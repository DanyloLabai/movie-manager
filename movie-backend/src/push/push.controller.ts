import { Body, Controller, Delete, Get, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PushService } from './push.service';

interface RequestWithUser extends Request {
  user: {
    userId: number;
    username: string;
  };
}

@ApiTags('Push')
@Controller('api/push')
export class PushController {
  constructor(private pushService: PushService) {}

  @Get('public-key')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the VAPID public key for push subscription' })
  @ApiResponse({ status: 200, description: 'VAPID public key' })
  getPublicKey() {
    return { publicKey: this.pushService.getPublicKey() };
  }

  @Post('subscribe')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Register a push subscription for the current user',
  })
  @ApiResponse({ status: 201, description: 'Subscription saved' })
  async subscribe(
    @Req() req: RequestWithUser,
    @Body()
    body: {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    },
  ) {
    const userId = req.user.userId;
    await this.pushService.saveSubscription(
      userId,
      body.endpoint,
      body.keys.p256dh,
      body.keys.auth,
    );
    return { message: 'Subscribed' };
  }

  @Delete('subscribe')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove a push subscription for the current user' })
  @ApiResponse({ status: 200, description: 'Subscription removed' })
  async unsubscribe(
    @Req() req: RequestWithUser,
    @Body() body: { endpoint: string },
  ) {
    const userId = req.user.userId;
    return this.pushService.removeSubscription(userId, body.endpoint);
  }
}

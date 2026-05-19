import {
  Controller,
  Patch,
  Body,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Req,
  Get,
  Param,
  Post,
  ParseIntPipe,
  Delete,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('Users')
@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('profile')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(FileInterceptor('avatar'))
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Update user profile',
    description: 'Update username and avatar (requires authentication)',
  })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateProfile(
    @Req() req,
    @Body('username') newUsername: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const userId = req.user.userId;
    return this.usersService.updateUserProfile(userId, newUsername, file);
  }

  @Get('public/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get public profile',
    description: 'Get public profile of another user (requires authentication)',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'User public profile' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getPublicProfile(
    @Req() req,
    @Param('id', ParseIntPipe) targetUserId: number,
  ) {
    const currentUserId = req.user.userId;
    return this.usersService.getPublicProfile(targetUserId, currentUserId);
  }

  @Get('friends')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get friends list',
    description: 'Get user friends list (requires authentication)',
  })
  @ApiResponse({ status: 200, description: 'List of user friends' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getFriends(@Req() req) {
    const userId = req.user.userId;
    return this.usersService.getFriends(userId);
  }

  @Post('friends/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Add friend',
    description: 'Add another user as friend (requires authentication)',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Friend user ID' })
  @ApiResponse({ status: 201, description: 'Friend added successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async addFriend(@Req() req, @Param('id', ParseIntPipe) friendId: number) {
    const currentUserId = req.user.userId;
    return this.usersService.addFriend(currentUserId, friendId);
  }

  @Delete('friends/:id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Remove friend',
    description: 'Remove a friend (requires authentication)',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Friend user ID' })
  @ApiResponse({ status: 200, description: 'Friend removed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async removeFriend(@Req() req, @Param('id', ParseIntPipe) friendId: number) {
    const currentUserId = req.user.userId;
    return this.usersService.removeFriend(currentUserId, friendId);
  }
}

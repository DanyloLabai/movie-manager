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
import { UsersService } from './users.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('profile')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(FileInterceptor('avatar'))
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
  async getPublicProfile(
    @Req() req,
    @Param('id', ParseIntPipe) targetUserId: number,
  ) {
    const currentUserId = req.user.userId;
    return this.usersService.getPublicProfile(targetUserId, currentUserId);
  }

  @Get('friends')
  @UseGuards(AuthGuard('jwt'))
  async getFriends(@Req() req) {
    const userId = req.user.userId;
    return this.usersService.getFriends(userId);
  }

  @Post('friends/:id')
  @UseGuards(AuthGuard('jwt'))
  async addFriend(@Req() req, @Param('id', ParseIntPipe) friendId: number) {
    const currentUserId = req.user.userId;
    return this.usersService.addFriend(currentUserId, friendId);
  }
  @Delete('friends/:id')
  @UseGuards(AuthGuard('jwt'))
  async removeFriend(@Req() req, @Param('id', ParseIntPipe) friendId: number) {
    const currentUserId = req.user.userId;
    return this.usersService.removeFriend(currentUserId, friendId);
  }
}

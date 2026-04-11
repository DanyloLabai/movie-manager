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

  @Get('public/profile/:username')
  async getPublicProfile(@Param('username') username: string) {
    return this.usersService.getPublicProfile(username);
  }
}

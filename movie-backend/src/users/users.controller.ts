import {
  Controller,
  Patch,
  Body,
  UseInterceptors,
  UploadedFile,
  Req,
  Get,
  Param,
  Post,
  ParseIntPipe,
  Delete,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiConsumes,
} from '@nestjs/swagger';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('api/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('profile')
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

  @Delete('me')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete account',
    description:
      'Permanently delete the current user account and all associated data (requires authentication)',
  })
  @ApiResponse({ status: 200, description: 'Account deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteAccount(@Req() req) {
    const userId = req.user.userId;
    return this.usersService.deleteAccount(userId);
  }

  @Get('public/:id')
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

  @Get('public/:id/compatibility')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get taste compatibility with another user',
    description:
      'Compute movie-taste compatibility score based on shared favorite/highly-rated movies (requires authentication)',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'User ID' })
  @ApiResponse({ status: 200, description: 'Taste compatibility data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getTasteCompatibility(
    @Req() req,
    @Param('id', ParseIntPipe) targetUserId: number,
  ) {
    const currentUserId = req.user.userId;
    return this.usersService.getTasteCompatibility(currentUserId, targetUserId);
  }

  @Get('search')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Search users by username',
    description: 'Search other users by username (requires authentication)',
  })
  @ApiQuery({ name: 'query', required: true, description: 'Username query' })
  @ApiResponse({ status: 200, description: 'Matching users' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async searchUsers(@Req() req, @Query('query') query: string) {
    const currentUserId = req.user.userId;
    return this.usersService.searchUsers(currentUserId, query);
  }

  @Get('friends')
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

  @Get('friends/feed')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get friends activity feed',
    description:
      'Get a chronological feed of friends watchlist activity (requires authentication)',
  })
  @ApiQuery({
    name: 'before',
    required: false,
    description: 'ISO timestamp cursor to fetch older entries',
  })
  @ApiResponse({ status: 200, description: 'Friends activity feed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getFriendsFeed(@Req() req, @Query('before') before?: string) {
    const userId = req.user.userId;
    return this.usersService.getFriendsFeed(
      userId,
      before ? new Date(before) : undefined,
    );
  }

  @Get('friends/last-watched')
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Get each friend's most recently watched movie",
    description:
      'For each friend, returns the movie/show they most recently marked as watched, along with their rating (requires authentication)',
  })
  @ApiResponse({ status: 200, description: "Friends' last-watched movies" })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getFriendsLastWatched(@Req() req) {
    const userId = req.user.userId;
    return this.usersService.getFriendsLastWatched(userId);
  }

  @Post('friends/:id')
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

  @Get('friend-requests')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get incoming friend requests',
    description:
      'Get pending friend requests sent to the current user (requires authentication)',
  })
  @ApiResponse({ status: 200, description: 'List of pending friend requests' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getFriendRequests(@Req() req) {
    const userId = req.user.userId;
    return this.usersService.getFriendRequests(userId);
  }

  @Post('friend-requests/:id/accept')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Accept a friend request',
    description:
      'Accept a pending incoming friend request (requires authentication)',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Friend request ID' })
  @ApiResponse({ status: 201, description: 'Friend request accepted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Friend request not found' })
  async acceptFriendRequest(
    @Req() req,
    @Param('id', ParseIntPipe) requestId: number,
  ) {
    const userId = req.user.userId;
    return this.usersService.acceptFriendRequest(userId, requestId);
  }

  @Post('friend-requests/:id/decline')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Decline a friend request',
    description:
      'Decline a pending incoming friend request (requires authentication)',
  })
  @ApiParam({ name: 'id', type: 'number', description: 'Friend request ID' })
  @ApiResponse({ status: 201, description: 'Friend request declined' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Friend request not found' })
  async declineFriendRequest(
    @Req() req,
    @Param('id', ParseIntPipe) requestId: number,
  ) {
    const userId = req.user.userId;
    return this.usersService.declineFriendRequest(userId, requestId);
  }

  @Get('me/activity')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get activity heatmap',
    description:
      "Get the current user's daily activity counts (and the movies behind them) for a given year, for the contribution heatmap (requires authentication)",
  })
  @ApiQuery({
    name: 'year',
    required: false,
    description: 'Calendar year to fetch (defaults to the current year)',
  })
  @ApiResponse({ status: 200, description: 'Daily activity buckets' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyActivity(@Req() req, @Query('year') year?: string) {
    const userId = req.user.userId;
    const parsedYear = year ? parseInt(year, 10) : new Date().getFullYear();
    return this.usersService.getActivityHeatmap(userId, parsedYear);
  }

  @Get('me/search-history')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get recent search history',
    description:
      "Get the current user's most recent distinct search queries, for quick re-search chips (requires authentication)",
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Max number of queries to return (defaults to 10)',
  })
  @ApiResponse({ status: 200, description: 'Recent search queries' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMySearchHistory(@Req() req, @Query('limit') limit?: string) {
    const userId = req.user.userId;
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    return this.usersService.getSearchHistory(userId, parsedLimit);
  }

  @Delete('me/search-history')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Clear search history',
    description:
      "Delete all of the current user's recent search queries (requires authentication)",
  })
  @ApiResponse({ status: 200, description: 'Search history cleared' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async clearMySearchHistory(@Req() req) {
    const userId = req.user.userId;
    return this.usersService.clearSearchHistory(userId);
  }

  @Delete('friends/:id')
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

import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Not, Repository } from 'typeorm';
import { User } from './users.entity';
import { FriendRequest } from './friend-request.entity';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import * as streamifier from 'streamifier';
import 'multer';
import { MoviesService } from 'src/movies/movies.service';
import { CloudinaryUploadResponseDto } from './dto/cloudinary-upload-response.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { FriendDto } from './dto/friend.dto';
import { DatabaseErrorDto } from './dto/database-error.dto';
import { ActivityService } from 'src/activity/activity.service';
import { VectorService } from 'src/vector/vector.service';
import { PushService } from 'src/push/push.service';

@Injectable()
export class UsersService {
  constructor(
    private configService: ConfigService,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(FriendRequest)
    private friendRequestRepository: Repository<FriendRequest>,
    private moviesService: MoviesService,
    private activityService: ActivityService,
    private vectorService: VectorService,
    private pushService: PushService,
  ) {
    cloudinary.config({
      cloud_name: this.configService.get<string>('CLOUDINARY_CLOUD_NAME'),
      api_key: this.configService.get<string>('CLOUDINARY_API_KEY'),
      api_secret: this.configService.get<string>('CLOUDINARY_API_SECRET'),
    });
  }

  async updateUserProfile(
    userId: number,
    newUsername: string,
    file?: Express.Multer.File,
  ): Promise<UpdateUserProfileDto> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (newUsername) {
      const trimmed = newUsername.trim();
      if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
        throw new BadRequestException(
          'Username can only contain letters, numbers, and underscores.',
        );
      }
      if (trimmed.toLowerCase() !== user.username.toLowerCase()) {
        const existing = await this.usersRepository.findOne({
          where: { username: trimmed },
        });
        if (existing && existing.id !== userId) {
          throw new ConflictException('That username is already taken!');
        }
        user.username = trimmed;
      }
    }
    if (file) {
      const cloudinaryResult = await this.uploadImage(file);
      user.avatarUrl = cloudinaryResult.secure_url;
    }

    try {
      await this.usersRepository.save(user);
    } catch (error: unknown) {
      const dbError = error as DatabaseErrorDto;
      if (dbError.code === '23505') {
        throw new ConflictException(
          'That username is already taken by another user!',
        );
      }
      throw error;
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
    };
  }

  uploadImage(file: Express.Multer.File): Promise<CloudinaryUploadResponseDto> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'movie-tracker-avatars',
          transformation: [
            { width: 400, height: 400, crop: 'fill', gravity: 'face' },
          ],
        },
        (error, result) => {
          if (error) return reject(error);
          if (!result) return reject(new Error('Cloudinary upload failed'));
          resolve(result as unknown as CloudinaryUploadResponseDto);
        },
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  async removeFriend(currentUserId: number, friendId: number) {
    const currentUser = await this.usersRepository.findOne({
      where: { id: currentUserId },
      relations: ['friends'],
    });

    const friendToRemove = await this.usersRepository.findOne({
      where: { id: friendId },
      relations: ['friends'],
    });

    if (!currentUser || !friendToRemove) {
      throw new NotFoundException('User not found');
    }

    currentUser.friends = (currentUser.friends || []).filter(
      (f) => f.id !== friendId,
    );
    friendToRemove.friends = (friendToRemove.friends || []).filter(
      (f) => f.id !== currentUserId,
    );

    await this.usersRepository.save([currentUser, friendToRemove]);

    return { message: 'Friend removed successfully' };
  }

  async getPublicProfile(targetUserId: number, currentUserId: number) {
    const user = await this.usersRepository.findOne({
      where: { id: targetUserId },
      relations: ['friends'],
    });

    if (!user) {
      throw new NotFoundException('Profile not found');
    }

    const profileStats = await this.moviesService.getProfileData(user.id);

    const isFriend =
      user.friends?.some((friend) => friend.id === currentUserId) || false;

    return {
      ...profileStats,
      isFriend,
    };
  }

  private async makeFriends(userA: User, userB: User): Promise<void> {
    const [freshA, freshB] = await Promise.all([
      this.usersRepository.findOne({
        where: { id: userA.id },
        relations: ['friends'],
      }),
      this.usersRepository.findOne({
        where: { id: userB.id },
        relations: ['friends'],
      }),
    ]);
    if (!freshA || !freshB) return;

    if (!freshA.friends.some((f) => f.id === freshB.id)) {
      freshA.friends.push(freshB);
    }
    if (!freshB.friends.some((f) => f.id === freshA.id)) {
      freshB.friends.push(freshA);
    }
    await this.usersRepository.save([freshA, freshB]);
  }

  async addFriend(currentUserId: number, friendId: number) {
    if (currentUserId === friendId) {
      throw new BadRequestException('You cannot add yourself as a friend');
    }

    const currentUser = await this.usersRepository.findOne({
      where: { id: currentUserId },
      relations: ['friends'],
    });

    const friendToAdd = await this.usersRepository.findOne({
      where: { id: friendId },
      relations: ['friends'],
    });

    if (!currentUser || !friendToAdd) {
      throw new NotFoundException('User not found');
    }

    const alreadyFriends = (currentUser.friends || []).some(
      (f) => f.id === friendId,
    );
    if (alreadyFriends) {
      throw new BadRequestException('You are already friends');
    }

    // If the other person already sent us a request, accept it instead of
    // creating a duplicate — this is a mutual match.
    const incoming = await this.friendRequestRepository.findOne({
      where: { fromUser: { id: friendId }, toUser: { id: currentUserId } },
    });
    if (incoming) {
      await this.makeFriends(currentUser, friendToAdd);
      await this.friendRequestRepository.remove(incoming);

      this.pushService
        .sendToUser(friendId, {
          title: 'Friend request accepted',
          body: `${currentUser.username} accepted your friend request`,
          url: '/watchlist',
        })
        .catch(() => {});

      return { message: 'Friend added successfully', status: 'accepted' };
    }

    const alreadySent = await this.friendRequestRepository.findOne({
      where: { fromUser: { id: currentUserId }, toUser: { id: friendId } },
    });
    if (alreadySent) {
      throw new BadRequestException('Friend request already sent');
    }

    const request = this.friendRequestRepository.create({
      fromUser: currentUser,
      toUser: friendToAdd,
    });
    await this.friendRequestRepository.save(request);

    this.pushService
      .sendToUser(friendId, {
        title: 'New friend request',
        body: `${currentUser.username} wants to be your friend`,
        url: '/notifications',
      })
      .catch(() => {});

    return { message: 'Friend request sent', status: 'pending' };
  }

  async getFriendRequests(userId: number) {
    const requests = await this.friendRequestRepository.find({
      where: { toUser: { id: userId } },
      relations: ['fromUser'],
      order: { createdAt: 'DESC' },
    });

    return requests.map((req) => ({
      id: req.id,
      createdAt: req.createdAt,
      fromUser: {
        id: req.fromUser.id,
        username: req.fromUser.username,
        avatarUrl: req.fromUser.avatarUrl,
      },
    }));
  }

  async acceptFriendRequest(userId: number, requestId: number) {
    const request = await this.friendRequestRepository.findOne({
      where: { id: requestId, toUser: { id: userId } },
      relations: ['fromUser', 'toUser'],
    });
    if (!request) {
      throw new NotFoundException('Friend request not found');
    }

    await this.makeFriends(request.toUser, request.fromUser);
    await this.friendRequestRepository.remove(request);

    this.pushService
      .sendToUser(request.fromUser.id, {
        title: 'Friend request accepted',
        body: `${request.toUser.username} accepted your friend request`,
        url: '/watchlist',
      })
      .catch(() => {});

    return { message: 'Friend request accepted' };
  }

  async declineFriendRequest(userId: number, requestId: number) {
    const request = await this.friendRequestRepository.findOne({
      where: { id: requestId, toUser: { id: userId } },
    });
    if (!request) {
      throw new NotFoundException('Friend request not found');
    }

    await this.friendRequestRepository.remove(request);

    return { message: 'Friend request declined' };
  }

  async searchUsers(currentUserId: number, query: string) {
    const trimmed = (query || '').trim();
    if (trimmed.length < 2) return [];

    const users = await this.usersRepository.find({
      where: {
        username: ILike(`%${trimmed}%`),
        id: Not(currentUserId),
      },
      relations: ['friends'],
      take: 20,
    });

    const sentRequests = await this.friendRequestRepository.find({
      where: { fromUser: { id: currentUserId } },
      relations: ['toUser'],
    });
    const pendingIds = new Set(sentRequests.map((r) => r.toUser.id));

    return users.map((u) => ({
      id: u.id,
      username: u.username,
      avatarUrl: u.avatarUrl,
      isFriend: u.friends?.some((f) => f.id === currentUserId) || false,
      requestPending: pendingIds.has(u.id),
    }));
  }

  async getFriends(userId: number) {
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      relations: ['friends'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const friends = user.friends || [];

    return friends.map((friend) => ({
      id: friend.id,
      username: friend.username,
      avatarUrl: friend.avatarUrl,
    }));
  }

  async getFriendsFeed(userId: number, before?: Date) {
    return this.activityService.getFriendsFeed(userId, before);
  }

  async getTasteCompatibility(currentUserId: number, targetUserId: number) {
    const [tasteIdsA, tasteIdsB, watchedA, watchedB] = await Promise.all([
      this.moviesService.getTasteSourceTmdbIds(currentUserId),
      this.moviesService.getTasteSourceTmdbIds(targetUserId),
      this.moviesService.getWatchedMovies(currentUserId),
      this.moviesService.getWatchedMovies(targetUserId),
    ]);

    const score = await this.vectorService.computeTasteCompatibility(
      tasteIdsA,
      tasteIdsB,
    );

    const watchedIdsB = new Set(watchedB.map((item) => item.tmdbId));
    const commonWatched = watchedA
      .filter((item) => watchedIdsB.has(item.tmdbId))
      .map((item) => ({
        tmdbId: item.tmdbId,
        title: item.title,
        posterUrl: item.posterUrl,
        mediaType: item.mediaType,
      }));

    return {
      score,
      commonWatchedCount: commonWatched.length,
      commonWatched: commonWatched.slice(0, 10),
    };
  }

  async deleteAccount(userId: number): Promise<{ message: string }> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // The self-referential `friends` many-to-many join table doesn't cascade
    // on delete (TypeORM's @JoinTable FKs default to no action), so it has
    // to be cleared explicitly before removing the user row.
    await this.usersRepository.manager.query(
      `DELETE FROM user_friends WHERE "userId" = $1 OR "friendId" = $1`,
      [userId],
    );

    await this.usersRepository.remove(user);

    return { message: 'Account deleted successfully' };
  }
}

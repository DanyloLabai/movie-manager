import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Not, Repository } from 'typeorm';
import { User } from './users.entity';
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

@Injectable()
export class UsersService {
  constructor(
    private configService: ConfigService,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private moviesService: MoviesService,
    private activityService: ActivityService,
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

    if (!currentUser.friends) currentUser.friends = [];
    if (!friendToAdd.friends) friendToAdd.friends = [];

    const alreadyFriends = currentUser.friends.some((f) => f.id === friendId);
    if (alreadyFriends) {
      throw new BadRequestException('You are already friends');
    }

    currentUser.friends.push(friendToAdd);
    friendToAdd.friends.push(currentUser);

    await this.usersRepository.save([currentUser, friendToAdd]);

    return { message: 'Friend added successfully' };
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

    return users.map((u) => ({
      id: u.id,
      username: u.username,
      avatarUrl: u.avatarUrl,
      isFriend: u.friends?.some((f) => f.id === currentUserId) || false,
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
}

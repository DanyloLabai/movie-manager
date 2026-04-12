import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './users.entity';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import * as streamifier from 'streamifier';
import 'multer';
import { MoviesService } from 'src/movies/movies.service';

@Injectable()
export class UsersService {
  constructor(
    private configService: ConfigService,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private moviesService: MoviesService,
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
  ) {
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
    } catch (error: any) {
      if (error.code === '23505') {
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

  uploadImage(file: Express.Multer.File): Promise<any> {
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
          resolve(result);
        },
      );

      streamifier.createReadStream(file.buffer).pipe(uploadStream);
    });
  }

  async getPublicProfile(targetUserId: number, currentUserId: number) {
    const user = await this.usersRepository.findOne({
      where: { id: targetUserId },
      relations: ['friends'],
    });

    if (!user) {
      throw new NotFoundException('Profile not found');
    }

    // Це підтягне всі нові метрики: графіки, топ-актора, Completion Rate тощо
    const profileStats = await this.moviesService.getProfileData(user.id);

    const isFriend =
      user.friends?.some((friend) => friend.id === currentUserId) || false;

    return {
      id: user.id,
      username: user.username,
      avatarUrl: user.avatarUrl,
      isFriend: isFriend,
      ...profileStats, // Поширюємо статистику
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

    // Ініціалізуємо масиви, якщо вони раптом undefined
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
}

import {
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

@Injectable()
export class UsersService {
  constructor(
    private configService: ConfigService,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
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
      const trimmedUsername = newUsername.trim();

      if (trimmedUsername !== user.username) {
        let qb = this.usersRepository
          .createQueryBuilder('user')
          .where('LOWER(user.username) = LOWER(:username)', {
            username: trimmedUsername,
          })
          .andWhere('user.id != :id', { id: userId });

        if (typeof qb.withDeleted === 'function') {
          qb = qb.withDeleted();
        }

        const existingUser = await qb.getOne();

        if (existingUser) {
          throw new ConflictException(
            'This username is already taken by another user',
          );
        }

        user.username = trimmedUsername;
      }
    }

    if (file) {
      const cloudinaryResult = await this.uploadImage(file);
      user.avatarUrl = cloudinaryResult.secure_url;
    }

    await this.usersRepository.save(user);

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
}

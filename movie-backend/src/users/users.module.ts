import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './users.entity';
import { FriendRequest } from './friend-request.entity';
import { UsersController } from './users.controller';
import { MoviesModule } from 'src/movies/movies.module';
import { ActivityModule } from 'src/activity/activity.module';
import { VectorModule } from 'src/vector/vector.module';
import { PushModule } from 'src/push/push.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, FriendRequest]),
    MoviesModule,
    ActivityModule,
    VectorModule,
    PushModule,
  ],
  providers: [UsersService],
  exports: [UsersService, TypeOrmModule],
  controllers: [UsersController],
})
export class UsersModule {}

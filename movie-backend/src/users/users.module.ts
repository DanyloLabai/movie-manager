import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './users.entity';
import { FriendRequest } from './friend-request.entity';
import { UsersController } from './users.controller';
import { MoviesModule } from 'src/movies/movies.module';
import { ActivityModule } from 'src/activity/activity.module';
import { VectorModule } from 'src/vector/vector.module';
import { SearchHistoryModule } from 'src/search-history/search-history.module';
import { NotificationsModule } from 'src/notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, FriendRequest]),
    MoviesModule,
    ActivityModule,
    VectorModule,
    SearchHistoryModule,
    NotificationsModule,
  ],
  providers: [UsersService],
  exports: [UsersService, TypeOrmModule],
  controllers: [UsersController],
})
export class UsersModule {}

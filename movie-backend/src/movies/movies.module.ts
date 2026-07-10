import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MoviesService } from './movies.service';
import { MoviesController } from './movies.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WatchlistItem } from './watchlist-entity';
import { Notification } from './notification.entity';
import { AuthModule } from 'src/auth/auth.module';
import { User } from 'src/users/users.entity';
import { VectorModule } from 'src/vector/vector.module';
import { ActivityModule } from 'src/activity/activity.module';
import { PushModule } from 'src/push/push.module';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([WatchlistItem, User, Notification]),
    AuthModule,
    VectorModule,
    ActivityModule,
    PushModule,
  ],
  providers: [MoviesService],
  controllers: [MoviesController],
  exports: [MoviesService],
})
export class MoviesModule {}

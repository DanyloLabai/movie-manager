import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Activity } from './activity.entity';
import { User } from '../users/users.entity';
import { WatchlistItem } from '../movies/watchlist-entity';
import { ActivityService } from './activity.service';

@Module({
  imports: [TypeOrmModule.forFeature([Activity, User, WatchlistItem])],
  providers: [ActivityService],
  exports: [ActivityService],
})
export class ActivityModule {}

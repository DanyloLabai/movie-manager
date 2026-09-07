import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SwipeAction } from './swipe-action.entity';
import { WatchlistItem } from '../movies/watchlist-entity';
import { User } from '../users/users.entity';
import { SwipeService } from './swipe.service';
import { SwipeController } from './swipe.controller';
import { MoviesModule } from '../movies/movies.module';
import { VectorModule } from '../vector/vector.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SwipeAction, WatchlistItem, User]),
    MoviesModule,
    VectorModule,
  ],
  providers: [SwipeService],
  controllers: [SwipeController],
})
export class SwipeModule {}

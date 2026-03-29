import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MoviesService } from './movies.service';
import { MoviesController } from './movies.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WatchlistItem } from './watchlist-entity';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [HttpModule, TypeOrmModule.forFeature([WatchlistItem]), AuthModule],
  providers: [MoviesService],
  controllers: [MoviesController],
  exports: [MoviesService],
})
export class MoviesModule {}

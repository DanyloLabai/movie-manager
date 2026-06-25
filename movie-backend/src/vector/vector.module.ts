import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MoviesModule } from '../movies/movies.module';
import { VectorController } from './vector.controller';
import { VectorService } from './vector.service';

@Module({
  imports: [ConfigModule, MoviesModule],
  providers: [VectorService],
  controllers: [VectorController],
  exports: [VectorService],
})
export class VectorModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchHistory } from './search-history.entity';
import { User } from '../users/users.entity';
import { SearchHistoryService } from './search-history.service';

@Module({
  imports: [TypeOrmModule.forFeature([SearchHistory, User])],
  providers: [SearchHistoryService],
  exports: [SearchHistoryService],
})
export class SearchHistoryModule {}

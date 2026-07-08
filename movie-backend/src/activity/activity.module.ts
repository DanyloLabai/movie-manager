import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Activity } from './activity.entity';
import { User } from '../users/users.entity';
import { ActivityService } from './activity.service';

@Module({
  imports: [TypeOrmModule.forFeature([Activity, User])],
  providers: [ActivityService],
  exports: [ActivityService],
})
export class ActivityModule {}

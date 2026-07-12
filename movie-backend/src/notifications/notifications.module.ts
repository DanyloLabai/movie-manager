import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './notification.entity';
import { User } from '../users/users.entity';
import { NotificationsService } from './notifications.service';
import { PushModule } from '../push/push.module';

@Module({
  imports: [TypeOrmModule.forFeature([Notification, User]), PushModule],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}

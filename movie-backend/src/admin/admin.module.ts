import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminGuard } from './guards/admin.guard';
import { User } from '../users/users.entity';
import { AiChatModule } from '../ai-chat/ai-chat.module';
import { FeedbackModule } from '../feedback/feedback.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), AiChatModule, FeedbackModule],
  controllers: [AdminController],
  providers: [AdminGuard],
})
export class AdminModule {}

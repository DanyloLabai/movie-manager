import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { User } from '../users/users.entity';

@Entity('user_achievements')
@Unique('UQ_user_achievements_userId_achievementId', ['user', 'achievementId'])
export class UserAchievement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  achievementId: string;

  @CreateDateColumn()
  unlockedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;
}

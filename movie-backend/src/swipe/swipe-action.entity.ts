import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { User } from '../users/users.entity';

export type SwipeActionType = 'watched' | 'watchlist' | 'skip';

@Entity('swipe_actions')
@Index(['user', 'createdAt'])
@Index(['user', 'action', 'tmdbId'])
export class SwipeAction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tmdbId: number;

  @Column({ default: 'movie' })
  mediaType: string;

  @Column()
  action: SwipeActionType;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '../users/users.entity';

@Entity('watchlist')
export class WatchlistItem {
  @PrimaryGeneratedColumn()
  id: string;

  @Column()
  tmdbId: number;

  @Column()
  title: string;

  @CreateDateColumn()
  addedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;
}

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
  id: number;

  @Column()
  tmdbId: number;

  @Column({ type: 'int', nullable: true })
  rating: number;

  @Column()
  title: string;

  @Column({ default: false })
  isWatched: boolean;

  @Column({ nullable: true })
  posterUrl: string;

  @CreateDateColumn()
  addedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;
}

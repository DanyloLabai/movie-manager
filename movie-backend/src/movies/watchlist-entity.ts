import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import type { User } from '../users/users.entity';

@Entity('watchlist')
export class WatchlistItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tmdbId: number;

  @Column({ type: 'float', nullable: true })
  rating: number;

  @Column({ default: 'movie' })
  mediaType: string;

  @Column()
  title: string;

  @Column({ default: false })
  isWatched: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  watchedAt: Date | null;

  @Column({ default: false })
  isFavorite: boolean;

  @Column({ type: 'int', nullable: true })
  currentSeason: number | null;

  @Column({ type: 'int', nullable: true })
  currentEpisode: number | null;

  @Column({ nullable: true })
  posterUrl: string;

  @Column({ type: 'date', nullable: true })
  releaseDate: string;

  @Column({ default: false })
  notified: boolean;

  @Column({ type: 'int', nullable: true })
  runtimeMinutes: number | null;

  @Column({ type: 'int', nullable: true })
  episodeCount: number | null;

  @Column('text', { array: true, nullable: true })
  genres: string[] | null;

  @Column({ type: 'int', default: 0 })
  rewatchCount: number;

  @CreateDateColumn()
  addedAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne('User', { onDelete: 'CASCADE' })
  user: User;
}

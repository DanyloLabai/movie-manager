import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '../users/users.entity';

export type ActivityType = 'watched' | 'rated' | 'added_watchlist' | 'favorited';

@Entity('activity')
export class Activity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  type: ActivityType;

  @Column()
  tmdbId: number;

  @Column()
  title: string;

  @Column({ nullable: true })
  posterUrl: string;

  @Column()
  mediaType: string;

  @Column({ type: 'int', nullable: true })
  rating: number | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;
}

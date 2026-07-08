import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '../users/users.entity';

@Entity('notification')
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tmdbId: number;

  @Column()
  title: string;

  @Column({ nullable: true })
  posterUrl: string;

  @Column()
  mediaType: string;

  @Column({ default: false })
  isRead: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;
}

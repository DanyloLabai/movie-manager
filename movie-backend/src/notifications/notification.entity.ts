import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { User } from '../users/users.entity';

export type NotificationType =
  | 'release'
  | 'achievement'
  | 'friend_request'
  | 'friend_accepted'
  | 'quiz';

@Entity('notification')
@Index('IDX_notification_userId_createdAt', ['user', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', default: 'release' })
  type: NotificationType;

  @Column({ type: 'int', nullable: true })
  tmdbId: number | null;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ nullable: true })
  posterUrl: string;

  @Column({ type: 'varchar', nullable: true })
  mediaType: string | null;

  @Column({ type: 'varchar', nullable: true })
  url: string | null;

  @Column({ default: false })
  isRead: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;
}

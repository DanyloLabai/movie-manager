import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from '../users/users.entity';

@Entity('push_subscription')
export class PushSubscription {
  @PrimaryGeneratedColumn()
  id: number;

  // Web-push subscription URL, or an Expo push token
  // (`ExponentPushToken[...]`) when provider === 'expo' — either way a
  // unique opaque string identifying one delivery target.
  @Column({ type: 'text', unique: true })
  endpoint: string;

  @Column({ type: 'text', default: 'web' })
  provider: 'web' | 'expo';

  // Only set for provider === 'web'.
  @Column({ type: 'text', nullable: true })
  p256dh: string | null;

  @Column({ type: 'text', nullable: true })
  auth: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;
}

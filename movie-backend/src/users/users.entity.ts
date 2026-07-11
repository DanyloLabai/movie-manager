import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToMany,
  JoinTable,
  OneToMany,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { WatchlistItem } from '../movies/watchlist-entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  username: string;

  @Column({ unique: true })
  email: string;

  @Exclude()
  @Column()
  password: string;

  @Column({ nullable: true })
  avatarUrl: string;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ default: false })
  isAdmin: boolean;

  @Exclude()
  @Column({ type: 'varchar', nullable: true })
  verificationToken: string | null;

  @Exclude()
  @Column({ type: 'timestamptz', nullable: true })
  verificationTokenExpiresAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Exclude()
  @Column({ type: 'varchar', nullable: true })
  resetToken: string | null;

  @Exclude()
  @Column({ type: 'timestamptz', nullable: true })
  resetTokenExpiresAt: Date | null;

  @Exclude()
  @Column({ type: 'varchar', nullable: true })
  hashedRefreshToken: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastReminderSentAt: Date | null;

  @OneToMany(() => WatchlistItem, (watchlistItem) => watchlistItem.user)
  watchlist: WatchlistItem[];

  @ManyToMany(() => User)
  @JoinTable({
    name: 'user_friends',
    joinColumn: { name: 'userId', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'friendId', referencedColumnName: 'id' },
  })
  friends: User[];
}

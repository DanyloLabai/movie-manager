import {
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { User } from './users.entity';

@Entity('friend_request')
export class FriendRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  fromUser: User;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  toUser: User;
}

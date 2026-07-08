import { Entity, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne } from 'typeorm';
import { User } from './users.entity';

// Only pending requests are ever stored — accepting or declining resolves
// (deletes) the row, since acceptance is then represented by the existing
// User.friends relation.
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

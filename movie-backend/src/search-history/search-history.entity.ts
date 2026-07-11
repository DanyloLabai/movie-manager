import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { User } from '../users/users.entity';

@Entity('search_history')
@Index('IDX_search_history_userId_createdAt', ['user', 'createdAt'])
export class SearchHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  queryText: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;
}

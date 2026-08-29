import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { User } from '../users/users.entity';

@Entity('feedback')
@Index(['createdAt'])
export class Feedback {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('smallint')
  rating: number;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  user: User;

  @CreateDateColumn()
  createdAt: Date;
}

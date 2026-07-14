import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { User } from '../users/users.entity';

@Entity('quiz_attempt')
@Unique('UQ_quiz_attempt_userId_quizDate', ['userId', 'quizDate'])
export class QuizAttempt {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'date' })
  quizDate: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  guesses: string[];

  @Column({ default: 0 })
  hintsRevealed: number;

  @Column({ default: 100 })
  score: number;

  @Column({ default: false })
  isSolved: boolean;

  @Column({ default: false })
  isFailed: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { QuizMoviePool } from './quiz-movie-pool.entity';

export interface QuizHint {
  level: number;
  text: string;
}

export type QuizLanguage = 'en' | 'uk';

export type QuizHintsByLanguage = Record<QuizLanguage, QuizHint[]>;

@Entity('daily_movie_quiz')
export class DailyMovieQuiz {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'date', unique: true })
  date: string;

  @Column()
  poolId: number;

  @ManyToOne(() => QuizMoviePool, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'poolId' })
  pool: QuizMoviePool;

  @Column({ type: 'jsonb', default: () => `'{"en":[],"uk":[]}'` })
  hints: QuizHintsByLanguage;

  @CreateDateColumn()
  createdAt: Date;
}

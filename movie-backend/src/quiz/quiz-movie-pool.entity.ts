import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export interface QuizCastMember {
  name: string;
  character?: string;
}

@Entity('quiz_movie_pool')
export class QuizMoviePool {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  imdbId: string;

  @Column()
  tmdbId: number;

  @Column()
  title: string;

  @Column({ type: 'int', nullable: true })
  releaseYear: number | null;

  @Column({ type: 'varchar', nullable: true })
  posterPath: string | null;

  @Column('int', { array: true, default: () => "'{}'" })
  genres: number[];

  @Column({ type: 'text', nullable: true })
  overview: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  cast: QuizCastMember[];

  @Column({ type: 'varchar', nullable: true })
  director: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}

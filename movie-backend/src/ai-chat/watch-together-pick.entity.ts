import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('watch_together_picks')
@Index(['userIdLow', 'userIdHigh'])
export class WatchTogetherPick {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userIdLow: number;

  @Column()
  userIdHigh: number;

  @Column()
  tmdbId: number;

  @Column()
  mediaType: string;

  @Column()
  title: string;

  @CreateDateColumn()
  createdAt: Date;
}

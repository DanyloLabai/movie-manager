import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export type AiProvider = 'groq' | 'gemini';
export type AiRequestType = 'chat' | 'embedding';

@Entity('ai_usage_log')
export class AiUsageLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @Column()
  provider: AiProvider;

  @Column({ default: false })
  wasFailover: boolean;

  @Column()
  requestType: AiRequestType;

  @Column({ type: 'int', nullable: true })
  tokenCount: number | null;

  @Column({ type: 'int', nullable: true })
  latencyMs: number | null;

  @CreateDateColumn()
  createdAt: Date;
}

import { QuizDifficulty } from './quiz-attempt.entity';

export interface DifficultyConfig {
  initialHints: number;
  maxAttempts: number;
}

export const QUIZ_DIFFICULTY_CONFIG: Record<QuizDifficulty, DifficultyConfig> =
  {
    easy: { initialHints: 2, maxAttempts: 6 },
    normal: { initialHints: 1, maxAttempts: 5 },
    hard: { initialHints: 0, maxAttempts: 4 },
  };

export function isQuizDifficulty(value: unknown): value is QuizDifficulty {
  return value === 'easy' || value === 'normal' || value === 'hard';
}

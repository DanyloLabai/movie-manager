import { api } from "./index";

export type QuizDifficulty = "easy" | "normal" | "hard";
export type QuizLanguage = "en" | "uk";

export interface QuizAnswer {
  title: string;
  releaseYear: number | null;
  posterUrl: string | null;
  tmdbId: number;
}

export interface QuizStreak {
  current: number;
  best: number;
}

export interface QuizState {
  date: string;
  difficulty: QuizDifficulty;
  maxAttempts: number;
  hints: string[];
  guesses: string[];
  attemptsLeft: number;
  isSolved: boolean;
  isFailed: boolean;
  posterUrl: string | null;
  streak: QuizStreak;
  answer?: QuizAnswer;
}

export interface QuizGuessResult extends QuizState {
  correct: boolean;
}

export type QuizFriendStatus = "solved" | "failed" | "not_played";

export interface QuizFriendState {
  id: number;
  username: string;
  avatarUrl: string | null;
  status: QuizFriendStatus;
  guessCount: number;
}

export async function getTodayQuiz(
  difficulty: QuizDifficulty,
  lang: QuizLanguage,
): Promise<QuizState> {
  const res = await api.get("/quiz/today", { params: { difficulty, lang } });
  return res.data as QuizState;
}

export async function submitGuess(body: {
  difficulty: QuizDifficulty;
  title: string;
  tmdbId: number;
  lang: QuizLanguage;
}): Promise<QuizGuessResult> {
  const res = await api.post("/quiz/guess", body);
  return res.data as QuizGuessResult;
}

export async function getFriendsStatus(): Promise<QuizFriendState[]> {
  const res = await api.get("/quiz/friends-status");
  return res.data as QuizFriendState[];
}

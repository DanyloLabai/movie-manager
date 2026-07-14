import { api } from "./index";

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
  score: number;
  hintsRevealed: number;
  nextHintCost: number | null;
  hints: string[];
  guesses: string[];
  guessesLeft: number;
  maxGuesses: number;
  isSolved: boolean;
  isFailed: boolean;
  posterUrl: string | null;
  streak: QuizStreak;
  answer?: QuizAnswer;
}

export interface QuizGuessResult extends QuizState {
  correct: boolean;
}

export type QuizTodayStatus = "solved" | "failed" | "in_progress" | "not_played";

export interface QuizLeaderboardEntry {
  id: number;
  username: string;
  avatarUrl: string | null;
  totalScore: number;
  rank: number;
  todayScore: number | null;
  todayStatus: QuizTodayStatus;
  isMe: boolean;
}

export interface QuizStats {
  totalSolved: number;
  perfectSolves: number;
  currentStreak: number;
  bestStreak: number;
}

export async function getTodayQuiz(lang: QuizLanguage): Promise<QuizState> {
  const res = await api.get("/quiz/today", { params: { lang } });
  return res.data as QuizState;
}

export async function buyHint(lang: QuizLanguage): Promise<QuizState> {
  const res = await api.post("/quiz/hint", { lang });
  return res.data as QuizState;
}

export async function submitGuess(body: {
  title: string;
  tmdbId: number;
  lang: QuizLanguage;
}): Promise<QuizGuessResult> {
  const res = await api.post("/quiz/guess", body);
  return res.data as QuizGuessResult;
}

export async function getFriendsLeaderboard(): Promise<QuizLeaderboardEntry[]> {
  const res = await api.get("/quiz/friends-leaderboard");
  return res.data as QuizLeaderboardEntry[];
}

export async function getMyStats(): Promise<QuizStats> {
  const res = await api.get("/quiz/my-stats");
  return res.data as QuizStats;
}

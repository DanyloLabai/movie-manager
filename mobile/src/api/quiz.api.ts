import { api } from './client';

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

export interface QuizStats {
  totalSolved: number;
  perfectSolves: number;
  currentStreak: number;
  bestStreak: number;
}

export async function getTodayQuiz(): Promise<QuizState> {
  const res = await api.get('/quiz/today', { params: { lang: 'en' } });
  return res.data as QuizState;
}

const BASE64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

// Hermes (RN's JS engine) has no global btoa — encode manually.
function bytesToBase64(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i];
    const b2 = bytes[i + 1];
    const b3 = bytes[i + 2];
    result += BASE64_CHARS[b1 >> 2];
    result += BASE64_CHARS[((b1 & 3) << 4) | (b2 >> 4)];
    result += b2 === undefined ? '=' : BASE64_CHARS[((b2 & 15) << 2) | (b3 >> 6)];
    result += b3 === undefined ? '=' : BASE64_CHARS[b3 & 63];
  }
  return result;
}

// Poster is blurred server-side according to hint progress — never the sharp
// original while the quiz is unsolved. api.get with responseType 'arraybuffer'
// (not 'blob' — RN's fetch/XHR polyfill has no Blob-from-network support) so
// it can be base64-encoded into a data: URI for RN's Image component.
export async function getPosterImageBase64(): Promise<string> {
  const res = await api.get('/quiz/poster', { responseType: 'arraybuffer' });
  const bytes = new Uint8Array(res.data as ArrayBuffer);
  return `data:image/jpeg;base64,${bytesToBase64(bytes)}`;
}

export async function buyHint(): Promise<QuizState> {
  const res = await api.post('/quiz/hint', { lang: 'en' });
  return res.data as QuizState;
}

export async function submitGuess(body: {
  title: string;
  tmdbId: number;
}): Promise<QuizGuessResult> {
  const res = await api.post('/quiz/guess', { ...body, lang: 'en' });
  return res.data as QuizGuessResult;
}

export interface QuizLeaderboardEntry {
  id: number;
  username: string;
  avatarUrl: string | null;
  totalScore: number;
  rank: number;
  todayScore: number | null;
  todayStatus: 'solved' | 'failed' | 'in_progress' | 'not_played';
  isMe: boolean;
}

export async function getFriendsLeaderboard(): Promise<QuizLeaderboardEntry[]> {
  const res = await api.get('/quiz/friends-leaderboard');
  return (res.data as QuizLeaderboardEntry[]) ?? [];
}

export async function getMyStats(): Promise<QuizStats> {
  const res = await api.get('/quiz/my-stats');
  return res.data as QuizStats;
}

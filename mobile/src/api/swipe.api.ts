import { api } from './client';

export interface SwipeCard {
  id: number;
  title: string;
  hook: string;
  releaseYear: string;
  releaseDate: string | null;
  genres: string[];
  runtime: number | null;
  voteAverage: number;
  posterUrl: string | null;
  mediaType: 'movie';
  matchType: 'personalized' | 'diverse';
}

export interface SwipeFeedResponse {
  movies: SwipeCard[];
  remainingToday: number;
  dailyLimit: number;
  resetAt: string | null;
}

export async function getSwipeFeed(): Promise<SwipeFeedResponse> {
  const res = await api.get('/swipe/feed');
  return res.data as SwipeFeedResponse;
}

export interface SwipeStatus {
  remainingToday: number;
  dailyLimit: number;
  showPromo: boolean;
}

export async function getSwipeStatus(): Promise<SwipeStatus> {
  const res = await api.get('/swipe/status');
  return res.data as SwipeStatus;
}

export type SwipeActionType = 'watched' | 'watchlist' | 'skip';

export interface SwipeActionPayload {
  tmdbId: number;
  title: string;
  posterUrl?: string | null;
  releaseDate?: string | null;
  action: SwipeActionType;
  rating?: number;
}

export interface SwipeActionResult {
  success: true;
  remainingToday: number;
  dailyLimit: number;
}

export async function submitSwipeAction(
  payload: SwipeActionPayload,
): Promise<SwipeActionResult> {
  const res = await api.post('/swipe', payload);
  return res.data as SwipeActionResult;
}

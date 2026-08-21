import type {
  AppNotification,
  FriendWatched,
  MovieDetails,
  MovieResult,
  ProfileData,
  RecommendedMovie,
  WatchlistItem,
} from '@movie-manager/shared';
import { api } from './client';

export async function getWatchlist(limit = 30, offset = 0): Promise<WatchlistItem[]> {
  const res = await api.get('/movies/watchlist', { params: { limit, offset } });
  return res.data as WatchlistItem[];
}

export async function getWatched(limit = 30, offset = 0, rating?: number): Promise<WatchlistItem[]> {
  const res = await api.get('/movies/watched', { params: { limit, offset, rating } });
  return res.data as WatchlistItem[];
}

export async function addToWatchlist(body: {
  tmdbId: number;
  title: string;
  posterUrl?: string | null;
  mediaType: 'movie' | 'tv';
  releaseDate?: string | null;
}): Promise<WatchlistItem> {
  const res = await api.post('/movies/watchlist', body);
  return res.data as WatchlistItem;
}

export async function removeFromWatchlist(tmdbId: number): Promise<void> {
  await api.delete(`/movies/watchlist/${tmdbId}`);
}

export async function markAsWatched(tmdbId: number): Promise<WatchlistItem> {
  const res = await api.post(`/movies/watchlist/${tmdbId}/watched`);
  return res.data as WatchlistItem;
}

export async function rateMovie(tmdbId: number, rating: number): Promise<void> {
  await api.patch(`/movies/watchlist/${tmdbId}/rate`, { rating });
}

export async function toggleFavorite(tmdbId: number): Promise<WatchlistItem> {
  const res = await api.patch(`/movies/watchlist/${tmdbId}/favorite`);
  return res.data as WatchlistItem;
}

export async function getProfile(): Promise<ProfileData> {
  const res = await api.get('/movies/profile');
  return res.data as ProfileData;
}

// @Public() — used by the Top 100 screen.
export async function getTop100(type: 'movie' | 'tv'): Promise<MovieResult[]> {
  const res = await api.get(`/movies/top100/${type}`);
  return (res.data as MovieResult[]) ?? [];
}

export async function getTrending(): Promise<MovieResult[]> {
  const res = await api.get('/movies/trending');
  return (res.data as MovieResult[]) ?? [];
}

export async function getRecommendations(): Promise<MovieResult[]> {
  const res = await api.get('/movies/recommendations');
  return (res.data as MovieResult[]) ?? [];
}

export interface BecauseYouWatchedResponse {
  basedOnMovie: { id: number; title: string; posterUrl: string | null };
  similarMovies: MovieResult[];
}

export async function getBecauseYouWatched(): Promise<BecauseYouWatchedResponse | null> {
  const res = await api.get('/movies/recommendations/because-you-watched');
  return res.data as BecauseYouWatchedResponse | null;
}

export async function getSimilar(
  tmdbId: number,
  type: 'movie' | 'tv',
): Promise<RecommendedMovie[]> {
  const res = await api.get(`/movies/${tmdbId}/similar`, { params: { type } });
  return (res.data as RecommendedMovie[]) ?? [];
}

export async function getActor(personId: number): Promise<ActorDetails> {
  const res = await api.get(`/movies/actor/${personId}`);
  return res.data as ActorDetails;
}

export interface ActorKnownFor {
  id: number;
  title: string;
  posterUrl: string | null;
  mediaType: string;
  releaseYear: string;
  character: string;
}

export interface ActorDetails {
  id: number;
  name: string;
  biography: string | null;
  profileUrl: string | null;
  birthday: string | null;
  placeOfBirth: string | null;
  knownFor: ActorKnownFor[];
}

export async function getFriendsWatched(
  tmdbId: number,
  type: 'movie' | 'tv',
): Promise<FriendWatched[]> {
  const res = await api.get(`/movies/${tmdbId}/friends-watched`, { params: { type } });
  return (res.data as FriendWatched[]) ?? [];
}

export async function getNotifications(params?: {
  limit?: number;
  offset?: number;
}): Promise<AppNotification[]> {
  const res = await api.get('/movies/notifications', { params });
  return (res.data as AppNotification[]) ?? [];
}

export async function markNotificationRead(id: number): Promise<void> {
  await api.patch(`/movies/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.patch('/movies/notifications/read-all');
}

export interface SmartSearchFilters {
  genreId?: number;
  yearFrom?: number;
  yearTo?: number;
  minRating?: number;
  runtimeFrom?: number;
  runtimeTo?: number;
  excludeWatched?: boolean;
}

export async function smartSearchMovies(
  query: string,
  filters: SmartSearchFilters = {},
): Promise<MovieResult[]> {
  const res = await api.get('/movies/search/smart', { params: { query, ...filters } });
  return (res.data as MovieResult[]) ?? [];
}

export async function getMovieDetails(
  tmdbId: number,
  type: 'movie' | 'tv' = 'movie',
): Promise<MovieDetails> {
  const res = await api.get(`/movies/${tmdbId}/details`, { params: { type } });
  return res.data as MovieDetails;
}

export async function getMovieStatus(tmdbId: number): Promise<WatchlistItem | null> {
  const res = await api.get(`/movies/${tmdbId}/status`);
  return res.data as WatchlistItem | null;
}

export async function searchMovies(
  title: string,
  options?: { skipHistory?: boolean },
): Promise<MovieResult[]> {
  const res = await api.get('/movies/search', {
    params: { title, skipHistory: options?.skipHistory },
  });
  return (res.data as MovieResult[]) ?? [];
}

// @Public() on the backend (movie-backend/src/movies/movies.controller.ts) —
// safe to call before sign-in, used for the Login/Register backdrop photo.
export async function getUpcomingMovies(): Promise<MovieResult[]> {
  const res = await api.get('/movies/upcoming');
  return (res.data as MovieResult[]) ?? [];
}

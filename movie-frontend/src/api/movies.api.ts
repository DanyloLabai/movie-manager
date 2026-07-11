import { api } from "./index";
import type {
  MovieResult,
  MovieDetails,
  RecommendedMovie,
  UserMovieStatus,
  WatchlistItem,
  ProfileData,
  FriendWatched,
} from "../types/movie.types";

export async function searchMovies(
  params: Record<string, unknown>,
): Promise<MovieResult[]> {
  const res = await api.get("/movies/search", { params });
  return res.data as MovieResult[];
}

export async function searchMoviesByMood(
  moodDescription: string,
): Promise<MovieResult[]> {
  const res = await api.post("/movies/search/mood", { moodDescription });
  return res.data as MovieResult[];
}

export async function getTrending(): Promise<MovieResult[]> {
  const res = await api.get("/movies/trending");
  return res.data as MovieResult[];
}

export async function getUpcoming(): Promise<MovieResult[]> {
  const res = await api.get("/movies/upcoming");
  return res.data as MovieResult[];
}

export async function getRecommendations(): Promise<MovieResult[]> {
  const res = await api.get("/movies/recommendations");
  return res.data as MovieResult[];
}

export async function addToWatchlist(body: {
  tmdbId: number;
  title: string;
  posterUrl?: string | null;
  mediaType?: string;
  releaseDate?: string | null;
}): Promise<WatchlistItem> {
  const res = await api.post("/movies/watchlist", body);
  return res.data as WatchlistItem;
}

export async function removeFromWatchlist(id: number): Promise<void> {
  await api.delete(`/movies/watchlist/${id}`);
}

export async function toggleFavorite(id: number): Promise<void> {
  await api.patch(`/movies/watchlist/${id}/favorite`);
}

export async function getWatchlist(
  endpoint: "watchlist" | "watched",
  params?: { limit?: number; offset?: number },
): Promise<WatchlistItem[]> {
  const res = await api.get(`/movies/${endpoint}`, { params });
  return res.data as WatchlistItem[];
}

export async function getProfile(): Promise<ProfileData> {
  const res = await api.get(`/movies/profile`);
  return res.data as ProfileData;
}

export async function getTop100(type: string): Promise<MovieResult[]> {
  const res = await api.get(`/movies/top100/${type}`);
  return res.data as MovieResult[];
}

export async function getMovieDetails(
  tmdbId: number,
  type: string,
): Promise<MovieDetails> {
  const res = await api.get(`/movies/${tmdbId}/details?type=${type}`);
  return res.data as MovieDetails;
}

export async function getSimilar(
  tmdbId: number,
  type: string,
): Promise<RecommendedMovie[]> {
  const res = await api.get(`/movies/${tmdbId}/similar?type=${type}`);
  return res.data as RecommendedMovie[];
}

export async function getActor(personId: number): Promise<unknown> {
  const res = await api.get(`/movies/actor/${personId}`);
  return res.data as unknown;
}

export async function rateMovie(id: number, rating: number): Promise<void> {
  await api.patch(`/movies/watchlist/${id}/rate`, { rating });
}

export async function markWatched(id: number): Promise<void> {
  await api.post(`/movies/watchlist/${id}/watched`);
}

export async function updateEpisodeProgress(
  id: number,
  season: number,
  episode: number,
): Promise<WatchlistItem> {
  const res = await api.patch(`/movies/watchlist/${id}/progress`, {
    season,
    episode,
  });
  return res.data as WatchlistItem;
}

export async function getStatus(id: number): Promise<UserMovieStatus | null> {
  const res = await api.get(`/movies/${id}/status`);
  return res.data as UserMovieStatus | null;
}

export async function getFriendsWatched(
  tmdbId: number,
  type: string,
): Promise<FriendWatched[]> {
  const res = await api.get(`/movies/${tmdbId}/friends-watched?type=${type}`);
  return res.data as FriendWatched[];
}

export type AppNotification = {
  id: number;
  tmdbId: number;
  title: string;
  posterUrl: string | null;
  mediaType: string;
  isRead: boolean;
  createdAt: string;
};

export async function getNotifications(params?: {
  limit?: number;
  offset?: number;
}): Promise<AppNotification[]> {
  const res = await api.get(`/movies/notifications`, { params });
  return res.data as AppNotification[];
}

export async function markNotificationRead(id: number): Promise<void> {
  await api.patch(`/movies/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.patch(`/movies/notifications/read-all`);
}

export default {
  searchMovies,
  searchMoviesByMood,
  getTrending,
  getUpcoming,
  getRecommendations,
  addToWatchlist,
  removeFromWatchlist,
  toggleFavorite,
  getWatchlist,
  getProfile,
  getTop100,
  getMovieDetails,
  getSimilar,
  getActor,
  rateMovie,
  markWatched,
  updateEpisodeProgress,
  getStatus,
  getFriendsWatched,
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
};

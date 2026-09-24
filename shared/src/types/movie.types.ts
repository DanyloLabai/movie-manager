// MovieResult mirrors movie-backend/src/movies/dto/movie-result.dto.ts exactly
// (including originalTitle, which movie-frontend's local type is missing).
export interface MovieResult {
  id: number;
  title: string;
  originalTitle: string;
  description: string;
  releaseYear: string;
  rating: number;
  posterUrl: string | null;
  mediaType: 'movie' | 'tv';
  releaseDate: string | null;
}

// WatchlistItem mirrors the raw TypeORM entity (movie-backend/src/movies/watchlist-entity.ts)
// because getWatchlist() returns entities unmapped, with no DTO in between.
// `id` is always a number on the wire — movie-frontend's `number | string`
// union is stale, not a real possibility.
export interface WatchlistItem {
  id: number;
  tmdbId: number;
  rating: number | null;
  mediaType: string;
  title: string;
  isWatched: boolean;
  watchedAt: string | null; // Date serializes to an ISO string over JSON
  isFavorite: boolean;
  currentSeason: number | null;
  currentEpisode: number | null;
  posterUrl: string | null;
  releaseDate: string | null;
  notified: boolean;
  addedAt: string;
  updatedAt: string;
}

// Mirrors movie-backend/src/movies/dto/movie-details-extended.dto.ts and its
// nested DTOs exactly (GenreDto, CastMemberDto, WatchProviderDto, SeasonInfoDto).
export interface Genre {
  id: number;
  name: string;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

export interface WatchProvider {
  logo_path: string | null;
  provider_id: number;
  provider_name: string;
}

export interface SeasonInfo {
  seasonNumber: number;
  name: string;
  episodeCount: number;
}

export interface MovieDetails {
  id: number;
  title: string;
  overview: string;
  releaseDate: string;
  voteAverage: number;
  posterPath: string | null;
  backdropPath: string | null;
  runtime: number;
  genres: Genre[];
  mediaType: 'movie' | 'tv';
  trailerUrl: string | null;
  watchProviders: WatchProvider[] | null;
  productionCountries: string[];
  cast: CastMember[];
  seasons?: SeasonInfo[];
}

export interface RecommendedMovie {
  id: number;
  title: string;
  releaseYear?: string;
  rating?: number;
  posterUrl: string | null;
  mediaType: 'movie' | 'tv';
}

export interface UserMovieStatus {
  id: number;
  isWatched: boolean;
  isFavorite: boolean;
  rating: number | null;
  currentSeason: number | null;
  currentEpisode: number | null;
}

export interface FriendWatched {
  id: number;
  username: string;
  avatarUrl: string | null;
  rating: number | null;
}

// Mirrors movie-backend/src/movies/movies.service.ts's getProfileData() return
// shape (no DTO class backs it — it's a plain object built up in the
// service), and what GET /users/public/:id returns (same shape + isFriend +
// requestPending).
export interface ProfileData {
  id?: number;
  username?: string;
  favorites: WatchlistItem[];
  recent: WatchlistItem[];
  avatarUrl?: string | null;
  memberSince?: string;
  watchedCount?: number;
  totalCount?: number;
  stats?: {
    totalMinutes?: number;
    topGenre?: string;
    genreDistribution?: { name: string; value: number }[];
    topRated?: WatchlistItem[];
    averageRating?: string | number;
    moviesCount?: number;
    tvCount?: number;
    favoriteDecade?: string;
    ratingDistribution?: { name: string; value: number }[];
    completionRate?: number;
    longestMovie?: { title: string; runtime?: number };
    topActor?: { name: string; count: number; profileUrl: string | null } | null;
  };
}

export type AppNotificationType = 'release' | 'achievement' | 'friend_request' | 'friend_accepted';

export interface AppNotification {
  id: number;
  type: AppNotificationType;
  tmdbId: number | null;
  title: string;
  body: string | null;
  posterUrl: string | null;
  mediaType: string | null;
  url: string | null;
  isRead: boolean;
  createdAt: string;
}

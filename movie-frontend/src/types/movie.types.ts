export interface MovieResult {
  id: number;
  title: string;
  description: string;
  releaseYear: string;
  releaseDate?: string | null;
  rating: number;
  posterUrl: string | null;
  mediaType: "movie" | "tv";
}

export interface WatchlistItem {
  id: number | string;
  tmdbId: number;
  title: string;
  addedAt?: string;
  updatedAt?: string;
  posterUrl?: string | null;
  isWatched: boolean;
  isFavorite: boolean;
  /** User's rating, 0-10 in 0.5 increments. */
  rating?: number | null;
  mediaType: "movie" | "tv" | string;
  releaseDate?: string | null;
  releaseYear?: string | null;
  currentSeason?: number | null;
  currentEpisode?: number | null;
}

export interface SeasonInfo {
  seasonNumber: number;
  name: string;
  episodeCount: number;
}

export interface ProfileData {
  id?: number;
  username?: string;
  favorites: WatchlistItem[];
  recent: WatchlistItem[];
  watchedIds?: number[];
  inPlansIds?: number[];
  avatarUrl?: string | null;
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
    topActor?: {
      name: string;
      count: number;
      profileUrl: string | null;
    } | null;
  };
}

export interface WatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
}

export interface WatchProvidersData {
  link?: string;
  flatrate?: WatchProvider[];
  rent?: WatchProvider[];
  buy?: WatchProvider[];
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path?: string | null;
}

export interface MovieDetails {
  id: number;
  title: string;
  overview: string;
  releaseDate?: string | null;
  voteAverage?: number;
  posterPath?: string | null;
  backdropPath?: string | null;
  runtime?: number;
  genres?: Array<{ id: number; name: string }>;
  mediaType?: "movie" | "tv";
  trailerUrl?: string | null;
  watchProviders?: WatchProvidersData | WatchProvider[] | null;
  productionCountries?: string[];
  cast?: CastMember[];
  seasons?: SeasonInfo[];
}

export interface RecommendedMovie {
  id: number;
  title: string;
  releaseYear?: string;
  rating?: number;
  posterUrl?: string | null;
  mediaType?: "movie" | "tv";
}

export interface UserMovieStatus {
  id: number;
  isWatched: boolean;
  isFavorite: boolean;
  /** User's rating, 0-10 in 0.5 increments. */
  rating?: number | null;
  currentSeason?: number | null;
  currentEpisode?: number | null;
}

export interface FriendWatched {
  id: number;
  username: string;
  avatarUrl: string | null;
  /** Friend's rating, 0-10 in 0.5 increments. */
  rating: number | null;
}

export interface MovieCardProps {
  movie: MovieResult;
  favoriteIds: number[];
  addedIds: number[];
  watchedIds: number[];
  onToggleFavorite: (item: MovieResult) => void;
  onAdd: (item: MovieResult) => void;
  onRemove: (item: MovieResult) => void;
}

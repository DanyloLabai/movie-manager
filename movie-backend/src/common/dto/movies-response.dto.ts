export class WatchlistResponseDto {
  id: number;
  userId: number;
  tmdbId: number;
  title: string;
  posterUrl: string | null;
  mediaType: 'movie' | 'tv';
  releaseDate: string | null;
  addedAt: Date;
}

export class WatchedMovieResponseDto {
  id: number;
  userId: number;
  tmdbId: number;
  title: string;
  posterUrl: string | null;
  mediaType: 'movie' | 'tv';
  rating: number;
  reviewText: string | null;
  watchedAt: Date;
}

export class FavoriteResponseDto {
  id: number;
  userId: number;
  tmdbId: number;
  title: string;
  posterUrl: string | null;
  mediaType: 'movie' | 'tv';
  favoritedAt: Date;
}

export class GetWatchlistResponseDto {
  data: WatchlistResponseDto[];
  total: number;
}

export class GetWatchedMoviesResponseDto {
  data: WatchedMovieResponseDto[];
  total: number;
}

export class GetFavoritesResponseDto {
  data: FavoriteResponseDto[];
  total: number;
}

export class ProfileDataResponseDto {
  watchlistCount: number;
  watchedCount: number;
  favoriteCount: number;
  topRatedMovies: WatchedMovieResponseDto[];
}

export class AddWatchlistResponseDto {
  message: string;
  data: WatchlistResponseDto;
}

export class RemoveWatchlistResponseDto {
  message: string;
}

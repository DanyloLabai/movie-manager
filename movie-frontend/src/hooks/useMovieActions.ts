import type { MovieResult } from "../types/movie.types";
import * as moviesApi from "../api/movies.api";

type Callbacks = {
  onAdded?: (id: number) => void;
  onRemoved?: (id: number) => void;
  onToggledFavorite?: (id: number, isFav: boolean) => void;
  onError?: (msg: string) => void;
};

export function useMovieActions(callbacks: Callbacks = {}) {
  const handleAdd = async (item: MovieResult) => {
    try {
      await moviesApi.addToWatchlist({
        tmdbId: item.id,
        title: item.title,
        posterUrl: item.posterUrl,
        mediaType: item.mediaType,
        releaseDate: item.releaseDate,
      });
      callbacks.onAdded?.(item.id);
    } catch {
      callbacks.onError?.("Failed to add");
    }
  };

  const handleRemove = async (item: MovieResult) => {
    try {
      await moviesApi.removeFromWatchlist(item.id);
      callbacks.onRemoved?.(item.id);
    } catch {
      callbacks.onError?.("Failed to remove");
    }
  };

  const handleToggleFavorite = async (item: MovieResult, isFav: boolean) => {
    try {
      await moviesApi.toggleFavorite(item.id);
      callbacks.onToggledFavorite?.(item.id, !isFav);
    } catch {
      callbacks.onError?.("Failed to toggle favorite");
    }
  };

  return { handleAdd, handleRemove, handleToggleFavorite } as const;
}

export default useMovieActions;

import { useState, useCallback } from "react";
import type { WatchlistItem, ProfileData } from "../types/movie.types";
import * as moviesApi from "../api/movies.api";

export function useWatchlist() {
  const [movies, setMovies] = useState<WatchlistItem[]>([]);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchMovies = useCallback(async (type: "watchlist" | "watched") => {
    setIsLoading(true);
    try {
      const data = await moviesApi.getWatchlist(
        type === "watchlist" ? "watchlist" : "watched",
      );
      setMovies(data || []);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await moviesApi.getProfile();
      setProfile(data || null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    movies,
    setMovies,
    profile,
    setProfile,
    isLoading,
    fetchMovies,
    fetchProfile,
  } as const;
}

export default useWatchlist;

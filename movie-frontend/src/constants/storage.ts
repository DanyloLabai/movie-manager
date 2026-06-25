export const STORAGE_KEYS = {
  TOKEN: "token",
  USER: "user",
  FAVORITES_CACHE: "movie_tracker_favorites_cache",
  TRENDING_CACHE: "trending_cache_",
  UPCOMING_CACHE: "upcoming_cache_",
  SEARCH_QUERY_CACHE: "search_query_cache_",
  SEARCH_RESULTS_CACHE: "search_results_cache_",
  RECOMMENDATIONS_CACHE: "recommendations_cache_",
  SEARCH_TIMESTAMP: "search_timestamp_",
  ADDED_CACHE: "added_cache_",
  WATCHED_CACHE: "watched_cache_",
} as const;

export const CACHE_EXPIRATION_MS =
  Number(import.meta.env.VITE_CACHE_EXPIRATION_MS) || 24 * 60 * 60 * 1000; // 24 hours

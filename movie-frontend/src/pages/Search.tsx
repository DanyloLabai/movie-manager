import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import * as moviesApi from "../api/movies.api";
import * as usersApi from "../api/users.api";
import * as swipeApi from "../api/swipe.api";
import type { SwipeStatus } from "../api/swipe.api";

import { useLang } from "../context/LanguageContext";
import { MovieCarousel } from "../components/movie/MovieCarousel";
import { BecauseYouWatchedCarousel } from "../components/movie/BecauseYouWatchedCarousel";
import { FriendActivityCarousel } from "../components/movie/FriendActivityCarousel";
import { MovieCard } from "../components/movie/MovieCard";
import NotificationBell from "../components/NotificationBell";
import LogoIcon from "../components/LogoIcon";
import { SearchFilterBar } from "../components/search/SearchFilterBar";
import type { MovieResult } from "../types/movie.types";
import type {
  SmartSearchFilters,
  BecauseYouWatchedResponse,
} from "../api/movies.api";
import type { FriendLastWatched } from "../api/users.api";

type ProfileResponse = {
  favorites?: Array<{ tmdbId: number }>;
  watchedIds?: number[];
  inPlansIds?: number[];
};

const getUserId = (): string => {
  const token = localStorage.getItem("token");
  if (!token) return "guest";
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return String(payload.sub || payload.id || payload.userId || "guest");
  } catch {
    return "guest";
  }
};

const uid = getUserId();
const TRENDING_CACHE_KEY = `trending_cache_${uid}`;
const UPCOMING_CACHE_KEY = `upcoming_cache_${uid}`;
const FAVORITES_CACHE_KEY = `favorites_cache_${uid}`;
const SEARCH_QUERY_CACHE_KEY = `search_query_cache_${uid}`;
const SEARCH_RESULTS_CACHE_KEY = `search_results_cache_${uid}`;
const RECOMMENDATIONS_CACHE_KEY = `recommendations_cache_${uid}`;
const BECAUSE_YOU_WATCHED_CACHE_KEY = `because_you_watched_cache_${uid}`;
const FRIENDS_ACTIVITY_CACHE_KEY = `friends_activity_cache_${uid}`;
const FILTERS_CACHE_KEY = `search_filters_cache_${uid}`;
const SHOW_FILTERS_CACHE_KEY = `search_show_filters_cache_${uid}`;
const SEARCH_TIMESTAMP_KEY = `search_timestamp_${uid}`;
const ADDED_CACHE_KEY = `added_cache_${uid}`;

const CACHE_EXPIRATION_MS =
  Number(import.meta.env.VITE_CACHE_EXPIRATION_MS) || 24 * 60 * 60 * 1000;

const isReleased = (movie: MovieResult) => {
  if (movie.releaseDate) {
    const today = new Date();
    const release = new Date(movie.releaseDate);
    today.setHours(0, 0, 0, 0);
    release.setHours(0, 0, 0, 0);
    return release <= today;
  }
  if (movie.releaseYear && movie.releaseYear !== "N/A")
    return parseInt(movie.releaseYear, 10) <= new Date().getFullYear();
  return true;
};

function DiscoverStackIcon({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`relative shrink-0 ${small ? "w-[18px] h-[22px]" : "w-[22px] h-[26px]"}`}
    >
      <span className="absolute inset-0 rounded border-[1.5px] border-[#d9ac54]/45 -rotate-[10deg] -translate-x-[3px]" />
      <span className="absolute inset-0 rounded border-[1.5px] border-[#d9ac54] bg-[#14110d] rotate-[6deg] translate-x-[2px]" />
    </span>
  );
}

export default function Search() {
  const [searchQuery, setSearchQuery] = useState(() => {
    try {
      const timestamp = localStorage.getItem(SEARCH_TIMESTAMP_KEY);
      if (timestamp && Date.now() - parseInt(timestamp) < CACHE_EXPIRATION_MS) {
        return localStorage.getItem(SEARCH_QUERY_CACHE_KEY) || "";
      }
      return "";
    } catch {
      return "";
    }
  });

  const [results, setResults] = useState<MovieResult[]>(() => {
    try {
      const timestamp = localStorage.getItem(SEARCH_TIMESTAMP_KEY);
      if (timestamp && Date.now() - parseInt(timestamp) < CACHE_EXPIRATION_MS) {
        const cached = localStorage.getItem(SEARCH_RESULTS_CACHE_KEY);
        return cached ? JSON.parse(cached) : [];
      }
      return [];
    } catch {
      return [];
    }
  });

  const [trending, setTrending] = useState<MovieResult[]>(() => {
    try {
      const c = localStorage.getItem(TRENDING_CACHE_KEY);
      return c ? JSON.parse(c) : [];
    } catch {
      return [];
    }
  });

  const [upcoming, setUpcoming] = useState<MovieResult[]>(() => {
    try {
      const c = localStorage.getItem(UPCOMING_CACHE_KEY);
      return c ? JSON.parse(c) : [];
    } catch {
      return [];
    }
  });

  const [recommendations, setRecommendations] = useState<MovieResult[]>(() => {
    try {
      const c = localStorage.getItem(RECOMMENDATIONS_CACHE_KEY);
      return c ? JSON.parse(c) : [];
    } catch {
      return [];
    }
  });

  const [becauseYouWatched, setBecauseYouWatched] =
    useState<BecauseYouWatchedResponse | null>(() => {
      try {
        const c = localStorage.getItem(BECAUSE_YOU_WATCHED_CACHE_KEY);
        return c ? JSON.parse(c) : null;
      } catch {
        return null;
      }
    });

  const [friendsActivity, setFriendsActivity] = useState<FriendLastWatched[]>(
    () => {
      try {
        const c = localStorage.getItem(FRIENDS_ACTIVITY_CACHE_KEY);
        return c ? JSON.parse(c) : [];
      } catch {
        return [];
      }
    },
  );

  const [favoriteIds, setFavoriteIds] = useState<number[]>(() => {
    try {
      const c = localStorage.getItem(FAVORITES_CACHE_KEY);
      return c ? JSON.parse(c) : [];
    } catch {
      return [];
    }
  });

  const [addedIds, setAddedIds] = useState<number[]>(() => {
    try {
      const c = localStorage.getItem(ADDED_CACHE_KEY);
      return c ? JSON.parse(c) : [];
    } catch {
      return [];
    }
  });

  const [watchedIds, setWatchedIds] = useState<number[]>([]);
  const [isLoadingHome, setIsLoadingHome] = useState(trending.length === 0);
  const [isSearching, setIsSearching] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [filters, setFilters] = useState<SmartSearchFilters>(() => {
    try {
      const timestamp = localStorage.getItem(SEARCH_TIMESTAMP_KEY);
      if (timestamp && Date.now() - parseInt(timestamp) < CACHE_EXPIRATION_MS) {
        const cached = localStorage.getItem(FILTERS_CACHE_KEY);
        return cached ? JSON.parse(cached) : {};
      }
      return {};
    } catch {
      return {};
    }
  });
  const [showFilters, setShowFilters] = useState(() => {
    try {
      const timestamp = localStorage.getItem(SEARCH_TIMESTAMP_KEY);
      if (timestamp && Date.now() - parseInt(timestamp) < CACHE_EXPIRATION_MS) {
        return localStorage.getItem(SHOW_FILTERS_CACHE_KEY) === "true";
      }
      return false;
    } catch {
      return false;
    }
  });
  const [similarToTitle, setSimilarToTitle] = useState<string | null>(null);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [swipeStatus, setSwipeStatus] = useState<SwipeStatus | null>(null);
  const { t } = useLang();
  const navigate = useNavigate();
  const location = useLocation();

  const [visibleCount, setVisibleCount] = useState(20);

  const handleFindSimilar = (movie: MovieResult) => {
    navigate("/search", {
      state: {
        similarTo: {
          tmdbId: movie.id,
          mediaType: movie.mediaType,
          title: movie.title,
        },
      },
    });
  };

  useEffect(() => {
    const state = location.state as {
      similarTo?: { tmdbId: number; mediaType: string; title: string };
    } | null;
    if (!state?.similarTo) return;

    const { tmdbId, title } = state.similarTo;
    setFilters({});
    setShowFilters(false);
    setSearchQuery("");
    setSimilarToTitle(title);
    setIsSearching(true);

    moviesApi
      .findSimilarMoviesSemantic(tmdbId)
      .then((response) => setResults(response))
      .catch((error: unknown) => console.error(error))
      .finally(() => setIsSearching(false));

    navigate(location.pathname, { replace: true, state: null });
  }, [location.state]);

  const visibleRecommendations = recommendations
    .filter((movie) => !addedIds.includes(movie.id))
    .slice(0, 20);

  const visibleBecauseYouWatched = becauseYouWatched
    ? becauseYouWatched.similarMovies.filter(
        (movie) => !watchedIds.includes(movie.id),
      )
    : [];

  useEffect(() => {
    localStorage.setItem(ADDED_CACHE_KEY, JSON.stringify(addedIds));
  }, [addedIds]);

  const prevAddedLengthRef = useRef<number>(addedIds.length);

  useEffect(() => {
    const prev = prevAddedLengthRef.current;
    prevAddedLengthRef.current = addedIds.length;

    if (addedIds.length <= prev) return;

    localStorage.removeItem(RECOMMENDATIONS_CACHE_KEY);

    moviesApi
      .getRecommendations()
      .then((res) => {
        if (res?.length > 0) {
          setRecommendations(res);
          localStorage.setItem(RECOMMENDATIONS_CACHE_KEY, JSON.stringify(res));
        }
      })
      .catch(() => {});
  }, [addedIds.length]);

  useEffect(() => {
    swipeApi
      .getSwipeStatus()
      .then(setSwipeStatus)
      .catch(() => {});
  }, []);

  useEffect(() => {
    setVisibleCount(20);
  }, [results]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((prev) => prev + 20);
        }
      },
      { threshold: 0.1 },
    );

    const target = document.getElementById("load-more-trigger");
    if (target) observer.observe(target);

    return () => observer.disconnect();
  }, [results, visibleCount]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [
          trendingData,
          profileData,
          recsData,
          upcomingData,
          becauseYouWatchedData,
          friendsActivityData,
        ] = await Promise.all([
          moviesApi.getTrending().catch(() => []),
          moviesApi.getProfile().catch(() => null),
          moviesApi.getRecommendations().catch(() => []),
          moviesApi.getUpcoming().catch(() => []),
          moviesApi.getBecauseYouWatched().catch(() => null),
          usersApi.getFriendsLastWatched().catch(() => []),
        ]);

        if (trendingData?.length > 0) {
          setTrending(trendingData);
          localStorage.setItem(
            TRENDING_CACHE_KEY,
            JSON.stringify(trendingData),
          );
        }
        if (upcomingData?.length > 0) {
          setUpcoming(upcomingData);
          localStorage.setItem(
            UPCOMING_CACHE_KEY,
            JSON.stringify(upcomingData),
          );
        }
        if (recsData?.length > 0) {
          setRecommendations(recsData);
          localStorage.setItem(
            RECOMMENDATIONS_CACHE_KEY,
            JSON.stringify(recsData),
          );
        }
        setBecauseYouWatched(becauseYouWatchedData);
        if (becauseYouWatchedData) {
          localStorage.setItem(
            BECAUSE_YOU_WATCHED_CACHE_KEY,
            JSON.stringify(becauseYouWatchedData),
          );
        } else {
          localStorage.removeItem(BECAUSE_YOU_WATCHED_CACHE_KEY);
        }
        setFriendsActivity(friendsActivityData);
        localStorage.setItem(
          FRIENDS_ACTIVITY_CACHE_KEY,
          JSON.stringify(friendsActivityData),
        );
        if (profileData) {
          const profile = profileData as ProfileResponse;
          const favs = profile.favorites?.map((f) => f.tmdbId) || [];
          const watched = profile.watchedIds || [];
          const inPlans = profile.inPlansIds || [];

          setFavoriteIds(favs);
          setWatchedIds(watched);
          setAddedIds(Array.from(new Set([...favs, ...watched, ...inPlans])));
          localStorage.setItem(FAVORITES_CACHE_KEY, JSON.stringify(favs));
        }
      } catch (error) {
        console.error("Error fetching background data:", error);
      } finally {
        setIsLoadingHome(false);
      }
    };
    fetchData();
  }, []);

  useEffect(() => {
    localStorage.setItem(SEARCH_QUERY_CACHE_KEY, searchQuery);
    localStorage.setItem(SEARCH_TIMESTAMP_KEY, Date.now().toString());
  }, [searchQuery]);

  useEffect(() => {
    localStorage.setItem(FILTERS_CACHE_KEY, JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    localStorage.setItem(SHOW_FILTERS_CACHE_KEY, String(showFilters));
  }, [showFilters]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchSearchHistory = () => {
    usersApi
      .getSearchHistory()
      .then((items) => setSearchHistory(items.map((item) => item.queryText)))
      .catch(() => {});
  };

  const handleClearSearchHistory = async () => {
    setSearchHistory([]);
    try {
      await usersApi.clearSearchHistory();
      showToast(t("search_history_cleared"));
    } catch {
      fetchSearchHistory();
    }
  };

  useEffect(() => {
    fetchSearchHistory();
  }, []);

  const hasActiveFilters = Object.values(filters).some(
    (v) => v !== undefined && v !== false,
  );

  const top100MoviesBackdrop = [...trending, ...upcoming].find(
    (item) => item.mediaType === "movie" && item.posterUrl,
  );
  const top100TvBackdrop = [...trending, ...upcoming].find(
    (item) => item.mediaType === "tv" && item.posterUrl,
  );

  const handleSearch = async (eOrQuery?: React.FormEvent | string) => {
    const queryOverride = typeof eOrQuery === "string" ? eOrQuery : undefined;
    if (eOrQuery && typeof eOrQuery !== "string") eOrQuery.preventDefault();

    const query = queryOverride ?? searchQuery;
    if (!query.trim()) return;
    if (queryOverride !== undefined) setSearchQuery(queryOverride);

    setIsSearching(true);
    try {
      setSimilarToTitle(null);
      const response = hasActiveFilters
        ? await moviesApi.smartSearchMovies(query, filters)
        : await moviesApi.searchMovies({ title: query });
      setResults(response);
      localStorage.setItem(SEARCH_RESULTS_CACHE_KEY, JSON.stringify(response));
      localStorage.setItem(SEARCH_TIMESTAMP_KEY, Date.now().toString());
      fetchSearchHistory();
    } catch (error: unknown) {
      console.error(error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setResults([]);
    setSimilarToTitle(null);
    setFilters({});
    setShowFilters(false);
    localStorage.removeItem(SEARCH_QUERY_CACHE_KEY);
    localStorage.removeItem(SEARCH_RESULTS_CACHE_KEY);
    localStorage.removeItem(SEARCH_TIMESTAMP_KEY);
    localStorage.removeItem(FILTERS_CACHE_KEY);
    localStorage.removeItem(SHOW_FILTERS_CACHE_KEY);
  };

  const handleAdd = async (movie: MovieResult) => {
    try {
      await moviesApi.addToWatchlist({
        tmdbId: movie.id,
        title: movie.title,
        posterUrl: movie.posterUrl,
        mediaType: movie.mediaType,
        releaseDate: movie.releaseDate,
      });

      setAddedIds((prev) => Array.from(new Set([...prev, movie.id])));
      localStorage.removeItem(RECOMMENDATIONS_CACHE_KEY);
      showToast(t("search_added_toast"));
    } catch (error: unknown) {
      const apiError = error as { response?: { status?: number } };
      if (apiError.response?.status === 400) {
        setAddedIds((prev) => Array.from(new Set([...prev, movie.id])));
      } else {
        showToast(t("search_add_error"));
      }
    }
  };

  const handleRemove = async (movie: MovieResult) => {
    try {
      await moviesApi.removeFromWatchlist(movie.id);
      setAddedIds((prev) => prev.filter((id) => id !== movie.id));
      setFavoriteIds((prev) => prev.filter((id) => id !== movie.id));
      localStorage.setItem(
        FAVORITES_CACHE_KEY,
        JSON.stringify(favoriteIds.filter((id) => id !== movie.id)),
      );
      showToast(t("search_removed"));
    } catch {
      showToast(t("search_remove_error"));
    }
  };

  const handleToggleFavorite = async (movie: MovieResult) => {
    if (!isReleased(movie)) {
      showToast(t("search_fav_unreleased"));
      return;
    }
    const isFav = favoriteIds.includes(movie.id);
    try {
      await moviesApi.toggleFavorite(movie.id);
      const newIds = isFav
        ? favoriteIds.filter((id) => id !== movie.id)
        : [...favoriteIds, movie.id];
      setFavoriteIds(newIds);
      localStorage.setItem(FAVORITES_CACHE_KEY, JSON.stringify(newIds));
      if (!isFav)
        setAddedIds((prev) => Array.from(new Set([...prev, movie.id])));
      showToast(t("search_fav_updated"));
    } catch (error: unknown) {
      const apiError = error as { response?: { status?: number } };
      if (apiError.response?.status === 404 && !isFav) {
        try {
          await moviesApi.addToWatchlist({
            tmdbId: movie.id,
            title: movie.title,
            posterUrl: movie.posterUrl,
            mediaType: movie.mediaType,
          });
          await moviesApi.toggleFavorite(movie.id);
          const newIds = [...favoriteIds, movie.id];
          setFavoriteIds(newIds);
          setAddedIds((prev) => Array.from(new Set([...prev, movie.id])));
          localStorage.setItem(FAVORITES_CACHE_KEY, JSON.stringify(newIds));
          showToast(t("search_fav_added"));
        } catch {
          showToast(t("search_fav_error"));
        }
      } else {
        showToast(t("search_fav_error2"));
      }
    }
  };

  const renderMovieGrid = (movies: MovieResult[]) => (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
        {movies.slice(0, visibleCount).map((movie) => (
          <MovieCard
            key={movie.id}
            movie={movie}
            favoriteIds={favoriteIds}
            addedIds={addedIds}
            onToggleFavorite={handleToggleFavorite}
            onAdd={handleAdd}
            onRemove={handleRemove}
            onFindSimilar={handleFindSimilar}
            watchedIds={watchedIds}
          />
        ))}
      </div>

      {visibleCount < movies.length && (
        <div
          id="load-more-trigger"
          className="h-20 mt-4 flex justify-center items-center"
        >
          <div className="w-8 h-8 border-4 border-[#14110d] border-t-[#d9ac54] rounded-full animate-spin"></div>
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-[100dvh] bg-[#0f0d0a] font-ui text-[#f2ead9] relative overscroll-none selection:bg-[#d9ac54] selection:text-[#14110c]">
      <div className="sm:hidden sticky top-0 z-40 bg-[#0f0d0a]/95 backdrop-blur-md border-b border-[rgba(217,172,84,.16)] mb-6 pt-[env(safe-area-inset-top)]">
        <header className="flex flex-row items-center justify-between gap-3 py-4 px-4 w-full">
          <Link
            to="/search"
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity shrink-0"
          >
            <span className="font-ui font-bold text-[17px] tracking-[4px] text-[#d9ac54]">
              LUMEN
            </span>
            <LogoIcon />
          </Link>

          <div className="flex items-center gap-2 shrink-0">
            <NotificationBell />
          </div>
        </header>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 pb-24 sm:pb-12 sm:pt-9">
        <div className="flex items-center gap-2 max-w-2xl mx-auto mb-4">
          <form
            onSubmit={handleSearch}
            className="relative flex-1 rounded-full transition-shadow"
          >
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("search_placeholder")}
              className="w-full pl-6 pr-32 py-3.5 sm:py-4 bg-white/[.03] border border-[#d9ac54]/30 rounded-full text-[#f2ead9] placeholder-[#8f8574] focus:outline-none focus:border-[#d9ac54] transition text-sm sm:text-base font-medium tracking-wide"
            />
            <div className="absolute right-2 top-0 bottom-0 flex items-center gap-1">
              {searchQuery.trim() !== "" && (
                <button
                  type="button"
                  onClick={() => setShowFilters((prev) => !prev)}
                  title={t("search_filters_toggle")}
                  className={`w-8 h-8 flex items-center justify-center rounded-full transition ${
                    showFilters || hasActiveFilters
                      ? "text-[#d9ac54] bg-[#d9ac54]/10"
                      : "text-[#8f8574] hover:text-[#d9ac54]"
                  }`}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M3.792 4.5h16.416a1 1 0 01.809 1.588l-6.383 8.628a1.5 1.5 0 00-.29.89v4.394a.75.75 0 01-1.08.68l-3.048-1.39a1.5 1.5 0 01-.82-1.28v-2.404a1.5 1.5 0 00-.29-.89L2.983 6.088A1 1 0 013.792 4.5z"
                    />
                  </svg>
                </button>
              )}
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="w-8 h-8 flex items-center justify-center rounded-full text-[#8f8574] hover:text-[#d9ac54] transition text-sm"
                >
                  ✕
                </button>
              )}
              <button
                type="submit"
                disabled={isSearching || !searchQuery.trim()}
                className="px-4 sm:px-6 h-10 flex items-center gap-1.5 bg-[#d9ac54] hover:bg-[#e8c377] text-[#14110c] rounded-full font-bold transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 text-xs sm:text-sm uppercase tracking-[2px] mr-1"
              >
                {isSearching ? "..." : t("search_find")}
              </button>
            </div>
          </form>
          <Link
            to="/discover"
            title={t("nav_discover")}
            className="relative shrink-0 w-11 h-11 sm:w-auto sm:h-12 sm:pl-3.5 sm:pr-5 rounded-full border border-[#d9ac54]/45 hover:bg-[#d9ac54]/10 flex items-center justify-center sm:justify-start gap-2.5 transition"
          >
            <DiscoverStackIcon />
            <span className="hidden sm:flex flex-col gap-0.5 leading-none">
              <span className="font-bold text-[11px] tracking-[2px] text-[#d9ac54] uppercase">
                {t("discover_entry_label")}
              </span>
              {swipeStatus && (
                <span className="font-mono-ui text-[8.5px] tracking-[1px] text-[#8f8574] uppercase">
                  {swipeStatus.dailyLimit - swipeStatus.remainingToday} /{" "}
                  {swipeStatus.dailyLimit} {t("discover_today")}
                </span>
              )}
            </span>
            {!!swipeStatus?.remainingToday && (
              <span className="sm:hidden absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-[#d9ac54] ring-2 ring-[#0f0d0a] flex items-center justify-center text-[9px] font-bold text-[#14110c]">
                {swipeStatus.remainingToday}
              </span>
            )}
            {!!swipeStatus?.remainingToday && (
              <span className="hidden sm:block absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[#d9ac54] ring-2 ring-[#0f0d0a]" />
            )}
          </Link>
        </div>

        {swipeStatus?.showPromo && (
          <Link
            to="/discover"
            className="max-w-2xl mx-auto mb-8 flex items-center gap-3.5 px-5 py-3.5 rounded-xl border border-[#d9ac54]/20 hover:border-[#d9ac54]/45 bg-[radial-gradient(120%_120%_at_0%_0%,rgba(217,172,84,.07),transparent)] transition"
          >
            <DiscoverStackIcon />
            <span className="flex-1 min-w-0 flex flex-col gap-0.5">
              <span className="font-semibold text-[13px] text-[#f2ead9]">
                {t("discover_promo_title")}
              </span>
              <span className="text-[11.5px] text-[#8f8574] truncate">
                {t("discover_promo_swipe")}- {swipeStatus.remainingToday}{" "}
                {t("discover_promo_of")} {swipeStatus.dailyLimit}{" "}
                {t("discover_promo_remaining")}
              </span>
            </span>
            <span className="shrink-0 font-bold text-[11px] tracking-[2px] text-[#d9ac54] uppercase">
              {t("discover_entry_label")} →
            </span>
          </Link>
        )}

        {searchHistory.length > 0 &&
          !isSearching &&
          results.length === 0 &&
          searchQuery.trim() === "" && (
            <div className="max-w-2xl mx-auto mb-8 flex flex-wrap items-center justify-center gap-2">
              <span className="font-mono-ui text-[10px] font-medium tracking-[2px] text-[#645c4d] uppercase mr-1">
                {t("search_recent_label")}
              </span>
              {searchHistory.map((query) => (
                <button
                  key={query}
                  type="button"
                  onClick={() => handleSearch(query)}
                  className="px-3.5 py-1.5 rounded-full text-[11.5px] text-[#c9c0ac] border border-white/[.12] hover:border-[#d9ac54]/45 hover:text-[#d9ac54] transition"
                >
                  {query}
                </button>
              ))}
              <button
                type="button"
                onClick={handleClearSearchHistory}
                className="ml-1 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider text-[#d9ac54] border border-[#d9ac54]/50 hover:bg-[#d9ac54]/10 hover:border-[#d9ac54] transition"
              >
                ✕ {t("search_clear_recent")}
              </button>
            </div>
          )}

        {showFilters && searchQuery.trim() !== "" && (
          <div className="max-w-3xl mx-auto">
            <SearchFilterBar filters={filters} onChange={setFilters} />
          </div>
        )}

        <main>
          {!isSearching &&
            results.length === 0 &&
            searchQuery.trim() === "" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mb-10">
                <Link
                  to="/top100/movie"
                  className="relative group overflow-hidden rounded-[10px] aspect-[16/9] bg-[#14110d] transition-shadow duration-300 hover:shadow-[0_0_0_1px_rgba(217,172,84,.5)]"
                >
                  {top100MoviesBackdrop?.posterUrl && (
                    <img
                      src={top100MoviesBackdrop.posterUrl}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-55 group-hover:scale-105 transition-all duration-700"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-r from-[#0f0d0a] via-[#0f0d0a]/40 to-transparent" />
                  <div className="relative z-10 flex flex-col items-start gap-2 h-full justify-end p-5 sm:p-8">
                    <span className="font-mono-ui text-[9px] sm:text-[9.5px] font-semibold tracking-[2.5px] text-[#d9ac54] border border-[#d9ac54]/45 rounded-full px-3 py-1">
                      {t("search_collection_tag").toUpperCase()}
                    </span>
                    <h3 className="text-[#f2ead9] font-bold text-xl sm:text-3xl leading-none -tracking-[.3px]">
                      {t("top100_movies")}
                    </h3>
                    <p className="text-[#8f8574] text-[11px] sm:text-[12.5px] font-medium">
                      {t("search_all_time")}
                    </p>
                  </div>
                  <span className="absolute right-5 sm:right-6 bottom-5 sm:bottom-6 text-lg sm:text-xl font-semibold text-[#d9ac54] z-10">
                    →
                  </span>
                </Link>

                <Link
                  to="/top100/tv"
                  className="relative group overflow-hidden rounded-[10px] aspect-[16/9] bg-[#14110d] transition-shadow duration-300 hover:shadow-[0_0_0_1px_rgba(217,172,84,.5)]"
                >
                  {top100TvBackdrop?.posterUrl && (
                    <img
                      src={top100TvBackdrop.posterUrl}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-55 group-hover:scale-105 transition-all duration-700"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-r from-[#0f0d0a] via-[#0f0d0a]/40 to-transparent" />
                  <div className="relative z-10 flex flex-col items-start gap-2 h-full justify-end p-5 sm:p-8">
                    <span className="font-mono-ui text-[9px] sm:text-[9.5px] font-semibold tracking-[2.5px] text-[#d9ac54] border border-[#d9ac54]/45 rounded-full px-3 py-1">
                      {t("search_curated_tag").toUpperCase()}
                    </span>
                    <h3 className="text-[#f2ead9] font-bold text-xl sm:text-3xl leading-none -tracking-[.3px]">
                      {t("top100_tv")}
                    </h3>
                    <p className="text-[#8f8574] text-[11px] sm:text-[12.5px] font-medium">
                      {t("search_highest_rated")}
                    </p>
                  </div>
                  <span className="absolute right-5 sm:right-6 bottom-5 sm:bottom-6 text-lg sm:text-xl font-semibold text-[#d9ac54] z-10">
                    →
                  </span>
                </Link>
              </div>
            )}
          {results.length > 0 ? (
            <>
              <div className="relative flex justify-between items-center mb-6 pb-3">
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-[#d9ac54]/50 via-[#d9ac54]/10 to-transparent" />
                <h2 className="text-xs sm:text-sm font-black text-[#d9ac54] uppercase tracking-widest">
                  {similarToTitle
                    ? `${t("search_similar_to")} "${similarToTitle}"`
                    : t("search_results")}
                </h2>
                <button
                  onClick={handleClearSearch}
                  className="text-[10px] sm:text-xs font-bold text-[#f2ead9]/60 hover:text-[#d9ac54] transition uppercase tracking-wider"
                >
                  {t("common_go_back")}
                </button>
              </div>
              {renderMovieGrid(results)}
            </>
          ) : searchQuery.trim() !== "" ? (
            !isSearching && (
              <div className="text-center mt-10 border border-[#d9ac54]/20 glass-panel p-10 rounded-3xl max-w-sm mx-auto shadow-2xl">
                <p className="text-[#f2ead9]/60 text-lg mb-6 font-semibold">
                  {t("search_empty")}
                </p>
                <button
                  onClick={handleClearSearch}
                  className="text-sm font-bold text-[#d9ac54] hover:text-[#e8c377] transition uppercase tracking-widest"
                >
                  {t("common_go_back")}
                </button>
              </div>
            )
          ) : (
            <div className="space-y-12">
              <MovieCarousel
                title={t("search_trending")}
                badge={t("search_hot")}
                badgeClass="font-mono-ui text-[8.5px] font-bold tracking-[1.5px] text-[#e0554d] border border-[#e0554d]/45 rounded-full px-2 py-1"
                movies={trending}
                isLoading={isLoadingHome && trending.length === 0}
                fallback={
                  <div className="flex justify-center items-center h-40">
                    <div className="flex gap-2">
                      {[0, 0.1, 0.2].map((delay, i) => (
                        <div
                          key={i}
                          className="w-2.5 h-2.5 bg-[#d9ac54] rounded-full animate-bounce"
                          style={{ animationDelay: `${delay}s` }}
                        />
                      ))}
                    </div>
                  </div>
                }
                emptyElement={
                  <p className="text-[#f2ead9]/50 text-center text-sm">
                    {t("search_failed_trends")}
                  </p>
                }
                favoriteIds={favoriteIds}
                addedIds={addedIds}
                watchedIds={watchedIds}
                onToggleFavorite={handleToggleFavorite}
                onAdd={handleAdd}
                onRemove={handleRemove}
                onFindSimilar={handleFindSimilar}
              />

              <MovieCarousel
                title={t("search_coming_soon")}
                badge={t("search_new")}
                badgeClass="font-mono-ui text-[8.5px] font-bold tracking-[1.5px] text-[#d9ac54] border border-[#d9ac54]/45 rounded-full px-2 py-1"
                movies={upcoming.slice(0, 10)}
                isLoading={isLoadingHome && upcoming.length === 0}
                fallback={
                  <div className="flex justify-center items-center h-24">
                    <p className="text-[#f2ead9]/50 animate-pulse text-xs sm:text-sm font-semibold uppercase tracking-widest">
                      {t("search_failed_trends")}
                    </p>
                  </div>
                }
                favoriteIds={favoriteIds}
                addedIds={addedIds}
                watchedIds={watchedIds}
                onToggleFavorite={handleToggleFavorite}
                onAdd={handleAdd}
                onRemove={handleRemove}
                onFindSimilar={handleFindSimilar}
              />

              <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
                <div className="flex-[2.2] min-w-0">
                  <MovieCarousel
                    title={t("chat_recommended")}
                    badge="AI"
                    badgeClass="font-mono-ui text-[8.5px] font-bold tracking-[1.5px] text-[#d9ac54] border border-[#d9ac54]/45 rounded-full px-2 py-1"
                    movies={visibleRecommendations}
                    isLoading={isLoadingHome && recommendations.length === 0}
                    fallback={
                      <div className="flex justify-center items-center h-24">
                        <p className="text-[#f2ead9]/50 animate-pulse text-xs sm:text-sm font-semibold uppercase tracking-widest">
                          {t("search_ai_curating")}
                        </p>
                      </div>
                    }
                    emptyElement={
                      <div className="text-center p-8 border border-[#d9ac54]/20 rounded-[10px] border-dashed">
                        <p className="text-[#f2ead9]/60 text-sm font-medium">
                          {t("search_ai_empty")}
                        </p>
                      </div>
                    }
                    favoriteIds={favoriteIds}
                    addedIds={addedIds}
                    watchedIds={watchedIds}
                    onToggleFavorite={handleToggleFavorite}
                    onAdd={handleAdd}
                    onRemove={handleRemove}
                    onFindSimilar={handleFindSimilar}
                  />

                  {becauseYouWatched && visibleBecauseYouWatched.length > 0 && (
                    <div className="mt-12">
                      <BecauseYouWatchedCarousel
                        basedOnMovie={becauseYouWatched.basedOnMovie}
                        similarMovies={visibleBecauseYouWatched}
                        favoriteIds={favoriteIds}
                        addedIds={addedIds}
                        watchedIds={watchedIds}
                        onToggleFavorite={handleToggleFavorite}
                        onAdd={handleAdd}
                        onRemove={handleRemove}
                        onFindSimilar={handleFindSimilar}
                      />
                    </div>
                  )}
                </div>

                {friendsActivity.length > 0 && (
                  <>
                    <div className="hidden lg:block w-px bg-[rgba(217,172,84,.16)]" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3.5 mb-4">
                        <span className="font-mono-ui text-[11px] sm:text-[11.5px] font-semibold tracking-[3px] text-[#d9ac54] uppercase whitespace-nowrap">
                          {t("search_friends_activity")}
                        </span>
                        <div className="flex-1 h-px bg-[rgba(217,172,84,.14)]" />
                      </div>
                      <FriendActivityCarousel items={friendsActivity} />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {toastMessage && (
        <div className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-10 bg-[#14110d] border border-[#d9ac54]/50 text-[#d9ac54] uppercase tracking-widest px-6 py-4 rounded-xl shadow-2xl flex items-center justify-center z-50 animate-fade-in">
          <span className="font-bold text-[10px] sm:text-xs text-center">
            {toastMessage}
          </span>
        </div>
      )}
    </div>
  );
}

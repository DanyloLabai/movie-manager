import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import * as moviesApi from "../api/movies.api";
import * as usersApi from "../api/users.api";
import LogoImg from "../assets/logo.png";

import { useLang } from "../context/LanguageContext";
import { MovieCarousel } from "../components/movie/MovieCarousel";
import { BecauseYouWatchedCarousel } from "../components/movie/BecauseYouWatchedCarousel";
import { FriendActivityCarousel } from "../components/movie/FriendActivityCarousel";
import { MovieCard } from "../components/movie/MovieCard";
import NotificationBell from "../components/NotificationBell";
import { SearchFilterBar } from "../components/search/SearchFilterBar";
import type { MovieResult } from "../types/movie.types";
import type { SmartSearchFilters, BecauseYouWatchedResponse } from "../api/movies.api";
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
  const { t } = useLang();
  const navigate = useNavigate();
  const location = useLocation();

  const [visibleCount, setVisibleCount] = useState(20);

  const handleFindSimilar = (movie: MovieResult) => {
    navigate("/search", {
      state: {
        similarTo: { tmdbId: movie.id, mediaType: movie.mediaType, title: movie.title },
      },
    });
  };

  useEffect(() => {
    const state = location.state as
      | { similarTo?: { tmdbId: number; mediaType: string; title: string } }
      | null;
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

  useEffect(() => {
    fetchSearchHistory();
  }, []);

  const hasActiveFilters = Object.values(filters).some(
    (v) => v !== undefined && v !== false,
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
          <div className="w-8 h-8 border-4 border-[#1a1714] border-t-[#c8963c] rounded-full animate-spin"></div>
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-[100dvh] bg-[#12100e] font-sans text-[#f0e6cc] relative overscroll-none selection:bg-[#c8963c] selection:text-[#12100e]">
      <div className="sm:hidden sticky top-0 z-40 bg-[#12100e]/95 backdrop-blur-md border-b border-[#c8963c]/10 mb-6 pt-[env(safe-area-inset-top)]">
        <header className="flex flex-row items-center justify-between gap-3 sm:gap-4 py-4 sm:py-5 px-4 sm:px-8 w-full">
          <Link
            to="/search"
            className="flex items-center gap-3 hover:opacity-80 transition-opacity shrink-0"
          >
            <img
              src={LogoImg}
              alt="LUMEN Logo"
              className="h-10 sm:h-12 w-auto object-contain"
            />
            <div className="flex flex-col justify-center">
              <h1 className="text-2xl sm:text-3xl font-black text-[#c8963c] tracking-widest uppercase leading-none">
                LUMEN
              </h1>
              <span className="text-[7px] sm:text-[8px] text-[#f0e6cc]/70 font-medium uppercase leading-none whitespace-nowrap tracking-[0.5em] sm:tracking-[0.6em] mt-1 block text-justify w-full">
                {t("app_tagline")}
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2 shrink-0">
            <NotificationBell />
          </div>
        </header>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 pb-24 sm:pb-12 sm:pt-10">
        <form
          onSubmit={handleSearch}
          className="relative max-w-2xl mx-auto mb-6 rounded-full transition-shadow focus-within:shadow-[0_0_0_3px_rgba(200,150,60,0.15),0_0_36px_-8px_rgba(200,150,60,0.55)]"
        >
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("search_placeholder")}
            className="w-full pl-6 pr-32 py-3.5 sm:py-4 glass-panel border border-[#c8963c]/30 rounded-full text-[#f0e6cc] placeholder-[#f0e6cc]/30 focus:outline-none focus:border-[#c8963c] shadow-inner transition text-sm sm:text-base font-medium tracking-wide"
          />
          <div className="absolute right-2 top-0 bottom-0 flex items-center gap-1">
            {searchQuery.trim() !== "" && (
              <button
                type="button"
                onClick={() => setShowFilters((prev) => !prev)}
                title={t("search_filters_toggle")}
                className={`w-8 h-8 flex items-center justify-center rounded-full transition ${
                  showFilters || hasActiveFilters
                    ? "text-[#c8963c] bg-[#c8963c]/10"
                    : "text-[#f0e6cc]/50 hover:text-[#c8963c]"
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
                className="w-8 h-8 flex items-center justify-center rounded-full text-[#f0e6cc]/50 hover:text-[#c8963c] transition text-sm"
              >
                ✕
              </button>
            )}
            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="px-4 sm:px-5 h-10 flex items-center gap-1.5 btn-glass btn-glass-gold text-[#12100e] rounded-full font-black transition active:scale-95 disabled:cursor-not-allowed text-xs sm:text-sm uppercase tracking-wider mr-1"
            >
              {isSearching ? (
                "..."
              ) : (
                <>
                  <svg
                    className="w-4 h-4 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                      d="M21 21l-4.35-4.35m0 0a7 7 0 10-9.9-9.9 7 7 0 009.9 9.9z"
                    />
                  </svg>
                  <span>{t("search_find")}</span>
                </>
              )}
            </button>
          </div>
        </form>

        {searchHistory.length > 0 &&
          !isSearching &&
          results.length === 0 &&
          searchQuery.trim() === "" && (
            <div className="max-w-2xl mx-auto mb-6 flex flex-wrap items-center justify-center gap-2">
              <span className="text-[10px] font-bold text-[#f0e6cc]/40 uppercase tracking-widest mr-1">
                {t("search_recent_label")}
              </span>
              {searchHistory.map((query) => (
                <button
                  key={query}
                  type="button"
                  onClick={() => handleSearch(query)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold text-[#f0e6cc]/70 btn-glass btn-glass-dark hover:text-[#c8963c] hover:shadow-[0_0_14px_-3px_rgba(200,150,60,0.6)] transition"
                >
                  {query}
                </button>
              ))}
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
                  className="relative group overflow-hidden rounded-2xl aspect-[16/9] border border-[#c8963c]/30 shadow-xl bg-[#1a1714] transition-all duration-300 hover:border-[#c8963c]/70 hover:scale-[1.01] hover:shadow-[0_0_40px_-10px_rgba(200,150,60,0.55)]"
                >
                  {trending[0]?.posterUrl && (
                    <img
                      src={trending[0].posterUrl}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-55 group-hover:scale-105 transition-all duration-700"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#12100e] via-[#12100e]/70 to-transparent" />
                  <div className="relative z-10 flex flex-col items-start gap-1 sm:gap-2 h-full justify-end p-4 sm:p-6">
                    <span className="bg-[#c8963c]/20 text-[#c8963c] text-[8px] sm:text-[10px] font-bold px-2 py-1 rounded backdrop-blur-sm border border-[#c8963c]/30 uppercase tracking-widest">
                      {t("search_collection_tag")}
                    </span>
                    <h3 className="text-[#f0e6cc] font-black uppercase tracking-wide text-base sm:text-2xl drop-shadow-lg leading-tight">
                      {t("top100_movies")}
                    </h3>
                    <p className="text-[#f0e6cc]/60 text-[10px] sm:text-sm font-semibold">
                      {t("search_all_time")}
                    </p>
                  </div>
                </Link>

                <Link
                  to="/top100/tv"
                  className="relative group overflow-hidden rounded-2xl aspect-[16/9] border border-[#c8963c]/30 shadow-xl bg-[#1a1714] transition-all duration-300 hover:border-[#c8963c]/70 hover:scale-[1.01] hover:shadow-[0_0_40px_-10px_rgba(200,150,60,0.55)]"
                >
                  {upcoming[0]?.posterUrl && (
                    <img
                      src={upcoming[0].posterUrl}
                      alt=""
                      aria-hidden="true"
                      className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-55 group-hover:scale-105 transition-all duration-700"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#12100e] via-[#12100e]/70 to-transparent" />
                  <div className="relative z-10 flex flex-col items-start gap-1 sm:gap-2 h-full justify-end p-4 sm:p-6">
                    <span className="bg-[#c8963c]/20 text-[#c8963c] text-[8px] sm:text-[10px] font-bold px-2 py-1 rounded backdrop-blur-sm border border-[#c8963c]/30 uppercase tracking-widest">
                      {t("search_curated_tag")}
                    </span>
                    <h3 className="text-[#f0e6cc] font-black uppercase tracking-wide text-base sm:text-2xl drop-shadow-lg leading-tight">
                      {t("top100_tv")}
                    </h3>
                    <p className="text-[#f0e6cc]/60 text-[10px] sm:text-sm font-semibold">
                      {t("search_highest_rated")}
                    </p>
                  </div>
                </Link>
              </div>
            )}
          {results.length > 0 ? (
            <>
              <div className="relative flex justify-between items-center mb-6 pb-3">
                <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-[#c8963c]/50 via-[#c8963c]/10 to-transparent" />
                <h2 className="text-xs sm:text-sm font-black text-[#c8963c] uppercase tracking-widest">
                  {similarToTitle
                    ? `${t("search_similar_to")} "${similarToTitle}"`
                    : t("search_results")}
                </h2>
                <button
                  onClick={handleClearSearch}
                  className="text-[10px] sm:text-xs font-bold text-[#f0e6cc]/60 hover:text-[#c8963c] transition uppercase tracking-wider"
                >
                  {t("common_go_back")}
                </button>
              </div>
              {renderMovieGrid(results)}
            </>
          ) : searchQuery.trim() !== "" ? (
            !isSearching && (
              <div className="text-center mt-10 border border-[#c8963c]/20 glass-panel p-10 rounded-3xl max-w-sm mx-auto shadow-2xl">
                <p className="text-[#f0e6cc]/60 text-lg mb-6 font-semibold">
                  {t("search_empty")}
                </p>
                <button
                  onClick={handleClearSearch}
                  className="text-sm font-bold text-[#c8963c] hover:text-[#e8c070] transition uppercase tracking-widest"
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
                badgeClass="bg-red-500/20 text-red-500 text-[8px] sm:text-[10px] font-bold px-2 py-0.5 rounded border border-red-500/30"
                movies={trending}
                isLoading={isLoadingHome && trending.length === 0}
                fallback={
                  <div className="flex justify-center items-center h-40">
                    <div className="flex gap-2">
                      {[0, 0.1, 0.2].map((delay, i) => (
                        <div
                          key={i}
                          className="w-2.5 h-2.5 bg-[#c8963c] rounded-full animate-bounce"
                          style={{ animationDelay: `${delay}s` }}
                        />
                      ))}
                    </div>
                  </div>
                }
                emptyElement={
                  <p className="text-[#f0e6cc]/50 text-center text-sm">
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

              <FriendActivityCarousel items={friendsActivity} />

              <MovieCarousel
                title={t("search_coming_soon")}
                badge={t("search_new")}
                badgeClass="bg-[#c8963c]/20 text-[#c8963c] text-[8px] sm:text-[10px] font-bold px-2 py-0.5 rounded border border-[#c8963c]/30"
                movies={upcoming.slice(0, 10)}
                isLoading={isLoadingHome && upcoming.length === 0}
                fallback={
                  <div className="flex justify-center items-center h-24">
                    <p className="text-[#f0e6cc]/50 animate-pulse text-xs sm:text-sm font-semibold uppercase tracking-widest">
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

              <MovieCarousel
                title={t("chat_recommended")}
                badge="AI"
                badgeClass="bg-[#c8963c]/20 text-[#c8963c] text-[8px] sm:text-[10px] font-bold px-2 py-0.5 rounded border border-[#c8963c]/30"
                movies={visibleRecommendations}
                isLoading={isLoadingHome && recommendations.length === 0}
                fallback={
                  <div className="flex justify-center items-center h-24">
                    <p className="text-[#f0e6cc]/50 animate-pulse text-xs sm:text-sm font-semibold uppercase tracking-widest">
                      {t("search_ai_curating")}
                    </p>
                  </div>
                }
                emptyElement={
                  <div className="text-center p-8 bg-[#1a1714] rounded-2xl border border-[#c8963c]/30 border-dashed">
                    <p className="text-[#f0e6cc]/60 text-sm font-medium">
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
              )}
            </div>
          )}
        </main>
      </div>

      {toastMessage && (
        <div className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-10 bg-[#1a1714] border border-[#c8963c]/50 text-[#c8963c] uppercase tracking-widest px-6 py-4 rounded-xl shadow-2xl flex items-center justify-center z-50 animate-fade-in">
          <span className="font-bold text-[10px] sm:text-xs text-center">
            {toastMessage}
          </span>
        </div>
      )}
    </div>
  );
}

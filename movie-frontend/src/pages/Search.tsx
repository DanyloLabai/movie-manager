import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import * as moviesApi from "../api/movies.api";
import LogoImg from "../assets/logo.png";

import { useLang } from "../context/LanguageContext";
import { MovieCarousel } from "../components/movie/MovieCarousel";
import { BecauseYouWatchedCarousel } from "../components/movie/BecauseYouWatchedCarousel";
import { MovieCard } from "../components/movie/MovieCard";
import NotificationBell from "../components/NotificationBell";
import SettingsMenu from "../components/SettingsMenu";
import { SearchFilterBar } from "../components/search/SearchFilterBar";
import type { MovieResult } from "../types/movie.types";
import type { SmartSearchFilters, BecauseYouWatchedResponse } from "../api/movies.api";

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
  const [mode, setMode] = useState<"search" | "smart">("search");
  const [filters, setFilters] = useState<SmartSearchFilters>({});
  const [similarToTitle, setSimilarToTitle] = useState<string | null>(null);
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
    setMode("smart");
    setFilters({});
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
        ] = await Promise.all([
          moviesApi.getTrending().catch(() => []),
          moviesApi.getProfile().catch(() => null),
          moviesApi.getRecommendations().catch(() => []),
          moviesApi.getUpcoming().catch(() => []),
          moviesApi.getBecauseYouWatched().catch(() => null),
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

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      setSimilarToTitle(null);
      const response =
        mode === "smart"
          ? await moviesApi.smartSearchMovies(searchQuery, filters)
          : await moviesApi.searchMovies({ title: searchQuery });
      setResults(response);
      if (mode === "search") {
        localStorage.setItem(
          SEARCH_RESULTS_CACHE_KEY,
          JSON.stringify(response),
        );
        localStorage.setItem(SEARCH_TIMESTAMP_KEY, Date.now().toString());
      }
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
    localStorage.removeItem(SEARCH_QUERY_CACHE_KEY);
    localStorage.removeItem(SEARCH_RESULTS_CACHE_KEY);
    localStorage.removeItem(SEARCH_TIMESTAMP_KEY);
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
      <div className="sticky top-0 z-40 bg-[#12100e]/95 backdrop-blur-md border-b border-[#c8963c]/10 mb-6 pt-[env(safe-area-inset-top)]">
        <header className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 py-4 sm:py-5 px-4 sm:px-8 w-full">
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

          <nav className="hidden sm:flex items-center gap-2 sm:gap-8 overflow-x-auto w-full sm:w-auto pb-1 scrollbar-hide justify-center sm:justify-end">
            <Link
              to="/ai-chat"
              className="text-[#f0e6cc]/60 hover:text-[#c8963c] transition-colors text-xs sm:text-sm px-1 tracking-wide uppercase font-semibold whitespace-nowrap flex-shrink-0"
            >
              {t("nav_ai_chat")}
            </Link>
            <Link
              to="/search"
              className="text-[#c8963c] font-bold border-b-2 border-[#c8963c] transition-all text-xs sm:text-sm px-1 tracking-wide uppercase whitespace-nowrap flex-shrink-0"
            >
              {t("nav_search")}
            </Link>
            <Link
              to="/watchlist"
              className="text-[#f0e6cc]/60 hover:text-[#c8963c] transition-colors text-xs sm:text-sm px-1 tracking-wide uppercase font-semibold whitespace-nowrap flex-shrink-0"
            >
              {t("nav_profile")}
            </Link>

            <NotificationBell />
            <SettingsMenu />
          </nav>
        </header>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 pb-24 sm:pb-12">
        <div className="flex justify-center gap-2 mb-4">
          <button
            type="button"
            onClick={() => setMode("search")}
            className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition border ${
              mode === "search"
                ? "bg-[#c8963c] text-[#12100e] border-[#c8963c]"
                : "bg-transparent text-[#f0e6cc]/60 border-[#c8963c]/30 hover:border-[#c8963c]"
            }`}
          >
            {t("search_mode_basic")}
          </button>
          <button
            type="button"
            onClick={() => setMode("smart")}
            className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition border ${
              mode === "smart"
                ? "bg-[#c8963c] text-[#12100e] border-[#c8963c]"
                : "bg-transparent text-[#f0e6cc]/60 border-[#c8963c]/30 hover:border-[#c8963c]"
            }`}
          >
            {t("search_mode_smart")}
          </button>
        </div>

        <form
          onSubmit={handleSearch}
          className="relative max-w-2xl mx-auto mb-6"
        >
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              mode === "smart"
                ? t("search_smart_placeholder")
                : t("search_placeholder")
            }
            className="w-full pl-6 pr-24 py-3.5 sm:py-4 bg-[#1a1714] border border-[#c8963c]/30 rounded-full text-[#f0e6cc] placeholder-[#f0e6cc]/30 focus:outline-none focus:border-[#c8963c] shadow-inner transition text-sm sm:text-base font-medium tracking-wide"
          />
          <div className="absolute right-2 top-0 bottom-0 flex items-center gap-1">
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
              className="px-5 h-10 bg-[#c8963c] text-[#12100e] rounded-full font-black hover:bg-[#e8c070] transition active:scale-95 disabled:bg-[#2a241f] disabled:text-[#c8963c]/30 text-xs sm:text-sm shadow uppercase tracking-wider mr-1"
            >
              {isSearching ? "..." : t("search_find")}
            </button>
          </div>
        </form>

        {mode === "smart" && (
          <div className="max-w-3xl mx-auto">
            <SearchFilterBar filters={filters} onChange={setFilters} />
          </div>
        )}

        <main>
          {!isSearching &&
            results.length === 0 &&
            searchQuery.trim() === "" && (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-10">
                <Link
                  to="/top100/movie"
                  className="relative group overflow-hidden rounded-2xl aspect-[16/9] sm:aspect-[21/9] border border-[#c8963c]/30 shadow-xl bg-[#12100e]"
                >
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#c8963c]/20 via-[#1a1714] to-[#12100e] group-hover:scale-105 transition-transform duration-700" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center z-10">
                    <h3 className="text-[#c8963c] font-black uppercase tracking-widest text-xs sm:text-lg drop-shadow-lg">
                      {t("top100_movies")}
                    </h3>
                    <p className="text-[#f0e6cc]/50 text-[7px] sm:text-[10px] font-bold uppercase tracking-widest mt-1">
                      {t("search_all_time")}
                    </p>
                  </div>
                </Link>

                <Link
                  to="/top100/tv"
                  className="relative group overflow-hidden rounded-2xl aspect-[16/9] sm:aspect-[21/9] border border-[#c8963c]/30 shadow-xl bg-[#12100e]"
                >
                  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-[#c8963c]/20 via-[#1a1714] to-[#12100e] group-hover:scale-105 transition-transform duration-700" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center z-10">
                    <h3 className="text-[#c8963c] font-black uppercase tracking-widest text-xs sm:text-lg drop-shadow-lg">
                      {t("top100_tv")}
                    </h3>
                    <p className="text-[#f0e6cc]/50 text-[7px] sm:text-[10px] font-bold uppercase tracking-widest mt-1">
                      {t("search_highest_rated")}
                    </p>
                  </div>
                </Link>
              </div>
            )}
          {results.length > 0 ? (
            <>
              <div className="flex justify-between items-center mb-6 border-b border-[#c8963c]/20 pb-3">
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
              <div className="text-center mt-10 border border-[#c8963c]/20 bg-[#1a1714] p-10 rounded-3xl max-w-sm mx-auto shadow-2xl">
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
              />

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
              />

              {becauseYouWatched && (
                <BecauseYouWatchedCarousel
                  basedOnMovie={becauseYouWatched.basedOnMovie}
                  similarMovies={becauseYouWatched.similarMovies}
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

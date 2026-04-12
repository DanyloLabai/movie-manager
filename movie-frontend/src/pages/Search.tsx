import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api";

interface MovieResult {
  id: number;
  title: string;
  description: string;
  releaseYear: string;
  releaseDate?: string;
  rating: number;
  posterUrl: string | null;
  mediaType: "movie" | "tv";
}

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
const SEARCH_TIMESTAMP_KEY = `search_timestamp_${uid}`;
const ADDED_CACHE_KEY = `added_cache_${uid}`;

const CACHE_EXPIRATION_MS =
  Number(import.meta.env.VITE_CACHE_EXPIRATION_MS) || 24 * 60 * 60 * 1000;

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

  const [isLoadingHome, setIsLoadingHome] = useState(trending.length === 0);
  const [isSearching, setIsSearching] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.setItem(ADDED_CACHE_KEY, JSON.stringify(addedIds));
  }, [addedIds]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [trendingRes, profileRes, recsRes, upcomingRes] =
          await Promise.all([
            api.get("/movies/trending").catch(() => ({ data: [] })),
            api.get("/movies/profile").catch(() => ({ data: null })),
            api.get("/movies/recommendations").catch(() => ({ data: [] })),
            api.get("/movies/upcoming").catch(() => ({ data: [] })),
          ]);
        if (trendingRes.data?.length > 0) {
          setTrending(trendingRes.data);
          localStorage.setItem(
            TRENDING_CACHE_KEY,
            JSON.stringify(trendingRes.data),
          );
        }
        if (upcomingRes.data?.length > 0) {
          setUpcoming(upcomingRes.data);
          localStorage.setItem(
            UPCOMING_CACHE_KEY,
            JSON.stringify(upcomingRes.data),
          );
        }
        if (recsRes.data?.length > 0) {
          setRecommendations(recsRes.data);
          localStorage.setItem(
            RECOMMENDATIONS_CACHE_KEY,
            JSON.stringify(recsRes.data),
          );
        }
        if (profileRes.data) {
          const favs =
            profileRes.data.favorites?.map((f: any) => f.tmdbId) || [];
          const recent =
            profileRes.data.recent?.map((r: any) => r.tmdbId) || [];
          setFavoriteIds(favs);
          setAddedIds(Array.from(new Set([...favs, ...recent])));
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

  const isReleased = (movie: MovieResult) => {
    if (movie.releaseDate) return new Date(movie.releaseDate) <= new Date();
    if (movie.releaseYear && movie.releaseYear !== "N/A")
      return parseInt(movie.releaseYear) <= new Date().getFullYear();
    return true;
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const response = await api.get("/movies/search", {
        params: { title: searchQuery },
      });
      setResults(response.data);
      localStorage.setItem(
        SEARCH_RESULTS_CACHE_KEY,
        JSON.stringify(response.data),
      );
      localStorage.setItem(SEARCH_TIMESTAMP_KEY, Date.now().toString());
    } catch (error) {
      console.error(error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setResults([]);
    localStorage.removeItem(SEARCH_QUERY_CACHE_KEY);
    localStorage.removeItem(SEARCH_RESULTS_CACHE_KEY);
    localStorage.removeItem(SEARCH_TIMESTAMP_KEY);
  };

  const handleAdd = async (movie: MovieResult) => {
    try {
      await api.post("/movies/watchlist", {
        tmdbId: movie.id,
        title: movie.title,
        posterUrl: movie.posterUrl,
        mediaType: movie.mediaType,
        releaseDate: movie.releaseDate,
      });
      setAddedIds((prev) => Array.from(new Set([...prev, movie.id])));
      showToast("Added to list");
    } catch (error: any) {
      if (error.response?.status === 400)
        setAddedIds((prev) => Array.from(new Set([...prev, movie.id])));
      else showToast("Error adding movie");
    }
  };

  const handleRemove = async (movie: MovieResult) => {
    try {
      await api.delete(`/movies/watchlist/${movie.id}`);
      setAddedIds((prev) => prev.filter((id) => id !== movie.id));
      setFavoriteIds((prev) => prev.filter((id) => id !== movie.id));
      localStorage.setItem(
        FAVORITES_CACHE_KEY,
        JSON.stringify(favoriteIds.filter((id) => id !== movie.id)),
      );
      showToast("Removed from list");
    } catch {
      showToast("Error removing movie");
    }
  };

  const handleToggleFavorite = async (movie: MovieResult) => {
    if (!isReleased(movie)) {
      showToast("You can't favorite an unreleased movie!");
      return;
    }
    const isFav = favoriteIds.includes(movie.id);
    try {
      await api.patch(`/movies/watchlist/${movie.id}/favorite`);
      const newIds = isFav
        ? favoriteIds.filter((id) => id !== movie.id)
        : [...favoriteIds, movie.id];
      setFavoriteIds(newIds);
      localStorage.setItem(FAVORITES_CACHE_KEY, JSON.stringify(newIds));
      if (!isFav)
        setAddedIds((prev) => Array.from(new Set([...prev, movie.id])));
      showToast("Favorite status updated");
    } catch (error: any) {
      if (error.response?.status === 404 && !isFav) {
        try {
          await api.post("/movies/watchlist", {
            tmdbId: movie.id,
            title: movie.title,
            posterUrl: movie.posterUrl,
            mediaType: movie.mediaType,
          });
          await api.patch(`/movies/watchlist/${movie.id}/favorite`);
          const newIds = [...favoriteIds, movie.id];
          setFavoriteIds(newIds);
          setAddedIds((prev) => Array.from(new Set([...prev, movie.id])));
          localStorage.setItem(FAVORITES_CACHE_KEY, JSON.stringify(newIds));
          showToast("Added to list and favorites");
        } catch {
          showToast("Failed to favorite movie");
        }
      } else {
        showToast("Failed to update favorite status");
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    [
      TRENDING_CACHE_KEY,
      UPCOMING_CACHE_KEY,
      FAVORITES_CACHE_KEY,
      SEARCH_QUERY_CACHE_KEY,
      SEARCH_RESULTS_CACHE_KEY,
      SEARCH_TIMESTAMP_KEY,
      RECOMMENDATIONS_CACHE_KEY,
      ADDED_CACHE_KEY,
    ].forEach((k) => localStorage.removeItem(k));
    navigate("/login");
  };

  const renderMovieGrid = (movies: MovieResult[]) => (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
      {movies.map((movie) => {
        const released = isReleased(movie);
        return (
          <div
            key={movie.id}
            className="group relative overflow-hidden bg-[#1a1714] border border-[#c8963c]/20 shadow rounded-xl flex flex-col hover:border-[#c8963c]/70 hover:-translate-y-0.5 transition"
          >
            {released ? (
              <button
                className="absolute top-1.5 left-1.5 z-10 w-7 h-7 flex items-center justify-center bg-[#12100e]/80 rounded-full backdrop-blur-sm border border-[#c8963c]/30 transition group/heart"
                onClick={() => handleToggleFavorite(movie)}
              >
                <svg
                  className={`w-3 h-3 transition ${favoriteIds.includes(movie.id) ? "text-red-500 fill-red-500" : "text-[#f0e6cc]/30 group-hover/heart:text-red-500"}`}
                  fill={
                    favoriteIds.includes(movie.id) ? "currentColor" : "none"
                  }
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
              </button>
            ) : (
              <div className="absolute top-1.5 left-1.5 z-10 w-7 h-7 flex items-center justify-center bg-[#12100e]/90 rounded-full border border-[#c8963c]/50 text-[#c8963c] text-[11px]">
                ⏳
              </div>
            )}

            <Link
              to={`/movie/${movie.id}?type=${movie.mediaType}`}
              className="relative w-full aspect-[2/3] bg-[#12100e] block overflow-hidden"
            >
              {movie.posterUrl ? (
                <img
                  src={movie.posterUrl}
                  alt={movie.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="flex items-center justify-center w-full h-full text-[9px] text-[#f0e6cc]/30">
                  No poster
                </div>
              )}
            </Link>

            <div className="p-2.5 flex flex-col flex-grow bg-[#1a1714]">
              <Link to={`/movie/${movie.id}?type=${movie.mediaType}`}>
                <h4
                  className="text-[11px] font-bold mb-1 truncate text-[#f0e6cc] hover:text-[#c8963c] transition-colors"
                  title={movie.title}
                >
                  {movie.title}
                </h4>
              </Link>
              <p className="text-[8px] text-[#f0e6cc]/50 mb-2 uppercase tracking-wider flex items-center gap-1 flex-wrap font-semibold">
                <span>
                  {movie.releaseDate
                    ? new Date(movie.releaseDate).toLocaleDateString("en-US", {
                        month: "short",
                        year: "numeric",
                      })
                    : movie.releaseYear}
                </span>
                {released && (
                  <>
                    <span>•</span>
                    <span className="text-[#c8963c] font-bold">
                      ★ {Number(movie.rating || 0).toFixed(1)}
                    </span>
                  </>
                )}
                <span className="ml-auto px-1 py-0.5 bg-[#2a241f] rounded text-[7px] text-[#f0e6cc]/70 border border-[#c8963c]/20">
                  {movie.mediaType === "tv" ? "TV" : "MOVIE"}
                </span>
              </p>

              <div className="mt-auto pt-2 border-t border-[#c8963c]/20">
                {addedIds.includes(movie.id) ? (
                  <button
                    onClick={() => handleRemove(movie)}
                    className="w-full py-1.5 bg-[#c8963c]/10 text-[#c8963c] font-bold rounded-lg uppercase text-[9px] tracking-wider border border-[#c8963c]/30 flex items-center justify-center gap-1 active:scale-95 hover:bg-[#c8963c]/20 transition"
                  >
                    <span>✓</span> In Plans
                  </button>
                ) : (
                  <button
                    onClick={() => handleAdd(movie)}
                    className="w-full py-1.5 bg-[#2a241f] hover:bg-[#c8963c] hover:text-[#12100e] text-[#c8963c] border border-[#c8963c]/30 font-bold rounded-lg transition-all active:scale-95 uppercase text-[9px] tracking-wider shadow-sm"
                  >
                    + Add
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-[#12100e] font-sans text-[#f0e6cc] relative overscroll-none selection:bg-[#c8963c] selection:text-[#12100e]">
      {/* 1. ВЕРХНЯ НАВІГАЦІЯ (ЗАКРІПЛЕНА ТА АДАПТИВНА) */}
      <div className="sticky top-0 z-40 bg-[#12100e]/95 backdrop-blur-md border-b border-[#c8963c]/10 mb-6">
        <header className="flex flex-col sm:flex-row items-center justify-between gap-3 py-4 sm:py-5 px-4 sm:px-8 w-full max-w-7xl mx-auto">
          <Link
            to="/search"
            className="hover:opacity-80 transition-opacity shrink-0"
          >
            <h1 className="text-xl sm:text-2xl font-black text-[#c8963c] tracking-tight uppercase drop-shadow-md">
              Movie Tracker
            </h1>
          </Link>
          <nav className="flex items-center gap-4 sm:gap-8 overflow-x-auto w-full sm:w-auto pb-1 scrollbar-hide justify-center">
            <Link
              to="/ai-chat"
              className="text-[#f0e6cc]/60 hover:text-[#c8963c] transition-colors text-xs sm:text-sm px-1 tracking-wide uppercase font-semibold whitespace-nowrap flex-shrink-0"
            >
              AI Chat
            </Link>
            <Link
              to="/search"
              className="text-[#c8963c] font-bold border-b-2 border-[#c8963c] transition-all text-xs sm:text-sm px-1 tracking-wide uppercase whitespace-nowrap flex-shrink-0"
            >
              Search
            </Link>
            <Link
              to="/watchlist"
              className="text-[#f0e6cc]/60 hover:text-[#c8963c] transition-colors text-xs sm:text-sm px-1 tracking-wide uppercase font-semibold whitespace-nowrap flex-shrink-0"
            >
              Profile
            </Link>
            <button
              onClick={handleLogout}
              className="text-[9px] sm:text-xs px-3 py-1.5 border border-red-900/50 bg-red-900/10 text-red-500 rounded-lg hover:bg-red-600 hover:text-white transition uppercase font-bold whitespace-nowrap flex-shrink-0"
            >
              Logout
            </button>
          </nav>
        </header>
      </div>

      {/* 2. ОСНОВНИЙ КОНТЕНТ (ОБМЕЖЕНИЙ ПО ЦЕНТРУ) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 pb-12">
        {/* Поле пошуку винесене з липкої шапки */}
        <form
          onSubmit={handleSearch}
          className="relative max-w-2xl mx-auto mb-10"
        >
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Enter movie title..."
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
              {isSearching ? "..." : "Find"}
            </button>
          </div>
        </form>

        <main>
          {results.length > 0 ? (
            <>
              <div className="flex justify-between items-center mb-6 border-b border-[#c8963c]/20 pb-3">
                <h2 className="text-xs sm:text-sm font-black text-[#c8963c] uppercase tracking-widest">
                  Search Results
                </h2>
                <button
                  onClick={handleClearSearch}
                  className="text-[10px] sm:text-xs font-bold text-[#f0e6cc]/60 hover:text-[#c8963c] transition uppercase tracking-wider"
                >
                  ← Back
                </button>
              </div>
              {renderMovieGrid(results)}
            </>
          ) : searchQuery.trim() !== "" ? (
            !isSearching && (
              <div className="text-center mt-10 border border-[#c8963c]/20 bg-[#1a1714] p-10 rounded-3xl max-w-sm mx-auto shadow-2xl">
                <p className="text-[#f0e6cc]/60 text-lg mb-6 font-semibold">
                  No movies found.
                </p>
                <button
                  onClick={handleClearSearch}
                  className="text-sm font-bold text-[#c8963c] hover:text-[#e8c070] transition uppercase tracking-widest"
                >
                  ← Back to Home
                </button>
              </div>
            )
          ) : (
            <div className="space-y-12">
              <section>
                <div className="flex items-center gap-2 mb-4 border-b border-[#c8963c]/20 pb-3">
                  <h2 className="text-xs sm:text-sm font-black text-[#c8963c] uppercase tracking-widest">
                    Trending This Week
                  </h2>
                  <span className="bg-red-500/20 text-red-500 text-[8px] sm:text-[10px] font-bold px-2 py-0.5 rounded border border-red-500/30">
                    HOT
                  </span>
                </div>
                {isLoadingHome && trending.length === 0 ? (
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
                ) : trending.length > 0 ? (
                  renderMovieGrid(trending)
                ) : (
                  <p className="text-[#f0e6cc]/50 text-center text-sm">
                    Failed to load trends.
                  </p>
                )}
              </section>

              <section>
                <div className="flex items-center gap-2 mb-4 border-b border-[#c8963c]/20 pb-3">
                  <h2 className="text-xs sm:text-sm font-black text-[#c8963c] uppercase tracking-widest">
                    Coming Soon
                  </h2>
                  <span className="bg-[#c8963c]/20 text-[#c8963c] text-[8px] sm:text-[10px] font-bold px-2 py-0.5 rounded border border-[#c8963c]/30">
                    NEW
                  </span>
                </div>
                {!isLoadingHome &&
                  upcoming.length > 0 &&
                  renderMovieGrid(upcoming.slice(0, 8))}
              </section>

              <section>
                <div className="flex items-center gap-2 mb-4 border-b border-[#c8963c]/20 pb-3">
                  <h2 className="text-xs sm:text-sm font-black text-[#c8963c] uppercase tracking-widest">
                    Recommended for You
                  </h2>
                  <span className="bg-[#c8963c]/20 text-[#c8963c] text-[8px] sm:text-[10px] font-bold px-2 py-0.5 rounded border border-[#c8963c]/30">
                    AI
                  </span>
                </div>
                {isLoadingHome && recommendations.length === 0 ? (
                  <div className="flex justify-center items-center h-24">
                    <p className="text-[#f0e6cc]/50 animate-pulse text-xs sm:text-sm font-semibold uppercase tracking-widest">
                      AI curating your list...
                    </p>
                  </div>
                ) : recommendations.length > 0 ? (
                  renderMovieGrid(recommendations)
                ) : (
                  <div className="text-center p-8 bg-[#1a1714] rounded-2xl border border-[#c8963c]/30 border-dashed">
                    <p className="text-[#f0e6cc]/60 text-sm font-medium">
                      Add movies to your Watchlist so AI can recommend similar
                      titles!
                    </p>
                  </div>
                )}
              </section>
            </div>
          )}
        </main>
      </div>

      {toastMessage && (
        <div className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-10 bg-[#1a1714] border border-[#c8963c]/50 text-[#c8963c] uppercase tracking-widest px-6 py-4 rounded-xl shadow-2xl flex items-center justify-center z-50">
          <span className="font-bold text-[10px] sm:text-xs text-center">
            {toastMessage}
          </span>
        </div>
      )}
    </div>
  );
}

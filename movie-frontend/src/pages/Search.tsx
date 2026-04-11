import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api";

interface MovieResult {
  id: number;
  title: string;
  description: string;
  releaseYear: string;
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
      const cached = localStorage.getItem(TRENDING_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [recommendations, setRecommendations] = useState<MovieResult[]>(() => {
    try {
      const cached = localStorage.getItem(RECOMMENDATIONS_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [favoriteIds, setFavoriteIds] = useState<number[]>(() => {
    try {
      const cached = localStorage.getItem(FAVORITES_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [addedIds, setAddedIds] = useState<number[]>(() => {
    try {
      const cached = localStorage.getItem(ADDED_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
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
        const [trendingRes, profileRes, recsRes] = await Promise.all([
          api.get("/movies/trending").catch(() => ({ data: [] })),
          api.get("/movies/profile").catch(() => ({ data: null })),
          api.get("/movies/recommendations").catch(() => ({ data: [] })),
        ]);

        if (trendingRes.data?.length > 0) {
          setTrending(trendingRes.data);
          localStorage.setItem(
            TRENDING_CACHE_KEY,
            JSON.stringify(trendingRes.data),
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
      });
      setAddedIds((prev) => Array.from(new Set([...prev, movie.id])));
      showToast("Added to list");
    } catch (error: any) {
      if (error.response?.status === 400) {
        setAddedIds((prev) => Array.from(new Set([...prev, movie.id])));
      } else {
        showToast("Error adding movie");
      }
    }
  };

  const handleRemove = async (movie: MovieResult) => {
    try {
      await api.delete(`/movies/watchlist/${movie.id}`);
      setAddedIds((prev) => prev.filter((id) => id !== movie.id));
      setFavoriteIds((prev) => prev.filter((id) => id !== movie.id));

      const newFavs = favoriteIds.filter((id) => id !== movie.id);
      localStorage.setItem(FAVORITES_CACHE_KEY, JSON.stringify(newFavs));

      showToast("Removed from list");
    } catch {
      showToast("Error removing movie");
    }
  };

  const handleToggleFavorite = async (movie: MovieResult) => {
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
    localStorage.removeItem(TRENDING_CACHE_KEY);
    localStorage.removeItem(FAVORITES_CACHE_KEY);
    localStorage.removeItem(SEARCH_QUERY_CACHE_KEY);
    localStorage.removeItem(SEARCH_RESULTS_CACHE_KEY);
    localStorage.removeItem(SEARCH_TIMESTAMP_KEY);
    localStorage.removeItem(RECOMMENDATIONS_CACHE_KEY);
    localStorage.removeItem(ADDED_CACHE_KEY);
    navigate("/login");
  };

  const renderMovieGrid = (movies: MovieResult[]) => (
    <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
      {movies.map((movie) => (
        <div
          key={movie.id}
          className="group relative overflow-hidden transition bg-[#1a1714] border border-[#c8963c]/20 shadow-lg rounded-2xl flex flex-col hover:shadow-[#c8963c]/10 hover:border-[#c8963c]/70 hover:-translate-y-1"
        >
          <button
            className="absolute top-2 left-2 sm:top-3 sm:left-3 z-10 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-[#12100e]/80 rounded-full backdrop-blur-sm border border-[#c8963c]/30 hover:bg-[#1a1714] transition group/heart"
            onClick={() => handleToggleFavorite(movie)}
          >
            <svg
              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition ${
                favoriteIds.includes(movie.id)
                  ? "text-red-500 fill-red-500"
                  : "text-[#f0e6cc]/30 group-hover/heart:text-red-500"
              }`}
              fill={favoriteIds.includes(movie.id) ? "currentColor" : "none"}
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
              <div className="flex items-center justify-center w-full h-full text-xs text-[#f0e6cc]/30">
                No poster
              </div>
            )}
          </Link>

          <div className="p-3 sm:p-4 flex flex-col flex-grow relative z-10 bg-[#1a1714]">
            <Link to={`/movie/${movie.id}?type=${movie.mediaType}`}>
              <h4
                className="text-xs sm:text-lg font-bold mb-1 truncate text-[#f0e6cc] hover:text-[#c8963c] transition-colors"
                title={movie.title}
              >
                {movie.title}
              </h4>
            </Link>
            <p className="text-[9px] sm:text-xs text-[#f0e6cc]/50 mb-3 uppercase tracking-wider flex items-center gap-1 flex-wrap font-semibold">
              <span>{movie.releaseYear}</span>
              <span>•</span>
              <span className="text-[#c8963c] font-bold">
                ★ {Number(movie.rating || 0).toFixed(1)}
              </span>
              <span className="ml-auto inline-block px-1.5 py-0.5 bg-[#2a241f] rounded-md text-[7px] sm:text-[9px] text-[#f0e6cc]/80 border border-[#c8963c]/20">
                {movie.mediaType === "tv" ? "TV" : "MOVIE"}
              </span>
            </p>

            <div className="mt-auto pt-3 border-t border-[#c8963c]/20">
              {addedIds.includes(movie.id) ? (
                <button
                  onClick={() => handleRemove(movie)}
                  className="w-full py-2 sm:py-2.5 bg-[#c8963c]/10 text-[#c8963c] font-bold rounded-lg sm:rounded-xl uppercase text-[10px] sm:text-xs tracking-wider border border-[#c8963c]/30 flex items-center justify-center gap-1.5 min-h-[36px] hover:bg-[#c8963c]/20 transition-colors active:scale-95"
                >
                  <span className="text-sm">✓</span> Added
                </button>
              ) : (
                <button
                  onClick={() => handleAdd(movie)}
                  className="w-full py-2 sm:py-2.5 bg-[#2a241f] hover:bg-[#c8963c] hover:text-[#12100e] text-[#c8963c] border border-[#c8963c]/30 font-bold rounded-lg sm:rounded-xl transition-all active:scale-95 uppercase text-[10px] sm:text-xs tracking-wider min-h-[36px] shadow-sm"
                >
                  + Add
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-[100dvh] p-3 sm:p-8 bg-[#12100e] font-sans text-[#f0e6cc] relative overscroll-none selection:bg-[#c8963c] selection:text-[#12100e]">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-4 mb-6 border-b border-[#c8963c]/20">
          <h1 className="text-2xl sm:text-3xl font-black text-[#c8963c] tracking-tight uppercase text-center md:text-left drop-shadow-md">
            Movie Tracker
          </h1>
          <nav className="flex items-center gap-4 sm:gap-8 overflow-x-auto w-full sm:w-auto pb-1 scrollbar-hide">
            <Link
              to="/ai-chat"
              className="text-[#f0e6cc]/60 hover:text-[#c8963c] transition-colors text-sm sm:text-base px-1 tracking-wide uppercase font-semibold whitespace-nowrap flex-shrink-0"
            >
              AI Chat
            </Link>
            <Link
              to="/search"
              className="text-[#c8963c] font-bold border-b-2 border-[#c8963c] transition-all text-sm sm:text-base px-1 tracking-wide uppercase whitespace-nowrap flex-shrink-0"
            >
              Search
            </Link>
            <Link
              to="/watchlist"
              className="text-[#f0e6cc]/60 hover:text-[#c8963c] transition-colors text-sm sm:text-base px-1 tracking-wide uppercase font-semibold whitespace-nowrap flex-shrink-0"
            >
              My Profile
            </Link>
            <button
              onClick={handleLogout}
              className="text-[10px] sm:text-xs px-3 py-1.5 border border-red-900/50 bg-red-900/10 text-red-500 rounded-lg hover:bg-red-600 hover:text-white transition uppercase font-bold whitespace-nowrap flex-shrink-0 min-h-[36px]"
            >
              Logout
            </button>
          </nav>
        </header>

        <form
          onSubmit={handleSearch}
          className="mb-6 sm:mb-10 relative w-full max-w-2xl mx-auto group"
        >
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Enter movie title..."
            className="w-full pl-5 pr-24 sm:pr-32 py-3.5 sm:py-4 bg-[#1a1714] border border-[#c8963c]/30 rounded-full text-[#f0e6cc] placeholder-[#f0e6cc]/30 focus:outline-none focus:border-[#c8963c] focus:ring-1 focus:ring-[#c8963c]/50 shadow-inner transition-all text-sm sm:text-base"
          />
          <div className="absolute right-1.5 top-1.5 bottom-1.5 flex items-center gap-1">
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="w-8 h-8 flex items-center justify-center rounded-full text-[#f0e6cc]/50 hover:bg-[#c8963c]/20 hover:text-[#c8963c] transition"
                title="Clear search"
              >
                ✕
              </button>
            )}
            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="px-4 sm:px-6 h-full min-w-[56px] bg-[#c8963c] text-[#12100e] rounded-full font-black hover:bg-[#e8c070] transition-all active:scale-95 disabled:bg-[#2a241f] disabled:text-[#c8963c]/30 text-sm sm:text-base shadow-md uppercase tracking-wider"
            >
              {isSearching ? "..." : "Find"}
            </button>
          </div>
        </form>

        <main>
          {results.length > 0 ? (
            <>
              <div className="flex justify-between items-center mb-5 border-b border-[#c8963c]/20 pb-2">
                <h2 className="text-base sm:text-xl font-black text-[#c8963c] uppercase tracking-widest">
                  Search Results
                </h2>
                <button
                  onClick={handleClearSearch}
                  className="text-[10px] sm:text-sm font-bold text-[#f0e6cc]/60 hover:text-[#c8963c] transition-colors uppercase tracking-wider"
                >
                  ← Back
                </button>
              </div>
              {renderMovieGrid(results)}
            </>
          ) : searchQuery.trim() !== "" ? (
            !isSearching && (
              <div className="text-center mt-12 border border-[#c8963c]/20 bg-[#1a1714] p-10 rounded-2xl max-w-lg mx-auto shadow-lg">
                <p className="text-[#f0e6cc]/60 text-lg mb-4 font-semibold">
                  No movies found.
                </p>
                <button
                  onClick={handleClearSearch}
                  className="text-sm font-bold text-[#c8963c] hover:text-[#e8c070] transition-colors uppercase tracking-wider"
                >
                  ← Back to Home
                </button>
              </div>
            )
          ) : (
            <div className="space-y-10 sm:space-y-12">
              <section>
                <div className="flex items-center gap-3 mb-5 border-b border-[#c8963c]/20 pb-2">
                  <h2 className="text-base sm:text-xl font-black text-[#c8963c] uppercase tracking-widest">
                    Trending This Week
                  </h2>
                  <span className="bg-red-500/20 text-red-500 text-[10px] font-bold px-2 py-0.5 rounded border border-red-500/30">
                    HOT
                  </span>
                </div>
                {isLoadingHome && trending.length === 0 ? (
                  <div className="flex justify-center items-center h-48">
                    <div className="flex gap-2">
                      <div className="w-2.5 h-2.5 bg-[#c8963c] rounded-full animate-bounce"></div>
                      <div
                        className="w-2.5 h-2.5 bg-[#c8963c] rounded-full animate-bounce"
                        style={{ animationDelay: "0.1s" }}
                      ></div>
                      <div
                        className="w-2.5 h-2.5 bg-[#c8963c] rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                    </div>
                  </div>
                ) : trending.length > 0 ? (
                  renderMovieGrid(trending)
                ) : (
                  <p className="text-[#f0e6cc]/50 text-center">
                    Failed to load trends.
                  </p>
                )}
              </section>

              <section>
                <div className="flex items-center gap-3 mb-5 border-b border-[#c8963c]/20 pb-2">
                  <h2 className="text-base sm:text-xl font-black text-[#c8963c] uppercase tracking-widest">
                    Recommended for You
                  </h2>
                  <span className="bg-[#c8963c]/20 text-[#c8963c] text-[10px] font-bold px-2 py-0.5 rounded border border-[#c8963c]/30">
                    AI
                  </span>
                </div>
                {isLoadingHome && recommendations.length === 0 ? (
                  <div className="flex justify-center items-center h-32">
                    <p className="text-[#f0e6cc]/50 animate-pulse text-sm font-semibold uppercase tracking-wider">
                      AI is curating your personalized list...
                    </p>
                  </div>
                ) : recommendations.length > 0 ? (
                  renderMovieGrid(recommendations)
                ) : (
                  <div className="text-center p-6 sm:p-8 bg-[#1a1714] rounded-2xl border border-[#c8963c]/30 border-dashed shadow-inner">
                    <p className="text-[#f0e6cc]/60 text-sm font-medium">
                      Add a few movies to your Watchlist so AI can learn your
                      taste and suggest similar titles!
                    </p>
                  </div>
                )}
              </section>
            </div>
          )}
        </main>
      </div>

      {toastMessage && (
        <div className="fixed bottom-5 left-4 right-4 sm:left-auto sm:right-10 sm:bottom-10 bg-[#1a1714] border border-[#c8963c]/50 text-[#c8963c] uppercase tracking-widest px-6 py-4 rounded-xl shadow-2xl flex items-center justify-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300 z-50">
          <span className="font-bold text-xs sm:text-sm text-center">
            {toastMessage}
          </span>
        </div>
      )}
    </div>
  );
}

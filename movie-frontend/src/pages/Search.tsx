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

const TRENDING_CACHE_KEY =
  import.meta.env.VITE_TRENDING_CACHE_KEY || "trending_cache";
const FAVORITES_CACHE_KEY =
  import.meta.env.VITE_FAVORITES_CACHE_KEY || "favorites_cache";
const SEARCH_QUERY_CACHE_KEY =
  import.meta.env.VITE_SEARCH_QUERY_CACHE_KEY || "search_query_cache";
const SEARCH_RESULTS_CACHE_KEY =
  import.meta.env.VITE_SEARCH_RESULTS_CACHE_KEY || "search_results_cache";
const RECOMMENDATIONS_CACHE_KEY = "recommendations_cache"; // Новий ключ для ШІ
const SEARCH_TIMESTAMP_KEY =
  import.meta.env.VITE_SEARCH_TIMESTAMP_KEY || "search_timestamp";
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

  // НОВИЙ СТАН ДЛЯ РЕКОМЕНДАЦІЙ
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

  const [isLoadingHome, setIsLoadingHome] = useState(trending.length === 0);
  const [isSearching, setIsSearching] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Завантажуємо тренди, профіль та рекомендації паралельно.
        // Використовуємо .catch, щоб якщо ШІ впаде, тренди все одно завантажились
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

        if (profileRes.data?.favorites) {
          const ids = profileRes.data.favorites.map((f: any) => f.tmdbId);
          setFavoriteIds(ids);
          localStorage.setItem(FAVORITES_CACHE_KEY, JSON.stringify(ids));
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
      showToast("Successfully added");
    } catch (error: any) {
      if (error.response?.status === 400) {
        showToast("Already in your list");
      } else {
        showToast("Error adding movie");
      }
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
    navigate("/login");
  };

  const renderMovieGrid = (movies: MovieResult[]) => (
    <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
      {movies.map((movie) => (
        <div
          key={movie.id}
          className="group relative overflow-hidden transition bg-gray-800 border border-gray-700 shadow-md rounded-2xl flex flex-col hover:shadow-xl hover:border-blue-500/30 hover:-translate-y-1"
        >
          <button
            className="absolute top-2 left-2 sm:top-3 sm:left-3 z-10 w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center bg-gray-900/60 rounded-full backdrop-blur-sm border border-gray-600/50 hover:bg-gray-800 transition group/heart"
            onClick={() => handleToggleFavorite(movie)}
          >
            <svg
              className={`w-3 h-3 sm:w-4 sm:h-4 transition ${
                favoriteIds.includes(movie.id)
                  ? "text-red-500 fill-red-500"
                  : "text-gray-400 group-hover/heart:text-red-500"
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
              ></path>
            </svg>
          </button>

          <Link
            to={`/movie/${movie.id}?type=${movie.mediaType}`}
            className="relative w-full aspect-[2/3] bg-gray-900 block overflow-hidden"
          >
            {movie.posterUrl ? (
              <img
                src={movie.posterUrl}
                alt={movie.title}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="flex items-center justify-center w-full h-full text-xs text-gray-600">
                No poster
              </div>
            )}
          </Link>

          <div className="p-3 sm:p-4 flex flex-col flex-grow relative z-10 bg-gray-800">
            <Link to={`/movie/${movie.id}?type=${movie.mediaType}`}>
              <h4
                className="text-sm sm:text-lg font-bold mb-1 truncate text-white hover:text-blue-400 transition-colors"
                title={movie.title}
              >
                {movie.title}
              </h4>
            </Link>
            <p className="text-[10px] sm:text-xs text-gray-500 mb-4 uppercase tracking-tighter flex items-center gap-1">
              <span>{movie.releaseYear}</span>
              <span>•</span>
              <span className="text-yellow-500 font-bold">
                IMDB: {Number(movie.rating || 0).toFixed(1)}
              </span>
              <span className="ml-auto inline-block px-1.5 py-0.5 bg-gray-700 rounded-md text-[8px] sm:text-[9px] text-gray-300">
                {movie.mediaType === "tv" ? "TV SHOW" : "MOVIE"}
              </span>
            </p>
            <div className="mt-auto pt-2 border-t border-gray-700/50">
              <button
                onClick={() => handleAdd(movie)}
                className="w-full py-1.5 sm:py-2 bg-gray-700 hover:bg-blue-600 text-white font-bold rounded-lg sm:rounded-xl transition-colors active:scale-95 uppercase text-[10px] sm:text-xs tracking-wider"
              >
                + Add
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen p-4 sm:p-8 bg-gray-900 font-sans text-gray-100 relative">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 mb-8 border-b border-gray-800">
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent text-center md:text-left">
            Movie Tracker
          </h1>
          <nav className="flex flex-wrap justify-center gap-4 sm:gap-8 items-center">
            <Link
              to="/ai-chat"
              className="text-purple-400 font-bold hover:text-purple-300 transition text-sm sm:text-base"
            >
              AI Chat
            </Link>
            <Link
              to="/search"
              className="text-blue-400 font-bold border-b-2 border-blue-400 text-sm sm:text-base pb-1"
            >
              Search
            </Link>
            <Link
              to="/watchlist"
              className="text-gray-400 hover:text-white transition text-sm sm:text-base"
            >
              My Profile
            </Link>
            <button
              onClick={handleLogout}
              className="text-xs sm:text-sm px-4 py-2 bg-red-900/20 text-red-400 rounded-lg hover:bg-red-600 hover:text-white transition"
            >
              Logout
            </button>
          </nav>
        </header>

        <form
          onSubmit={handleSearch}
          className="mb-8 sm:mb-10 relative w-full max-w-2xl mx-auto"
        >
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Enter movie title..."
            className="w-full pl-6 pr-24 sm:pr-32 py-3.5 sm:py-4 bg-gray-800 border border-gray-700 rounded-full focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 shadow-xl transition-all text-base"
          />

          <div className="absolute right-1.5 top-1.5 bottom-1.5 flex items-center gap-1">
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-white hover:bg-gray-700 transition"
                title="Clear search"
              >
                ✕
              </button>
            )}

            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="px-4 sm:px-6 h-full bg-blue-600 text-white rounded-full font-bold hover:bg-blue-500 transition-all active:scale-95 disabled:bg-gray-700 disabled:text-gray-500 text-sm sm:text-base"
            >
              {isSearching ? "..." : "Find"}
            </button>
          </div>
        </form>

        <main>
          {results.length > 0 ? (
            <>
              <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-2">
                <h2 className="text-lg sm:text-xl font-bold text-gray-300">
                  Search Results
                </h2>
                <button
                  onClick={handleClearSearch}
                  className="text-[10px] sm:text-sm font-bold text-gray-400 hover:text-blue-400 transition-colors uppercase tracking-wider"
                >
                  ← Back to Home
                </button>
              </div>
              {renderMovieGrid(results)}
            </>
          ) : searchQuery.trim() !== "" ? (
            !isSearching && (
              <div className="text-center mt-12">
                <p className="text-gray-500 text-lg mb-4">No movies found.</p>
                <button
                  onClick={handleClearSearch}
                  className="text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors"
                >
                  ← Back to Home
                </button>
              </div>
            )
          ) : (
            <div className="space-y-12">
              {/* СЕКЦІЯ 1: ТРЕНДИ */}
              <section>
                <div className="flex items-center gap-3 mb-6 border-b border-gray-800 pb-2">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-300">
                    Trending This Week
                  </h2>
                  <span className="bg-red-500/20 text-red-500 text-[10px] font-bold px-2 py-0.5 rounded border border-red-500/30">
                    HOT
                  </span>
                </div>

                {isLoadingHome && trending.length === 0 ? (
                  <div className="flex justify-center items-center h-48">
                    <div className="flex gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"></div>
                      <div
                        className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"
                        style={{ animationDelay: "0.1s" }}
                      ></div>
                      <div
                        className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                    </div>
                  </div>
                ) : trending.length > 0 ? (
                  renderMovieGrid(trending)
                ) : (
                  <p className="text-gray-500 text-center">
                    Failed to load trends.
                  </p>
                )}
              </section>

              {/* СЕКЦІЯ 2: AI РЕКОМЕНДАЦІЇ */}
              <section>
                <div className="flex items-center gap-3 mb-6 border-b border-gray-800 pb-2">
                  <h2 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                    Recommended for You
                  </h2>
                  <span className="bg-purple-500/20 text-purple-400 text-[10px] font-bold px-2 py-0.5 rounded border border-purple-500/30">
                    AI
                  </span>
                </div>

                {isLoadingHome && recommendations.length === 0 ? (
                  <div className="flex justify-center items-center h-32">
                    <p className="text-gray-500 animate-pulse">
                      AI is curating your personalized list...
                    </p>
                  </div>
                ) : recommendations.length > 0 ? (
                  renderMovieGrid(recommendations)
                ) : (
                  <div className="text-center p-8 bg-gray-800/40 rounded-2xl border border-gray-700 border-dashed">
                    <p className="text-gray-400">
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
        <div className="fixed bottom-5 left-5 right-5 sm:left-auto sm:right-10 sm:bottom-10 bg-gray-800 border border-gray-700 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center justify-center sm:justify-start gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300 z-50">
          <span className="font-semibold text-sm sm:text-base text-center">
            {toastMessage}
          </span>
        </div>
      )}
    </div>
  );
}

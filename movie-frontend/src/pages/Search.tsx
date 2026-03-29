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
}

const TRENDING_CACHE_KEY = "movie_tracker_trending_cache";
const FAVORITES_CACHE_KEY = "movie_tracker_favorites_cache";

export default function Search() {
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<MovieResult[]>([]);

  // Ініціалізуємо тренди з кешу
  const [trending, setTrending] = useState<MovieResult[]>(() => {
    try {
      const cached = localStorage.getItem(TRENDING_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  // Ініціалізуємо сердечка з кешу
  const [favoriteIds, setFavoriteIds] = useState<number[]>(() => {
    try {
      const cached = localStorage.getItem(FAVORITES_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  // Лоадер потрібен ТІЛЬКИ якщо кеш порожній
  const [isLoadingTrends, setIsLoadingTrends] = useState(trending.length === 0);

  const [isSearching, setIsSearching] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [trendingRes, profileRes] = await Promise.all([
          api.get("/movies/trending"),
          api.get("/movies/profile"),
        ]);

        // Оновлюємо стан і зберігаємо в кеш
        setTrending(trendingRes.data);
        localStorage.setItem(
          TRENDING_CACHE_KEY,
          JSON.stringify(trendingRes.data),
        );

        if (profileRes.data?.favorites) {
          const ids = profileRes.data.favorites.map((f: any) => f.tmdbId);
          setFavoriteIds(ids);
          localStorage.setItem(FAVORITES_CACHE_KEY, JSON.stringify(ids));
        }
      } catch (error) {
        console.error("Error fetching background data:", error);
      } finally {
        setIsLoadingTrends(false);
      }
    };

    fetchData();
  }, []);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const response = await api.get("/movies/search", {
        params: { title: searchQuery },
      });
      setResults(response.data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAdd = async (movie: MovieResult) => {
    try {
      await api.post("/movies/watchlist", {
        tmdbId: movie.id,
        title: movie.title,
        posterUrl: movie.posterUrl,
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
      localStorage.setItem(FAVORITES_CACHE_KEY, JSON.stringify(newIds)); // Оновлюємо кеш одразу

      showToast("Favorite status updated");
    } catch (error: any) {
      if (error.response?.status === 404 && !isFav) {
        try {
          await api.post("/movies/watchlist", {
            tmdbId: movie.id,
            title: movie.title,
            posterUrl: movie.posterUrl,
          });
          await api.patch(`/movies/watchlist/${movie.id}/favorite`);

          const newIds = [...favoriteIds, movie.id];
          setFavoriteIds(newIds);
          localStorage.setItem(FAVORITES_CACHE_KEY, JSON.stringify(newIds));

          showToast("Added to list and favorites");
        } catch (innerError) {
          showToast("Failed to favorite movie");
        }
      } else {
        showToast("Failed to update favorite status");
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    // За бажанням: можна очищати кеш при логауті
    // localStorage.removeItem(TRENDING_CACHE_KEY);
    // localStorage.removeItem(FAVORITES_CACHE_KEY);
    navigate("/login");
  };

  const renderMovieGrid = (movies: MovieResult[]) => (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {movies.map((movie) => (
        <div
          key={movie.id}
          className="group relative overflow-hidden transition bg-gray-800 border border-gray-700 shadow-lg rounded-2xl flex flex-col hover:shadow-2xl hover:border-blue-500/30 hover:-translate-y-1"
        >
          <button
            className="absolute top-3 left-3 z-10 w-8 h-8 flex items-center justify-center bg-gray-900/60 rounded-full backdrop-blur-sm border border-gray-600/50 hover:bg-gray-800 transition group/heart"
            onClick={() => handleToggleFavorite(movie)}
          >
            <svg
              className={`w-4 h-4 transition ${
                favoriteIds.includes(movie.id)
                  ? "text-red-500"
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
            to={`/movie/${movie.id}`}
            className="relative w-full h-80 sm:h-72 md:h-80 bg-gray-900 block"
          >
            {movie.posterUrl ? (
              <img
                src={movie.posterUrl}
                alt={movie.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex items-center justify-center w-full h-full text-gray-600">
                No poster
              </div>
            )}
          </Link>

          <div className="p-4 sm:p-5 flex flex-col flex-grow relative z-10 bg-gray-800">
            <Link to={`/movie/${movie.id}`}>
              <h4
                className="text-lg sm:text-xl font-bold mb-1 truncate text-white hover:text-blue-400 transition-colors"
                title={movie.title}
              >
                {movie.title}
              </h4>
            </Link>
            <p className="text-xs text-gray-500 mb-3 uppercase tracking-tighter">
              {movie.releaseYear} • IMDB: {movie.rating}
            </p>
            <p className="text-sm text-gray-400 line-clamp-3 mb-6 flex-grow">
              {movie.description}
            </p>
            <button
              onClick={() => handleAdd(movie)}
              className="w-full py-2.5 bg-gray-700 hover:bg-blue-600 text-white font-bold rounded-xl transition-colors active:scale-95 uppercase text-sm tracking-wider"
            >
              + Add
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen p-4 sm:p-8 bg-gray-900 font-sans text-gray-100 relative">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 mb-10 border-b border-gray-800">
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
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
          className="mb-10 relative w-full max-w-2xl mx-auto"
        >
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value === "") setResults([]);
            }}
            placeholder="Enter movie title..."
            className="w-full pl-6 pr-24 sm:pr-32 py-3.5 sm:py-4 bg-gray-800 border border-gray-700 rounded-full focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 shadow-xl transition-all text-sm sm:text-base"
          />
          <button
            type="submit"
            disabled={isSearching || !searchQuery.trim()}
            className="absolute right-1.5 top-1.5 bottom-1.5 px-4 sm:px-6 bg-blue-600 text-white rounded-full font-bold hover:bg-blue-500 transition-all active:scale-95 disabled:bg-gray-700 disabled:text-gray-500 text-sm sm:text-base"
          >
            {isSearching ? "..." : "Find"}
          </button>
        </form>

        <main>
          {results.length > 0 ? (
            <>
              <h2 className="text-lg sm:text-xl font-bold text-gray-300 mb-6 border-b border-gray-800 pb-2">
                Search Results
              </h2>
              {renderMovieGrid(results)}
            </>
          ) : searchQuery.trim() !== "" ? (
            !isSearching && (
              <p className="text-center text-gray-500 mt-12 text-lg">
                No movies found.
              </p>
            )
          ) : (
            <>
              <h2 className="text-lg sm:text-xl font-bold text-gray-300 mb-6 border-b border-gray-800 pb-2">
                Trending This Week
              </h2>
              {isLoadingTrends ? (
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
            </>
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

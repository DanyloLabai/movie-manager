import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api";

interface WatchlistItem {
  id: string;
  tmdbId: number;
  title: string;
  addedAt: string;
  posterUrl?: string | null;
  isWatched: boolean;
  rating?: number | null;
}

export default function Watchlist() {
  const [movies, setMovies] = useState<WatchlistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"watchlist" | "watched">(
    "watchlist",
  );
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchMovies();
  }, [activeTab]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchMovies = async () => {
    setIsLoading(true);
    try {
      const endpoint =
        activeTab === "watchlist" ? "/movies/watchlist" : "/movies/watched";
      const response = await api.get(endpoint);
      setMovies(response.data);
    } catch (error: any) {
      if (error.response?.status === 401) {
        localStorage.removeItem("token");
        navigate("/login");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (tmdbId: number) => {
    try {
      await api.delete(`/movies/watchlist/${tmdbId}`);
      setMovies((prev) => prev.filter((item) => item.tmdbId !== tmdbId));
      showToast("🗑️ Movie removed successfully!");
    } catch (error) {
      showToast("❌ Error removing movie.");
    }
  };

  const handleMarkWatched = async (tmdbId: number) => {
    try {
      await api.post(`/movies/watchlist/${tmdbId}/watched`);
      setMovies((prev) => prev.filter((item) => item.tmdbId !== tmdbId));
      showToast("✅ Marked as watched!");
    } catch (error) {
      showToast("❌ Failed to update status.");
    }
  };

  const handleRateMovie = async (tmdbId: number, rating: number) => {
    try {
      await api.patch(`/movies/watchlist/${tmdbId}/rate`, { rating });

      if (activeTab === "watchlist") {
        setMovies((prev) => prev.filter((item) => item.tmdbId !== tmdbId));
        showToast("⭐ Rating saved! Moved to Watched.");
      } else {
        setMovies((prev) =>
          prev.map((item) =>
            item.tmdbId === tmdbId ? { ...item, rating } : item,
          ),
        );
        showToast("⭐ Rating updated!");
      }
    } catch (error) {
      showToast("❌ Failed to save rating.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <div className="min-h-screen p-8 bg-gray-900 font-sans text-gray-100 relative">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center justify-between pb-6 mb-8 border-b border-gray-800">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Movie Tracker 🎬
          </h1>
          <nav className="flex gap-6 items-center">
            <Link
              to="/ai-chat"
              className="text-purple-400 font-bold hover:text-purple-300 transition"
            >
              AI Chat
            </Link>
            <Link
              to="/search"
              className="text-gray-400 hover:text-white transition"
            >
              Search
            </Link>
            <Link
              to="/watchlist"
              className="text-blue-400 font-bold border-b-2 border-blue-400"
            >
              My List
            </Link>
            <button
              onClick={handleLogout}
              className="text-sm px-4 py-2 bg-red-900/20 text-red-400 rounded-lg hover:bg-red-600 hover:text-white transition"
            >
              Logout
            </button>
          </nav>
        </header>

        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setActiveTab("watchlist")}
            className={`px-6 py-2 rounded-full font-bold transition-all ${
              activeTab === "watchlist"
                ? "bg-blue-600 text-white shadow-lg"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            In Plans
          </button>
          <button
            onClick={() => setActiveTab("watched")}
            className={`px-6 py-2 rounded-full font-bold transition-all ${
              activeTab === "watched"
                ? "bg-green-600 text-white shadow-lg"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700"
            }`}
          >
            Watched
          </button>
        </div>

        {/* Списки */}
        {isLoading ? (
          <p className="text-center text-gray-500 animate-pulse text-lg">
            Loading your list...
          </p>
        ) : movies.length === 0 ? (
          <div className="text-center p-12 bg-gray-800/50 rounded-3xl border border-gray-700 shadow-2xl">
            <p className="text-gray-400 text-xl">It's empty here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {movies.map((item) => (
              <div
                key={item.id}
                className="group overflow-hidden transition bg-gray-800 border border-gray-700 shadow-lg rounded-2xl flex flex-col hover:border-blue-500/30 hover:-translate-y-1 hover:shadow-2xl"
              >
                <Link
                  to={`/movie/${item.tmdbId}`}
                  className="relative w-full h-80 bg-gray-900 block"
                >
                  {item.posterUrl ? (
                    <img
                      src={item.posterUrl}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full text-gray-600">
                      No poster
                    </div>
                  )}
                  {activeTab === "watched" && (
                    <div className="absolute top-2 right-2 bg-green-500/90 text-white text-xs font-bold px-3 py-1 rounded-full backdrop-blur-sm">
                      Watched
                    </div>
                  )}
                </Link>

                <div className="p-5 flex flex-col flex-grow">
                  <Link
                    to={`/movie/${item.tmdbId}`}
                    className="text-xl font-bold text-white truncate hover:text-blue-400 transition"
                    title={item.title}
                  >
                    {item.title}
                  </Link>
                  <p className="mt-1 text-xs text-gray-500 mb-4">
                    Added: {new Date(item.addedAt).toLocaleDateString("en-US")}
                  </p>

                  <div className="flex justify-center gap-1 mb-4 mt-auto">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => handleRateMovie(item.tmdbId, star)}
                        className={`text-2xl transition-transform hover:scale-125 ${
                          (item.rating || 0) >= star
                            ? "text-yellow-400"
                            : "text-gray-600 hover:text-yellow-400/50"
                        }`}
                      >
                        ★
                      </button>
                    ))}
                  </div>

                  <div className="flex justify-between items-center pt-4 border-t border-gray-700/50">
                    {activeTab === "watchlist" ? (
                      <button
                        onClick={() => handleMarkWatched(item.tmdbId)}
                        className="text-sm font-bold text-green-400 hover:text-green-300 transition"
                      >
                        ✓ Watched
                      </button>
                    ) : (
                      <Link
                        to={`/movie/${item.tmdbId}`}
                        className="text-sm font-bold text-blue-400 hover:text-blue-300 transition"
                      >
                        Details
                      </Link>
                    )}
                    <button
                      onClick={() => handleDelete(item.tmdbId)}
                      className="text-sm font-semibold text-red-400/70 hover:text-red-400 transition"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {toastMessage && (
        <div className="fixed bottom-10 right-10 bg-gray-800 border border-gray-700 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300 z-50">
          <span className="font-semibold">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

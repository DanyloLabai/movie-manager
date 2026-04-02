import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api";

interface WatchlistItem {
  id: string;
  tmdbId: number;
  title: string;
  addedAt: string;
  updatedAt?: string;
  posterUrl?: string | null;
  isWatched: boolean;
  isFavorite: boolean;
  rating?: number | null;
}

interface ProfileData {
  favorites: WatchlistItem[];
  recent: WatchlistItem[];
  watchedCount?: number;
  totalCount?: number;
}

const PROFILE_CACHE_KEY =
  import.meta.env.VITE_PROFILE_CACHE_KEY || "movie_tracker_profile_cache";
const ENABLE_CACHE = import.meta.env.VITE_ENABLE_PROFILE_CACHE !== "false";

export default function Watchlist() {
  const [movies, setMovies] = useState<WatchlistItem[]>([]);

  const [profileData, setProfileData] = useState<ProfileData | null>(() => {
    if (!ENABLE_CACHE) return null;

    try {
      const cached = localStorage.getItem(PROFILE_CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "profile" | "watchlist" | "watched"
  >("profile");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [username, setUsername] = useState<string>("User");
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        setUsername(payload.username || payload.email?.split("@")[0] || "User");
      } catch (e) {
        console.error("Token parse error");
      }
    }
  }, []);

  useEffect(() => {
    if (activeTab === "watchlist" || activeTab === "watched") {
      fetchMovies();
    } else if (activeTab === "profile") {
      fetchProfile();
    }
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
        handleLogout();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProfile = async () => {
    if (!profileData || !ENABLE_CACHE) {
      setIsLoading(true);
    }

    try {
      const response = await api.get("/movies/profile");
      setProfileData(response.data);

      if (ENABLE_CACHE) {
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(response.data));
      }
    } catch (error: any) {
      if (error.response?.status === 401) {
        handleLogout();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleFavorite = async (tmdbId: number) => {
    if (activeTab === "profile") {
      setProfileData((prev) => {
        if (!prev) return prev;

        const targetItem =
          prev.favorites.find((f) => f.tmdbId === tmdbId) ||
          prev.recent.find((r) => r.tmdbId === tmdbId);

        const newFavorites = prev.favorites.filter((f) => f.tmdbId !== tmdbId);

        let newRecent = [...prev.recent];
        if (targetItem) {
          newRecent = newRecent.filter((r) => r.tmdbId !== tmdbId);
          newRecent.unshift({
            ...targetItem,
            isFavorite: !targetItem.isFavorite,
            updatedAt: new Date().toISOString(),
          });
          newRecent = newRecent.slice(0, 10);
        }

        return {
          ...prev,
          favorites: newFavorites,
          recent: newRecent,
        };
      });
    } else {
      setMovies((prev) =>
        prev.map((item) =>
          item.tmdbId === tmdbId
            ? { ...item, isFavorite: !item.isFavorite }
            : item,
        ),
      );
    }

    try {
      await api.patch(`/movies/watchlist/${tmdbId}/favorite`);
      showToast("Favorite status updated");
      if (activeTab === "profile") {
        fetchProfile();
      }
    } catch {
      showToast("Failed to update favorite status");
      if (activeTab === "profile") fetchProfile();
    }
  };

  const handleDelete = async (tmdbId: number) => {
    setMovies((prev) => prev.filter((item) => item.tmdbId !== tmdbId));

    setProfileData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        favorites: prev.favorites.filter((f) => f.tmdbId !== tmdbId),
        recent: prev.recent.filter((r) => r.tmdbId !== tmdbId),
        totalCount: Math.max(0, (prev.totalCount || 0) - 1),
      };
    });

    try {
      await api.delete(`/movies/watchlist/${tmdbId}`);
      showToast("Movie removed");
    } catch {
      showToast("Error removing movie");
    }
  };

  const handleMarkWatched = async (tmdbId: number) => {
    setMovies((prev) => prev.filter((item) => item.tmdbId !== tmdbId));

    setProfileData((prev) => {
      if (!prev) return prev;

      const targetItem =
        prev.recent.find((r) => r.tmdbId === tmdbId) ||
        movies.find((m) => m.tmdbId === tmdbId);

      let newRecent = [...prev.recent];
      if (targetItem) {
        newRecent = newRecent.filter((r) => r.tmdbId !== tmdbId);
        newRecent.unshift({
          ...targetItem,
          isWatched: true,
          updatedAt: new Date().toISOString(),
        });
        newRecent = newRecent.slice(0, 10);
      }

      return {
        ...prev,
        recent: newRecent,
        watchedCount: (prev.watchedCount || 0) + 1,
      };
    });

    try {
      await api.post(`/movies/watchlist/${tmdbId}/watched`);
      showToast("Moved to Watched");
    } catch {
      showToast("Failed to update status");
    }
  };

  const handleRateMovie = async (tmdbId: number, clickedStar: number) => {
    const targetMovie = movies.find((m) => m.tmdbId === tmdbId);
    const newRating = targetMovie?.rating === clickedStar ? 0 : clickedStar;

    if (activeTab === "watchlist") {
      setMovies((prev) => prev.filter((item) => item.tmdbId !== tmdbId));
    } else {
      setMovies((prev) =>
        prev.map((item) =>
          item.tmdbId === tmdbId ? { ...item, rating: newRating } : item,
        ),
      );
    }

    setProfileData((prev) => {
      if (!prev) return prev;

      const targetItem =
        prev.recent.find((r) => r.tmdbId === tmdbId) ||
        movies.find((m) => m.tmdbId === tmdbId);

      let newRecent = [...prev.recent];
      if (targetItem) {
        newRecent = newRecent.filter((r) => r.tmdbId !== tmdbId);
        newRecent.unshift({
          ...targetItem,
          rating: newRating,
          updatedAt: new Date().toISOString(),
        });
        newRecent = newRecent.slice(0, 10);
      }

      return { ...prev, recent: newRecent };
    });

    try {
      await api.patch(`/movies/watchlist/${tmdbId}/rate`, {
        rating: newRating,
      });
      showToast(newRating === 0 ? "Rating cleared" : "Rating updated");
    } catch {
      showToast("Failed to save rating");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    if (ENABLE_CACHE) {
      localStorage.removeItem(PROFILE_CACHE_KEY);
    }
    navigate("/login");
  };

  const renderProfileTab = () => {
    const totalCount = profileData?.totalCount || 0;
    const favoritesCount = profileData?.favorites?.length || 0;
    const watchedCount = profileData?.watchedCount || 0;

    const achievementsList = [
      {
        id: "first_blood",
        isUnlocked: totalCount > 0,
        unlockedText: "🏆 First Blood",
        lockedText: "🔒 First Blood",
        activeClasses: "bg-yellow-500/20 border-yellow-500/50 text-yellow-400",
        description: "Add your first movie or TV show to the tracker",
      },
      {
        id: "critic",
        isUnlocked: favoritesCount >= 5,
        unlockedText: "⭐ Critic",
        lockedText: `🔒 Critic (${favoritesCount}/5)`,
        activeClasses: "bg-pink-500/20 border-pink-500/50 text-pink-400",
        description: "Add 5 items to your favorites",
      },
      {
        id: "cinephile",
        isUnlocked: watchedCount >= 10,
        unlockedText: "🍿 Cinephile",
        lockedText: `🔒 Cinephile (${watchedCount}/10)`,
        activeClasses: "bg-purple-500/20 border-purple-500/50 text-purple-400",
        description: "Mark 10 items as watched",
      },
      {
        id: "collector",
        isUnlocked: totalCount >= 20,
        unlockedText: "📚 Collector",
        lockedText: `🔒 Collector (${totalCount}/20)`,
        activeClasses: "bg-teal-500/20 border-teal-500/50 text-teal-400",
        description: "Add 20 items to your tracker in total",
      },
      {
        id: "tastemaker",
        isUnlocked: favoritesCount >= 20,
        unlockedText: "💖 Tastemaker",
        lockedText: `🔒 Tastemaker (${favoritesCount}/20)`,
        activeClasses: "bg-rose-500/20 border-rose-500/50 text-rose-400",
        description: "Add 20 items to your favorites",
      },
      {
        id: "filmbuff",
        isUnlocked: watchedCount >= 50,
        unlockedText: "🎬 Film Buff",
        lockedText: `🔒 Film Buff (${watchedCount}/50)`,
        activeClasses: "bg-blue-500/20 border-blue-500/50 text-blue-400",
        description: "Mark 50 items as watched",
      },
      {
        id: "librarian",
        isUnlocked: totalCount >= 100,
        unlockedText: "🏛️ Librarian",
        lockedText: `🔒 Librarian (${totalCount}/100)`,
        activeClasses: "bg-amber-500/20 border-amber-500/50 text-amber-400",
        description: "Add 100 items to your tracker in total",
      },
    ];

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-6 p-6 sm:p-8 bg-gray-800 rounded-3xl border border-gray-700 shadow-xl">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-tr from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-3xl sm:text-4xl font-bold shadow-lg uppercase text-white shrink-0">
              {username.charAt(0)}
            </div>
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                {username}
              </h2>

              <div className="flex flex-wrap gap-2.5 mt-4">
                {achievementsList.map((achievement) => (
                  <div
                    key={achievement.id}
                    title={achievement.description}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm transition-all duration-500 border cursor-default ${
                      achievement.isUnlocked
                        ? `${achievement.activeClasses} scale-100 opacity-100`
                        : "bg-gray-800/50 border-gray-700 text-gray-500 scale-95 opacity-50 grayscale hover:opacity-80"
                    }`}
                  >
                    {achievement.isUnlocked
                      ? achievement.unlockedText
                      : achievement.lockedText}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-4 w-full sm:w-auto shrink-0 mt-4 sm:mt-0">
            <div className="flex-1 sm:flex-none text-center bg-gray-900/80 px-6 py-4 rounded-2xl border border-gray-700 shadow-inner">
              <div className="text-3xl font-black text-red-400">
                {favoritesCount}
              </div>
              <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mt-1">
                Favorites
              </div>
            </div>
            <div className="flex-1 sm:flex-none text-center bg-gray-900/80 px-6 py-4 rounded-2xl border border-gray-700 shadow-inner">
              <div className="text-3xl font-black text-green-400">
                {watchedCount}
              </div>
              <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mt-1">
                Watched
              </div>
            </div>
          </div>
        </div>

        {isLoading && !profileData ? (
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
        ) : (
          <div className="flex flex-col gap-6">
            <div className="p-6 sm:p-8 bg-gray-800 rounded-3xl border border-gray-700 shadow-xl">
              <div className="flex justify-between items-end mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  Top 5 Favorites
                </h3>
              </div>

              {!profileData?.favorites || profileData.favorites.length === 0 ? (
                <div className="text-center py-10 bg-gray-900/30 rounded-2xl border border-gray-700/50 border-dashed">
                  <p className="text-gray-500 text-sm italic">
                    You haven't liked any movies yet.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 sm:gap-6">
                  {profileData.favorites.map((fav) => (
                    <div
                      key={fav.id}
                      className="group relative flex flex-col items-center"
                    >
                      <Link
                        to={`/movie/${fav.tmdbId}`}
                        className="w-full aspect-[2/3] rounded-xl overflow-hidden shadow-lg border border-gray-700 bg-gray-900 relative"
                      >
                        {fav.posterUrl ? (
                          <img
                            src={fav.posterUrl}
                            alt={fav.title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          />
                        ) : (
                          <div className="flex items-center justify-center w-full h-full text-xs text-gray-600 italic">
                            No poster
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent opacity-80"></div>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            handleToggleFavorite(fav.tmdbId);
                          }}
                          className="absolute top-2 right-2 w-8 h-8 bg-gray-900/80 rounded-full flex items-center justify-center border border-gray-600/50 hover:bg-red-500/20 transition backdrop-blur-sm"
                          title="Remove from favorites"
                        >
                          <svg
                            className="w-4 h-4 text-red-500 fill-red-500"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                            ></path>
                          </svg>
                        </button>
                      </Link>
                      <Link
                        to={`/movie/${fav.tmdbId}`}
                        className="mt-3 w-full text-center"
                      >
                        <h4 className="text-sm font-bold text-gray-200 truncate hover:text-blue-400 transition px-1">
                          {fav.title}
                        </h4>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 sm:p-8 bg-gray-800 rounded-3xl border border-gray-700 shadow-xl">
              <h3 className="text-xl font-bold text-white mb-6">
                Recent Activity
              </h3>
              {!profileData?.recent || profileData.recent.length === 0 ? (
                <div className="text-center py-10 bg-gray-900/30 rounded-2xl border border-gray-700/50 border-dashed">
                  <p className="text-gray-500 text-sm italic">
                    No recent activity.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {profileData.recent.map((act) => {
                    const addedStr = new Date(act.addedAt).toLocaleDateString(
                      "en-US",
                      { month: "short", day: "numeric", year: "numeric" },
                    );
                    const updatedStr = act.updatedAt
                      ? new Date(act.updatedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : null;

                    return (
                      <Link
                        to={`/movie/${act.tmdbId}`}
                        key={act.id}
                        className="flex items-center gap-4 bg-gray-900/50 p-3 rounded-2xl border border-gray-700/50 hover:border-blue-500/30 hover:bg-gray-800 transition group"
                      >
                        <div className="w-12 h-16 rounded-lg bg-gray-800 overflow-hidden flex-shrink-0 border border-gray-700">
                          {act.posterUrl ? (
                            <img
                              src={act.posterUrl}
                              alt={act.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[8px] text-gray-600">
                              No Img
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col overflow-hidden">
                          <h4 className="font-bold text-white group-hover:text-blue-400 transition truncate text-sm">
                            {act.title}
                          </h4>
                          <div className="flex flex-col mt-1 gap-0.5">
                            <span className="text-[10px] text-gray-500 uppercase font-semibold">
                              Added: {addedStr}
                            </span>
                            {updatedStr && updatedStr !== addedStr && (
                              <span className="text-[10px] text-blue-400/80 uppercase font-semibold">
                                Updated: {updatedStr}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

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
              className="text-gray-400 hover:text-white transition text-sm sm:text-base"
            >
              Search
            </Link>
            <Link
              to="/watchlist"
              className="text-blue-400 font-bold border-b-2 border-blue-400 text-sm sm:text-base pb-1"
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

        <div className="flex justify-center md:justify-start gap-4 mb-8">
          <button
            onClick={() => setActiveTab("profile")}
            className={`px-5 sm:px-8 py-2.5 rounded-full font-bold transition-all text-sm sm:text-base ${activeTab === "profile" ? "bg-blue-600 text-white shadow-lg" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab("watchlist")}
            className={`px-5 sm:px-8 py-2.5 rounded-full font-bold transition-all text-sm sm:text-base ${activeTab === "watchlist" ? "bg-blue-600 text-white shadow-lg" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
          >
            In Plans
          </button>
          <button
            onClick={() => setActiveTab("watched")}
            className={`px-5 sm:px-8 py-2.5 rounded-full font-bold transition-all text-sm sm:text-base ${activeTab === "watched" ? "bg-green-600 text-white shadow-lg" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
          >
            Watched
          </button>
        </div>

        {activeTab === "profile" ? (
          renderProfileTab()
        ) : isLoading ? (
          <p className="text-center text-gray-500 animate-pulse text-lg mt-10">
            Loading your list...
          </p>
        ) : movies.length === 0 ? (
          <div className="text-center p-12 bg-gray-800/50 rounded-3xl border border-gray-700 shadow-2xl mt-10">
            <p className="text-gray-400 text-xl italic mb-4">
              It's empty here. Add some movies!
            </p>
            <Link
              to="/search"
              className="inline-block px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl hover:from-blue-500 hover:to-purple-500 transition shadow-lg"
            >
              Discover Movies
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {movies.map((item) => (
              <div
                key={item.id}
                className="group overflow-hidden transition bg-gray-800 border border-gray-700 shadow-lg rounded-3xl flex flex-col hover:border-blue-500/30 hover:-translate-y-1 hover:shadow-2xl relative"
              >
                <Link
                  to={`/movie/${item.tmdbId}`}
                  className="relative w-full h-80 sm:h-72 md:h-80 bg-gray-900 block"
                >
                  {item.posterUrl ? (
                    <img
                      src={item.posterUrl}
                      alt={item.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full text-gray-600 italic">
                      No poster
                    </div>
                  )}
                  {activeTab === "watched" && (
                    <div className="absolute top-3 right-3 bg-green-500/90 text-white text-[10px] font-bold px-3 py-1 rounded-full backdrop-blur-sm uppercase tracking-wider">
                      Watched
                    </div>
                  )}
                </Link>

                <div className="p-5 flex flex-col flex-grow z-10 bg-gray-800">
                  <Link
                    to={`/movie/${item.tmdbId}`}
                    className="text-lg font-bold text-white truncate hover:text-blue-400 transition"
                    title={item.title}
                  >
                    {item.title}
                  </Link>
                  <p className="mt-1 text-[10px] uppercase tracking-tighter text-gray-500 mb-4 font-semibold">
                    Added: {new Date(item.addedAt).toLocaleDateString("en-US")}
                  </p>

                  <div className="flex justify-center gap-1.5 mb-6 mt-auto">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => handleRateMovie(item.tmdbId, star)}
                        className={`text-2xl transition-all duration-200 active:scale-150 ${
                          (item.rating || 0) >= star
                            ? "text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.4)]"
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
                        className="text-xs font-bold text-green-400 hover:text-green-300 transition uppercase tracking-wider"
                      >
                        Mark Watched
                      </button>
                    ) : (
                      <Link
                        to={`/movie/${item.tmdbId}`}
                        className="text-xs font-bold text-blue-400 hover:text-blue-300 transition uppercase tracking-wider"
                      >
                        Details
                      </Link>
                    )}

                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => handleDelete(item.tmdbId)}
                        className="text-xs font-bold text-red-400/60 hover:text-red-400 transition uppercase tracking-wider"
                      >
                        Remove
                      </button>
                      <button
                        onClick={() => handleToggleFavorite(item.tmdbId)}
                        className="group/heart flex items-center gap-1.5"
                      >
                        <svg
                          className={`w-5 h-5 transition ${item.isFavorite ? "text-red-500 fill-red-500" : "text-gray-400 group-hover/heart:text-red-500"}`}
                          fill={item.isFavorite ? "currentColor" : "none"}
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
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {toastMessage && (
        <div className="fixed bottom-5 left-5 right-5 sm:left-auto sm:right-10 sm:bottom-10 bg-gray-800 border border-gray-700 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center justify-center sm:justify-start gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300 z-50">
          <span className="font-semibold text-sm sm:text-base">
            {toastMessage}
          </span>
        </div>
      )}
    </div>
  );
}

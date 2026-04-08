import { useEffect, useState, useRef } from "react";
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
  mediaType: string;
}

interface ProfileData {
  favorites: WatchlistItem[];
  recent: WatchlistItem[];
  watchedCount?: number;
  totalCount?: number;
  avatarUrl?: string | null;
  username?: string;
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

  const [username, setUsername] = useState<string>(() => {
    const savedName = localStorage.getItem("custom_username");
    if (savedName) return savedName;

    const token = localStorage.getItem("token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        return payload.username || payload.email?.split("@")[0] || "User";
      } catch {}
    }
    return "User";
  });

  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    const savedAvatar = localStorage.getItem("custom_avatarUrl");
    if (savedAvatar) return savedAvatar;

    const token = localStorage.getItem("token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        return payload.avatarUrl || null;
      } catch {}
    }
    return null;
  });

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [hoveredMovieId, setHoveredMovieId] = useState<number | null>(null);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [modalHoveredStar, setModalHoveredStar] = useState(0);
  const [ratingModalData, setRatingModalData] = useState<{
    isOpen: boolean;
    tmdbId: number | null;
    title: string;
  }>({ isOpen: false, tmdbId: null, title: "" });

  const navigate = useNavigate();

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
      if (error.response?.status === 401) handleLogout();
    } finally {
      setIsLoading(false);
    }
  };

  const fetchProfile = async () => {
    if (!profileData || !ENABLE_CACHE) setIsLoading(true);
    try {
      const response = await api.get("/movies/profile");
      setProfileData(response.data);

      // Оновлюємо стани тільки якщо немає локально збережених кастомних
      if (
        !localStorage.getItem("custom_avatarUrl") &&
        response.data.avatarUrl
      ) {
        setAvatarUrl(response.data.avatarUrl);
      }
      if (!localStorage.getItem("custom_username") && response.data.username) {
        setUsername(response.data.username);
      }

      if (ENABLE_CACHE) {
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(response.data));
      }
    } catch (error: any) {
      if (error.response?.status === 401) handleLogout();
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
        return { ...prev, favorites: newFavorites, recent: newRecent };
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
      if (activeTab === "profile") fetchProfile();
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

  const handleMarkWatched = (tmdbId: number) => {
    const targetMovie = movies.find((m) => m.tmdbId === tmdbId);
    if (targetMovie) {
      setRatingModalData({
        isOpen: true,
        tmdbId: targetMovie.tmdbId,
        title: targetMovie.title,
      });
    }
  };

  const confirmMarkWatched = async (tmdbId: number, rating: number | null) => {
    setMovies((prev) => prev.filter((item) => item.tmdbId !== tmdbId));
    try {
      await api.post(`/movies/watchlist/${tmdbId}/watched`);
      if (rating !== null)
        await api.patch(`/movies/watchlist/${tmdbId}/rate`, { rating });
      showToast("Moved to Watched");
      fetchProfile();
    } catch {
      showToast("Failed to update status");
      fetchMovies();
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

  const handleModalRate = async (star: number) => {
    if (ratingModalData.tmdbId)
      await confirmMarkWatched(ratingModalData.tmdbId, star);
    setRatingModalData({ isOpen: false, tmdbId: null, title: "" });
  };

  const closeRatingModal = () => {
    setRatingModalData({ isOpen: false, tmdbId: null, title: "" });
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("custom_username");
    localStorage.removeItem("custom_avatarUrl");
    if (ENABLE_CACHE) localStorage.removeItem(PROFILE_CACHE_KEY);
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
      <div className="space-y-5 sm:space-y-8 animate-fade-in px-1 sm:px-0">
        <div className="flex flex-col p-4 sm:p-8 bg-gray-800 rounded-3xl border border-gray-700 shadow-xl gap-5">
          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="w-20 h-20 sm:w-32 sm:h-32 bg-gradient-to-tr from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-3xl sm:text-5xl font-bold shadow-lg uppercase text-white shrink-0 overflow-hidden border-2 border-gray-600">
              {avatarUrl ? (
                <img
                  src={`${avatarUrl}${avatarUrl.includes("?") ? "&" : "?"}t=${new Date().getTime()}`}
                  alt={username}
                  className="w-full h-full object-cover"
                />
              ) : (
                username.charAt(0)
              )}
            </div>

            <div className="flex-grow w-full">
              <div className="flex items-center justify-center sm:justify-start gap-3 mb-4">
                <h2 className="text-xl sm:text-4xl font-bold text-white tracking-tight text-center sm:text-left">
                  {username}
                </h2>
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 bg-gray-700 hover:bg-gray-600 rounded-full transition border border-gray-600 shadow-sm flex-shrink-0"
                  title="Edit Profile"
                >
                  <span className="text-sm">✏️</span>
                </button>
              </div>

              <div className="grid grid-cols-2 xs:grid-cols-3 sm:flex sm:flex-wrap gap-2">
                {achievementsList.map((achievement) => (
                  <div
                    key={achievement.id}
                    title={achievement.description}
                    className={`px-2 py-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all duration-500 border text-center flex items-center justify-center ${
                      achievement.isUnlocked
                        ? `${achievement.activeClasses} scale-100 opacity-100 shadow-sm`
                        : "bg-gray-900/40 border-gray-800 text-gray-600 scale-95 opacity-50 grayscale"
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

          <div className="grid grid-cols-2 gap-3 w-full">
            <div className="text-center bg-gray-900/80 px-4 py-4 rounded-2xl border border-gray-700 shadow-inner">
              <div className="text-2xl sm:text-3xl font-black text-red-400">
                {favoritesCount}
              </div>
              <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mt-1">
                Favorites
              </div>
            </div>
            <div className="text-center bg-gray-900/80 px-4 py-4 rounded-2xl border border-gray-700 shadow-inner">
              <div className="text-2xl sm:text-3xl font-black text-green-400">
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
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
              <div
                className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                style={{ animationDelay: "0.1s" }}
              ></div>
              <div
                className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                style={{ animationDelay: "0.2s" }}
              ></div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5 sm:gap-8">
            <div className="p-4 sm:p-8 bg-gray-800 rounded-3xl border border-gray-700 shadow-xl">
              <h3 className="text-base sm:text-xl font-bold text-white mb-4">
                Top 5 Favorites
              </h3>
              {!profileData?.favorites || profileData.favorites.length === 0 ? (
                <div className="text-center py-8 bg-gray-900/30 rounded-2xl border border-gray-700/50 border-dashed text-gray-500 text-xs italic">
                  You haven't liked any movies yet.
                </div>
              ) : (
                <div className="grid grid-cols-3 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 sm:gap-6">
                  {profileData.favorites.map((fav) => (
                    <div
                      key={fav.id}
                      className="group relative flex flex-col items-center"
                    >
                      <Link
                        to={`/movie/${fav.tmdbId}?type=${fav.mediaType || "movie"}`}
                        className="w-full aspect-[2/3] rounded-xl overflow-hidden shadow-lg border border-gray-700 bg-gray-900 relative"
                      >
                        {fav.posterUrl ? (
                          <img
                            src={fav.posterUrl}
                            alt={fav.title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          />
                        ) : (
                          <div className="flex items-center justify-center w-full h-full text-[10px] text-gray-600 italic">
                            No poster
                          </div>
                        )}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            handleToggleFavorite(fav.tmdbId);
                          }}
                          className="absolute top-2 right-2 w-8 h-8 bg-gray-900/80 rounded-full flex items-center justify-center border border-gray-600/50 hover:bg-red-500/20 transition backdrop-blur-sm"
                        >
                          <svg
                            className="w-3.5 h-3.5 text-red-500 fill-red-500"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                            />
                          </svg>
                        </button>
                      </Link>
                      <Link
                        to={`/movie/${fav.tmdbId}`}
                        className="mt-2 w-full text-center"
                      >
                        <h4 className="text-[10px] sm:text-sm font-bold text-gray-200 truncate hover:text-blue-400 transition">
                          {fav.title}
                        </h4>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 sm:p-8 bg-gray-800 rounded-3xl border border-gray-700 shadow-xl">
              <h3 className="text-base sm:text-xl font-bold text-white mb-4">
                Recent Activity
              </h3>
              {!profileData?.recent || profileData.recent.length === 0 ? (
                <div className="text-center py-8 bg-gray-900/30 rounded-2xl border border-gray-700/50 border-dashed text-gray-500 text-xs italic">
                  No recent activity.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
                  {profileData.recent.map((act) => {
                    const addedStr = new Date(act.addedAt).toLocaleDateString(
                      "en-US",
                      { month: "short", day: "numeric" },
                    );
                    return (
                      <Link
                        to={`/movie/${act.tmdbId}?type=${act.mediaType || "movie"}`}
                        key={act.id}
                        className="flex items-center gap-3 bg-gray-900/50 p-2.5 rounded-2xl border border-gray-700/50 hover:bg-gray-800 transition group"
                      >
                        <div className="w-10 h-14 rounded-lg bg-gray-800 overflow-hidden shrink-0 border border-gray-700">
                          {act.posterUrl ? (
                            <img
                              src={act.posterUrl}
                              alt={act.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[7px] text-gray-600">
                              No Img
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col overflow-hidden">
                          <h4 className="font-bold text-white group-hover:text-blue-400 transition truncate text-xs sm:text-sm">
                            {act.title}
                          </h4>
                          <span className="text-[9px] text-gray-500 uppercase font-semibold mt-1">
                            Added: {addedStr}
                          </span>
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
    <div className="min-h-screen p-3 sm:p-8 bg-gray-900 font-sans text-gray-100 relative">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-4 mb-6 border-b border-gray-800">
          <Link to="/search" className="hover:opacity-80 transition-opacity">
            <h1 className="text-xl sm:text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              Movie Tracker
            </h1>
          </Link>
          <nav className="flex items-center gap-4 sm:gap-8 overflow-x-auto w-full sm:w-auto pb-1 scrollbar-hide">
            <Link
              to="/ai-chat"
              className="text-purple-400 font-bold hover:text-purple-300 transition text-sm whitespace-nowrap flex-shrink-0"
            >
              AI Chat
            </Link>
            <Link
              to="/search"
              className="text-gray-400 hover:text-white transition text-sm whitespace-nowrap flex-shrink-0"
            >
              Search
            </Link>
            <Link
              to="/watchlist"
              className="text-blue-400 font-bold border-b-2 border-blue-400 text-sm pb-0.5 whitespace-nowrap flex-shrink-0"
            >
              My Profile
            </Link>
            <button
              onClick={handleLogout}
              className="text-xs px-3 py-2 bg-red-900/20 text-red-400 rounded-lg hover:bg-red-600 hover:text-white transition whitespace-nowrap flex-shrink-0 min-h-[36px]"
            >
              Logout
            </button>
          </nav>
        </header>

        <div className="flex overflow-x-auto gap-2 sm:gap-4 mb-6 sm:mb-8 scrollbar-hide pb-1">
          <button
            onClick={() => setActiveTab("profile")}
            className={`px-5 sm:px-8 py-2.5 rounded-full font-bold transition-all text-sm whitespace-nowrap flex-shrink-0 min-h-[40px] ${activeTab === "profile" ? "bg-blue-600 text-white shadow-lg" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab("watchlist")}
            className={`px-5 sm:px-8 py-2.5 rounded-full font-bold transition-all text-sm whitespace-nowrap flex-shrink-0 min-h-[40px] ${activeTab === "watchlist" ? "bg-blue-600 text-white shadow-lg" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
          >
            In Plans
          </button>
          <button
            onClick={() => setActiveTab("watched")}
            className={`px-5 sm:px-8 py-2.5 rounded-full font-bold transition-all text-sm whitespace-nowrap flex-shrink-0 min-h-[40px] ${activeTab === "watched" ? "bg-green-600 text-white shadow-lg" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
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
          <div className="text-center p-10 sm:p-12 bg-gray-800/50 rounded-3xl border border-gray-700 shadow-2xl mt-10">
            <p className="text-gray-400 text-lg italic mb-4">
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
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-6">
            {movies.map((item) => (
              <div
                key={item.id}
                className="group overflow-hidden transition bg-gray-800 border border-gray-700 shadow-md rounded-2xl flex flex-col hover:border-blue-500/30 hover:-translate-y-1 hover:shadow-xl relative"
              >
                <Link
                  to={`/movie/${item.tmdbId}?type=${item.mediaType || "movie"}`}
                  className="relative w-full aspect-[2/3] bg-gray-900 block overflow-hidden"
                >
                  {item.posterUrl ? (
                    <img
                      src={item.posterUrl}
                      alt={item.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full text-gray-600 text-xs italic">
                      No poster
                    </div>
                  )}
                  {activeTab === "watched" && (
                    <div className="absolute top-2 right-2 bg-green-500/90 text-white text-[8px] font-bold px-2 py-0.5 rounded-full backdrop-blur-sm uppercase tracking-wider">
                      Watched
                    </div>
                  )}
                </Link>

                <div className="p-2.5 sm:p-3 flex flex-col flex-grow z-10 bg-gray-800">
                  <Link
                    to={`/movie/${item.tmdbId}?type=${item.mediaType || "movie"}`}
                    className="text-xs sm:text-base font-bold text-white truncate hover:text-blue-400 transition"
                    title={item.title}
                  >
                    {item.title}
                  </Link>

                  <p className="hidden sm:block mt-0.5 text-[10px] uppercase tracking-tighter text-gray-500 mb-2 font-semibold">
                    Added: {new Date(item.addedAt).toLocaleDateString("en-US")}
                  </p>

                  <div
                    className="flex justify-center gap-0.5 sm:gap-1 mb-2 mt-auto pt-2"
                    onMouseLeave={() => {
                      setHoveredMovieId(null);
                      setHoveredStar(0);
                    }}
                  >
                    {[1, 2, 3, 4, 5].map((star) => {
                      const isActive =
                        (hoveredMovieId === item.tmdbId
                          ? hoveredStar
                          : item.rating || 0) >= star;
                      return (
                        <button
                          key={star}
                          onMouseEnter={() => {
                            setHoveredMovieId(item.tmdbId);
                            setHoveredStar(star);
                          }}
                          onClick={() => handleRateMovie(item.tmdbId, star)}
                          className={`text-xl sm:text-2xl p-0.5 transition-all duration-200 active:scale-150 ${
                            isActive
                              ? "text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.4)]"
                              : "text-gray-700 hover:text-yellow-400/40"
                          }`}
                        >
                          ★
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex justify-between items-center gap-1 pt-2 border-t border-gray-700/50">
                    {activeTab === "watchlist" ? (
                      <button
                        onClick={() => handleMarkWatched(item.tmdbId)}
                        className="text-[10px] font-bold text-green-400 hover:text-green-300 transition uppercase tracking-tighter min-h-[32px] flex items-center"
                      >
                        Watched
                      </button>
                    ) : (
                      <Link
                        to={`/movie/${item.tmdbId}?type=${item.mediaType || "movie"}`}
                        className="text-[10px] font-bold text-blue-400 hover:text-blue-300 transition uppercase tracking-tighter min-h-[32px] flex items-center"
                      >
                        Details
                      </Link>
                    )}

                    <div className="flex items-center gap-2 sm:gap-3">
                      <button
                        onClick={() => handleDelete(item.tmdbId)}
                        className="text-[10px] font-bold text-red-400/60 hover:text-red-400 transition uppercase min-h-[32px] flex items-center px-1"
                      >
                        Del
                      </button>
                      <button
                        onClick={() => handleToggleFavorite(item.tmdbId)}
                        className="group/heart p-1 min-h-[32px] flex items-center"
                      >
                        <svg
                          className={`w-4 h-4 sm:w-5 sm:h-5 transition ${item.isFavorite ? "text-red-500 fill-red-500" : "text-gray-500 group-hover/heart:text-red-500"}`}
                          fill={item.isFavorite ? "currentColor" : "none"}
                          stroke="currentColor"
                          strokeWidth="2.5"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                          />
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

      {ratingModalData.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="bg-gray-800 border border-gray-700 rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl relative animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeRatingModal}
              className="absolute top-4 right-4 text-gray-500 hover:text-white transition p-1"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
            <div className="text-center">
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
                How was it?
              </h3>
              <p className="text-sm text-gray-400 mb-6 sm:mb-8">
                Rate "{ratingModalData.title}" or skip to just mark as watched.
              </p>
              <div
                className="flex justify-center gap-2 mb-6 sm:mb-8"
                onMouseLeave={() => setModalHoveredStar(0)}
              >
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onMouseEnter={() => setModalHoveredStar(star)}
                    onClick={() => handleModalRate(star)}
                    className={`text-4xl sm:text-5xl transition-all duration-200 transform hover:scale-125 active:scale-150 p-1 ${
                      modalHoveredStar >= star
                        ? "text-yellow-400 drop-shadow-[0_0_12px_rgba(250,204,21,0.5)]"
                        : "text-gray-600"
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <button
                onClick={closeRatingModal}
                className="text-xs font-bold text-gray-500 hover:text-white uppercase tracking-widest transition py-2 px-4"
              >
                Skip Rating
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <EditProfileModal
          currentUsername={username}
          currentAvatarUrl={avatarUrl}
          onClose={() => setIsEditModalOpen(false)}
          onUpdate={(newUsername, newAvatarUrl) => {
            setUsername(newUsername);
            setAvatarUrl(newAvatarUrl);

            // 4. ВИПРАВЛЕННЯ: Миттєво зберігаємо наші дані локально
            localStorage.setItem("custom_username", newUsername);
            if (newAvatarUrl) {
              localStorage.setItem("custom_avatarUrl", newAvatarUrl);
            }

            localStorage.removeItem(PROFILE_CACHE_KEY);
            fetchProfile();
            showToast("Profile updated successfully!");
          }}
        />
      )}

      {toastMessage && (
        <div className="fixed bottom-5 left-4 right-4 sm:left-auto sm:right-10 sm:bottom-10 bg-gray-800 border border-gray-700 text-white px-5 py-4 rounded-2xl shadow-2xl flex items-center justify-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300 z-50">
          <span className="font-semibold text-sm sm:text-base">
            {toastMessage}
          </span>
        </div>
      )}
    </div>
  );
}

interface EditProfileProps {
  currentUsername: string;
  currentAvatarUrl: string | null;
  onClose: () => void;
  onUpdate: (newUsername: string, newAvatarUrl: string) => void;
}

function EditProfileModal({
  currentUsername,
  currentAvatarUrl,
  onClose,
  onUpdate,
}: EditProfileProps) {
  const [username, setUsername] = useState(currentUsername);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatarUrl);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    const formData = new FormData();
    formData.append("username", username);
    if (selectedFile) formData.append("avatar", selectedFile);
    try {
      const response = await api.patch("users/profile", formData);
      onUpdate(response.data.username, response.data.avatarUrl);
      onClose();
    } catch (err: any) {
      if (err.response?.status === 409) {
        setError("That username is already taken by another user!");
      } else {
        setError(
          "An error occurred while updating your profile. Please try again.",
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-md p-6 sm:p-8 bg-gray-800 border border-gray-700 rounded-3xl shadow-2xl relative animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition p-1"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <h2 className="text-xl sm:text-2xl font-bold text-white text-center mb-6">
          Edit Profile
        </h2>

        {error && (
          <div className="mb-5 p-3 text-sm text-red-200 bg-red-900/40 border border-red-500/50 rounded-xl text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
          <div className="flex flex-col items-center">
            <div
              className="relative group cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              {previewUrl ? (
                <img
                  src={
                    previewUrl.includes("blob:")
                      ? previewUrl
                      : `${previewUrl}${previewUrl.includes("?") ? "&" : "?"}t=${new Date().getTime()}`
                  }
                  alt="Profile Preview"
                  className="w-24 h-24 rounded-full object-cover border-4 border-gray-700 group-hover:border-blue-500 transition-colors"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-purple-500 to-blue-500 flex items-center justify-center text-3xl font-bold text-white border-4 border-gray-700 group-hover:border-blue-500 transition-colors">
                  {username.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <svg
                  className="w-8 h-8 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
            </div>
            <input
              type="file"
              accept="image/png, image/jpeg, image/webp"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
            />
            <p className="text-xs text-gray-500 mt-3 font-semibold">
              Click image to change (Max 5MB)
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 ml-1 mb-1">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 text-white bg-gray-900 border border-gray-700 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              minLength={3}
              maxLength={20}
              required
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !username}
            className="w-full py-4 font-bold text-white transition bg-blue-600 rounded-xl hover:bg-blue-500 active:scale-[0.98] disabled:bg-gray-700 disabled:text-gray-500 shadow-lg shadow-blue-900/20 min-h-[52px]"
          >
            {isLoading ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
}

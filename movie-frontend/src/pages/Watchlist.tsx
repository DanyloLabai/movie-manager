import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
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
  stats?: {
    totalMinutes: number;
    topGenre: string;
    genreDistribution: { name: string; value: number }[];
    topRated: WatchlistItem[];
  };
}

const getUserIdFromToken = (): string => {
  const token = localStorage.getItem("token");
  if (!token) return "guest";
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return String(payload.sub || payload.id || payload.userId || "guest");
  } catch {
    return "guest";
  }
};

const getProfileCacheKey = () =>
  `movie_tracker_profile_cache_${getUserIdFromToken()}`;
const ENABLE_CACHE = import.meta.env.VITE_ENABLE_PROFILE_CACHE !== "false";

const CHART_COLORS = ["#c8963c", "#9a732a", "#e8c070", "#5c4519", "#3a2b0f"];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a1714] border border-[#c8963c]/50 p-3 rounded-xl shadow-xl">
        <p className="text-[#f0e6cc] font-bold text-xs uppercase tracking-widest">
          {payload[0].name}:{" "}
          <span className="text-[#c8963c]">{payload[0].value}</span>
        </p>
      </div>
    );
  }
  return null;
};

const getUserRank = (watchedCount: number) => {
  if (watchedCount >= 100) return "Film Legend";
  if (watchedCount >= 50) return "Cinema Curator";
  if (watchedCount >= 20) return "Cinephile";
  if (watchedCount >= 5) return "Movie Enthusiast";
  return "Cinema Guest";
};

export default function Watchlist() {
  const getUsernameKey = () => `custom_username_${getUserIdFromToken()}`;
  const getAvatarKey = () => `custom_avatarUrl_${getUserIdFromToken()}`;
  const [movies, setMovies] = useState<WatchlistItem[]>([]);

  const [profileData, setProfileData] = useState<ProfileData | null>(() => {
    if (!ENABLE_CACHE) return null;
    try {
      const cached = localStorage.getItem(getProfileCacheKey());
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
    const savedName = localStorage.getItem(getUsernameKey());
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
    const savedAvatar = localStorage.getItem(getAvatarKey());
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

      if (!localStorage.getItem(getAvatarKey()) && response.data.avatarUrl) {
        setAvatarUrl(response.data.avatarUrl);
      }
      if (!localStorage.getItem(getUsernameKey()) && response.data.username) {
        setUsername(response.data.username);
      }

      if (ENABLE_CACHE) {
        localStorage.setItem(
          getProfileCacheKey(),
          JSON.stringify(response.data),
        );
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
    localStorage.removeItem(getUsernameKey());
    localStorage.removeItem(getAvatarKey());
    if (ENABLE_CACHE) localStorage.removeItem(getProfileCacheKey());
    navigate("/login");
  };

  const renderProfileTab = () => {
    const totalCount = profileData?.totalCount || 0;
    const favoritesCount = profileData?.favorites?.length || 0;
    const watchedCount = profileData?.watchedCount || 0;
    const userRank = getUserRank(watchedCount);

    const achievementsList = [
      {
        id: "first_blood",
        isUnlocked: totalCount > 0,
        unlockedText: "🏆 First Blood",
        lockedText: "🔒 First Blood",
        description: "Add your first movie or TV show to the tracker",
      },
      {
        id: "critic",
        isUnlocked: favoritesCount >= 5,
        unlockedText: "⭐ Critic",
        lockedText: `🔒 Critic (${favoritesCount}/5)`,
        description: "Add 5 items to your favorites",
      },
      {
        id: "cinephile",
        isUnlocked: watchedCount >= 10,
        unlockedText: "🍿 Cinephile",
        lockedText: `🔒 Cinephile (${watchedCount}/10)`,
        description: "Mark 10 items as watched",
      },
      {
        id: "collector",
        isUnlocked: totalCount >= 20,
        unlockedText: "📚 Collector",
        lockedText: `🔒 Collector (${totalCount}/20)`,
        description: "Add 20 items to your tracker in total",
      },
      {
        id: "tastemaker",
        isUnlocked: favoritesCount >= 20,
        unlockedText: "💖 Tastemaker",
        lockedText: `🔒 Tastemaker (${favoritesCount}/20)`,
        description: "Add 20 items to your favorites",
      },
      {
        id: "filmbuff",
        isUnlocked: watchedCount >= 50,
        unlockedText: "🎬 Film Buff",
        lockedText: `🔒 Film Buff (${watchedCount}/50)`,
        description: "Mark 50 items as watched",
      },
      {
        id: "librarian",
        isUnlocked: totalCount >= 100,
        unlockedText: "🏛️ Librarian",
        lockedText: `🔒 Librarian (${totalCount}/100)`,
        description: "Add 100 items to your tracker in total",
      },
    ];

    return (
      <div className="space-y-5 sm:space-y-8 animate-fade-in px-1 sm:px-0">
        <div className="flex flex-col p-4 sm:p-8 bg-[#1a1714] rounded-3xl border border-[#c8963c]/20 shadow-xl gap-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#c8963c] to-[#9a732a]" />

          <div className="flex flex-col sm:flex-row items-center gap-5">
            <div className="w-20 h-20 sm:w-32 sm:h-32 bg-gradient-to-tr from-[#c8963c] to-[#9a732a] rounded-full flex items-center justify-center text-3xl sm:text-5xl font-black shadow-lg uppercase text-[#12100e] shrink-0 overflow-hidden border-2 border-[#c8963c]/50">
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
              <div className="flex items-center justify-center sm:justify-start gap-3 mb-1">
                <h2 className="text-xl sm:text-4xl font-black text-[#f0e6cc] tracking-tight text-center sm:text-left">
                  {username}
                </h2>
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 bg-[#12100e] hover:bg-[#c8963c]/20 rounded-full transition border border-[#c8963c]/30 shadow-sm flex-shrink-0 text-[#c8963c]"
                  title="Edit Profile"
                >
                  <span className="text-sm">✏️</span>
                </button>
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/user/${username}`;
                    navigator.clipboard.writeText(url);
                    showToast("Profile link copied to clipboard! 🔗");
                  }}
                  className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 bg-[#12100e] hover:bg-[#c8963c]/20 rounded-full transition border border-[#c8963c]/30 shadow-sm flex-shrink-0 text-[#c8963c]"
                  title="Share Profile"
                >
                  <span className="text-sm">🔗</span>
                </button>
              </div>

              <p className="text-[10px] text-[#c8963c] font-bold uppercase tracking-[0.2em] mb-4 text-center sm:text-left">
                {userRank}
              </p>

              <div className="grid grid-cols-2 xs:grid-cols-3 sm:flex sm:flex-wrap gap-2">
                {achievementsList.map((achievement) => (
                  <div
                    key={achievement.id}
                    title={achievement.description}
                    className={`px-2 py-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all duration-500 border text-center flex items-center justify-center ${
                      achievement.isUnlocked
                        ? "bg-[#c8963c]/10 border-[#c8963c]/40 text-[#c8963c] shadow-sm"
                        : "bg-[#12100e] border-[#c8963c]/10 text-[#f0e6cc]/30 grayscale"
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

          <div className="grid grid-cols-2 gap-3 w-full mt-2">
            <div className="text-center bg-[#12100e] px-4 py-4 rounded-2xl border border-[#c8963c]/20 shadow-inner">
              <div className="text-2xl sm:text-3xl font-black text-[#c8963c]">
                {favoritesCount}
              </div>
              <div className="text-[10px] text-[#f0e6cc]/50 uppercase tracking-widest font-bold mt-1">
                Favorites
              </div>
            </div>
            <div className="text-center bg-[#12100e] px-4 py-4 rounded-2xl border border-[#c8963c]/20 shadow-inner">
              <div className="text-2xl sm:text-3xl font-black text-[#c8963c]">
                {watchedCount}
              </div>
              <div className="text-[10px] text-[#f0e6cc]/50 uppercase tracking-widest font-bold mt-1">
                Watched
              </div>
            </div>
          </div>
        </div>

        {/* --- STATS SECTION (WRAPPED) --- */}
        {profileData?.stats &&
          profileData.stats.genreDistribution.length > 0 && (
            <div className="p-5 sm:p-8 bg-[#1a1714] rounded-3xl border border-[#c8963c]/20 shadow-xl mt-5 sm:mt-8">
              <h3 className="text-base sm:text-xl font-black text-[#f0e6cc] uppercase tracking-widest mb-6 border-b border-[#c8963c]/20 pb-3">
                Your Movie Wrapped
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="space-y-4">
                  <div className="bg-[#12100e] border border-[#c8963c]/20 p-5 rounded-2xl shadow-inner">
                    <p className="text-[10px] text-[#f0e6cc]/50 uppercase tracking-widest font-bold mb-2 flex items-center gap-2">
                      <span className="text-[#c8963c]">⏱</span> Time Spent
                    </p>
                    <p className="text-2xl sm:text-3xl font-black text-[#c8963c]">
                      {Math.floor(profileData.stats.totalMinutes / 60)}{" "}
                      <span className="text-sm font-medium text-[#f0e6cc]/60 uppercase tracking-widest">
                        hours
                      </span>{" "}
                      {profileData.stats.totalMinutes % 60}{" "}
                      <span className="text-sm font-medium text-[#f0e6cc]/60 uppercase tracking-widest">
                        min
                      </span>
                    </p>
                  </div>
                  <div className="bg-[#12100e] border border-[#c8963c]/20 p-5 rounded-2xl shadow-inner">
                    <p className="text-[10px] text-[#f0e6cc]/50 uppercase tracking-widest font-bold mb-2 flex items-center gap-2">
                      <span className="text-[#c8963c]">🏆</span> Top Genre
                    </p>
                    <p className="text-2xl sm:text-3xl font-black text-[#c8963c]">
                      {profileData.stats.topGenre}
                    </p>
                  </div>
                </div>

                <div className="h-64 w-full relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={profileData.stats.genreDistribution}
                        innerRadius={70}
                        outerRadius={90}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {profileData.stats.genreDistribution.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        content={<CustomTooltip />}
                        cursor={{ fill: "transparent" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col">
                    <span className="text-[#c8963c] text-xl font-black">
                      {profileData.stats.genreDistribution.length}
                    </span>
                    <span className="text-[#f0e6cc]/40 text-[10px] font-bold uppercase tracking-widest">
                      Genres
                    </span>
                  </div>
                </div>
              </div>

              {profileData.stats.topRated &&
                profileData.stats.topRated.length > 0 && (
                  <div className="mt-10 border-t border-[#c8963c]/10 pt-8">
                    <h4 className="text-[10px] text-[#c8963c] font-black uppercase tracking-[0.4em] mb-6 text-center">
                      Top 3 Rated Masterpieces
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {profileData.stats.topRated.map((item, index) => (
                        <Link
                          to={`/movie/${item.tmdbId}?type=${item.mediaType}`}
                          key={item.id}
                          className="relative group bg-[#12100e] border border-[#c8963c]/10 rounded-2xl p-3 flex items-center gap-4 hover:border-[#c8963c]/40 transition-all shadow-lg"
                        >
                          {/* Номер місця */}
                          <div className="absolute -top-2 -left-2 w-7 h-7 bg-[#c8963c] text-[#12100e] rounded-full flex items-center justify-center font-black text-xs shadow-lg z-10 border border-[#1a1714]">
                            #{index + 1}
                          </div>

                          <div className="w-12 h-16 shrink-0 rounded-lg overflow-hidden border border-[#c8963c]/10 bg-[#1a1714]">
                            {item.posterUrl ? (
                              <img
                                src={item.posterUrl}
                                alt=""
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[7px] text-[#f0e6cc]/20 font-black">
                                N/A
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col min-w-0">
                            <h5 className="text-[#f0e6cc] font-bold text-[11px] truncate group-hover:text-[#c8963c] transition-colors leading-tight">
                              {item.title}
                            </h5>
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-[#c8963c] text-[10px] font-black">
                                ★ {item.rating}.0
                              </span>
                              <span className="text-[7px] text-[#f0e6cc]/30 uppercase font-bold tracking-widest hidden xs:inline">
                                Score
                              </span>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )}

        {isLoading && !profileData ? (
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
        ) : (
          <div className="flex flex-col gap-5 sm:gap-8">
            <div className="p-4 sm:p-8 bg-[#1a1714] rounded-3xl border border-[#c8963c]/20 shadow-xl">
              <h3 className="text-base sm:text-xl font-black text-[#f0e6cc] uppercase tracking-widest mb-4">
                Top Favorites
              </h3>
              {!profileData?.favorites || profileData.favorites.length === 0 ? (
                <div className="text-center py-8 bg-[#12100e] rounded-2xl border border-[#c8963c]/20 border-dashed text-[#f0e6cc]/50 text-xs italic">
                  You haven't liked any movies yet.
                </div>
              ) : (
                <div className="grid grid-cols-3 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 sm:gap-6">
                  {profileData.favorites.slice(0, 5).map((fav) => (
                    <div
                      key={fav.id}
                      className="group relative flex flex-col items-center"
                    >
                      <Link
                        to={`/movie/${fav.tmdbId}?type=${fav.mediaType || "movie"}`}
                        className="w-full aspect-[2/3] rounded-xl overflow-hidden shadow-lg border border-[#c8963c]/20 bg-[#12100e] relative"
                      >
                        {fav.posterUrl ? (
                          <img
                            src={fav.posterUrl}
                            alt={fav.title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          />
                        ) : (
                          <div className="flex items-center justify-center w-full h-full text-[10px] text-[#f0e6cc]/30 italic">
                            No poster
                          </div>
                        )}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            handleToggleFavorite(fav.tmdbId);
                          }}
                          className="absolute top-2 right-2 w-8 h-8 bg-[#12100e]/80 rounded-full flex items-center justify-center border border-[#c8963c]/30 hover:bg-[#1a1714] transition backdrop-blur-sm"
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
                        <h4 className="text-[10px] sm:text-sm font-bold text-[#f0e6cc] truncate hover:text-[#c8963c] transition">
                          {fav.title}
                        </h4>
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 sm:p-8 bg-[#1a1714] rounded-3xl border border-[#c8963c]/20 shadow-xl">
              <h3 className="text-base sm:text-xl font-black text-[#f0e6cc] uppercase tracking-widest mb-4">
                Recent Activity
              </h3>
              {!profileData?.recent || profileData.recent.length === 0 ? (
                <div className="text-center py-8 bg-[#12100e] rounded-2xl border border-[#c8963c]/20 border-dashed text-[#f0e6cc]/50 text-xs italic">
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
                        className="flex items-center gap-3 bg-[#12100e] p-2.5 rounded-2xl border border-[#c8963c]/10 hover:border-[#c8963c]/40 hover:bg-[#1a1714] transition group shadow-sm"
                      >
                        <div className="w-10 h-14 rounded-lg bg-[#1a1714] overflow-hidden shrink-0 border border-[#c8963c]/20">
                          {act.posterUrl ? (
                            <img
                              src={act.posterUrl}
                              alt={act.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[7px] text-[#f0e6cc]/30">
                              No Img
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col overflow-hidden">
                          <h4 className="font-bold text-[#f0e6cc] group-hover:text-[#c8963c] transition truncate text-xs sm:text-sm">
                            {act.title}
                          </h4>
                          <span className="text-[9px] text-[#f0e6cc]/50 uppercase font-semibold mt-1">
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
    <div className="min-h-[100dvh] p-3 sm:p-8 bg-[#12100e] font-sans text-[#f0e6cc] relative overscroll-none selection:bg-[#c8963c] selection:text-[#12100e]">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-4 mb-6 border-b border-[#c8963c]/20">
          <Link to="/search" className="hover:opacity-80 transition-opacity">
            <h1 className="text-2xl sm:text-3xl font-black text-[#c8963c] tracking-tight uppercase text-center md:text-left drop-shadow-md">
              Movie Tracker
            </h1>
          </Link>
          <nav className="flex items-center gap-4 sm:gap-8 overflow-x-auto w-full sm:w-auto pb-1 scrollbar-hide">
            <Link
              to="/ai-chat"
              className="text-[#f0e6cc]/60 hover:text-[#c8963c] transition-colors text-sm sm:text-base px-1 tracking-wide uppercase font-semibold whitespace-nowrap flex-shrink-0"
            >
              AI Chat
            </Link>
            <Link
              to="/search"
              className="text-[#f0e6cc]/60 hover:text-[#c8963c] transition-colors text-sm sm:text-base px-1 tracking-wide uppercase font-semibold whitespace-nowrap flex-shrink-0"
            >
              Search
            </Link>
            <Link
              to="/watchlist"
              className="text-[#c8963c] font-bold border-b-2 border-[#c8963c] transition-all text-sm sm:text-base px-1 tracking-wide uppercase whitespace-nowrap flex-shrink-0"
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

        <div className="flex overflow-x-auto gap-2 sm:gap-4 mb-6 sm:mb-8 scrollbar-hide pb-1">
          <button
            onClick={() => setActiveTab("profile")}
            className={`px-5 sm:px-8 py-2.5 rounded-full font-bold transition-all text-sm whitespace-nowrap flex-shrink-0 min-h-[40px] uppercase tracking-wider ${
              activeTab === "profile"
                ? "bg-[#c8963c] text-[#12100e] shadow-md"
                : "bg-[#1a1714] text-[#f0e6cc]/50 hover:bg-[#c8963c]/10 hover:text-[#c8963c] border border-[#c8963c]/20"
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab("watchlist")}
            className={`px-5 sm:px-8 py-2.5 rounded-full font-bold transition-all text-sm whitespace-nowrap flex-shrink-0 min-h-[40px] uppercase tracking-wider ${
              activeTab === "watchlist"
                ? "bg-[#c8963c] text-[#12100e] shadow-md"
                : "bg-[#1a1714] text-[#f0e6cc]/50 hover:bg-[#c8963c]/10 hover:text-[#c8963c] border border-[#c8963c]/20"
            }`}
          >
            In Plans
          </button>
          <button
            onClick={() => setActiveTab("watched")}
            className={`px-5 sm:px-8 py-2.5 rounded-full font-bold transition-all text-sm whitespace-nowrap flex-shrink-0 min-h-[40px] uppercase tracking-wider ${
              activeTab === "watched"
                ? "bg-[#c8963c] text-[#12100e] shadow-md"
                : "bg-[#1a1714] text-[#f0e6cc]/50 hover:bg-[#c8963c]/10 hover:text-[#c8963c] border border-[#c8963c]/20"
            }`}
          >
            Watched
          </button>
        </div>

        {activeTab === "profile" ? (
          renderProfileTab()
        ) : isLoading ? (
          <p className="text-center text-[#f0e6cc]/50 animate-pulse text-lg mt-10 font-semibold uppercase tracking-widest">
            Loading your list...
          </p>
        ) : movies.length === 0 ? (
          <div className="text-center p-10 sm:p-12 bg-[#1a1714] rounded-3xl border border-[#c8963c]/20 shadow-2xl mt-10 max-w-lg mx-auto">
            <p className="text-[#f0e6cc]/60 text-lg font-medium mb-6">
              It's empty here. Add some movies!
            </p>
            <Link
              to="/search"
              className="inline-block px-8 py-3.5 bg-[#c8963c] text-[#12100e] font-black uppercase tracking-wider rounded-xl hover:bg-[#e8c070] transition shadow-lg"
            >
              Discover Movies
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
            {movies.map((item) => (
              <div
                key={item.id}
                className="group overflow-hidden transition bg-[#1a1714] border border-[#c8963c]/20 shadow-lg rounded-2xl flex flex-col hover:border-[#c8963c]/70 hover:shadow-[#c8963c]/10 hover:-translate-y-1 relative"
              >
                <Link
                  to={`/movie/${item.tmdbId}?type=${item.mediaType || "movie"}`}
                  className="relative w-full aspect-[2/3] bg-[#12100e] block overflow-hidden"
                >
                  {item.posterUrl ? (
                    <img
                      src={item.posterUrl}
                      alt={item.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full text-[#f0e6cc]/30 text-xs italic">
                      No poster
                    </div>
                  )}
                  {activeTab === "watched" && (
                    <div className="absolute top-2 right-2 bg-[#c8963c] text-[#12100e] text-[8px] font-black px-2 py-0.5 rounded-full shadow-md uppercase tracking-wider">
                      Watched
                    </div>
                  )}
                </Link>

                <div className="p-3 sm:p-4 flex flex-col flex-grow z-10 bg-[#1a1714]">
                  <Link
                    to={`/movie/${item.tmdbId}?type=${item.mediaType || "movie"}`}
                    className="text-xs sm:text-base font-bold text-[#f0e6cc] truncate hover:text-[#c8963c] transition"
                    title={item.title}
                  >
                    {item.title}
                  </Link>

                  <p className="hidden sm:block mt-1 text-[10px] uppercase tracking-wider text-[#f0e6cc]/50 mb-2 font-semibold">
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
                              ? "text-[#c8963c] drop-shadow-[0_0_8px_rgba(200,150,60,0.5)]"
                              : "text-[#f0e6cc]/20 hover:text-[#c8963c]/50"
                          }`}
                        >
                          ★
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex justify-between items-center gap-1 pt-3 border-t border-[#c8963c]/20">
                    {activeTab === "watchlist" ? (
                      <button
                        onClick={() => handleMarkWatched(item.tmdbId)}
                        className="text-[10px] font-bold text-[#c8963c] hover:text-[#e8c070] transition uppercase tracking-widest min-h-[32px] flex items-center"
                      >
                        Watched
                      </button>
                    ) : (
                      <Link
                        to={`/movie/${item.tmdbId}?type=${item.mediaType || "movie"}`}
                        className="text-[10px] font-bold text-[#c8963c] hover:text-[#e8c070] transition uppercase tracking-widest min-h-[32px] flex items-center"
                      >
                        Details
                      </Link>
                    )}

                    <div className="flex items-center gap-2 sm:gap-3">
                      <button
                        onClick={() => handleDelete(item.tmdbId)}
                        className="text-[10px] font-bold text-red-500/60 hover:text-red-500 transition uppercase min-h-[32px] flex items-center px-1 tracking-widest"
                      >
                        Del
                      </button>
                      <button
                        onClick={() => handleToggleFavorite(item.tmdbId)}
                        className="group/heart p-1 min-h-[32px] flex items-center"
                      >
                        <svg
                          className={`w-4 h-4 sm:w-5 sm:h-5 transition ${
                            item.isFavorite
                              ? "text-red-500 fill-red-500"
                              : "text-[#f0e6cc]/30 group-hover/heart:text-red-500"
                          }`}
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="bg-[#1a1714] border border-[#c8963c]/30 rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl relative animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeRatingModal}
              className="absolute top-4 right-4 text-[#f0e6cc]/50 hover:text-[#c8963c] transition p-1"
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
              <h3 className="text-xl sm:text-2xl font-black text-[#c8963c] mb-2 uppercase tracking-wide">
                How was it?
              </h3>
              <p className="text-sm text-[#f0e6cc]/60 mb-6 sm:mb-8">
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
                        ? "text-[#c8963c] drop-shadow-[0_0_12px_rgba(200,150,60,0.5)]"
                        : "text-[#f0e6cc]/20"
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <button
                onClick={closeRatingModal}
                className="text-xs font-bold text-[#f0e6cc]/50 hover:text-[#c8963c] uppercase tracking-widest transition py-2 px-4"
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

            if (newAvatarUrl) {
              setAvatarUrl(newAvatarUrl);
              localStorage.setItem(getAvatarKey(), newAvatarUrl);
            }

            localStorage.setItem(getUsernameKey(), newUsername);
            localStorage.removeItem(getProfileCacheKey());

            fetchProfile();

            showToast("Profile updated successfully!");
          }}
        />
      )}

      {toastMessage && (
        <div className="fixed bottom-5 left-4 right-4 sm:left-auto sm:right-10 sm:bottom-10 bg-[#1a1714] border border-[#c8963c]/50 text-[#c8963c] px-6 py-4 rounded-xl shadow-2xl flex items-center justify-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300 z-50 uppercase tracking-widest font-bold">
          <span className="text-xs sm:text-sm text-center">{toastMessage}</span>
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

    const trimmedUsername = username.trim();

    if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
      setError("Username can only contain letters, numbers, and underscores.");
      return;
    }

    setIsLoading(true);
    const formData = new FormData();

    if (trimmedUsername !== currentUsername) {
      formData.append("username", trimmedUsername);
    }

    if (selectedFile) formData.append("avatar", selectedFile);

    if (!selectedFile && trimmedUsername === currentUsername) {
      setIsLoading(false);
      onClose();
      return;
    }

    try {
      const response = await api.patch("/users/profile", formData);
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
      <div className="w-full max-w-md p-6 sm:p-8 bg-[#1a1714] border border-[#c8963c]/30 rounded-3xl shadow-2xl relative animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#f0e6cc]/50 hover:text-[#c8963c] transition p-1"
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

        <h2 className="text-xl sm:text-2xl font-black text-[#f0e6cc] uppercase tracking-widest text-center mb-6">
          Edit Profile
        </h2>

        {error && (
          <div className="mb-5 p-3 text-sm text-red-500 bg-red-900/10 border border-red-500/30 rounded-xl text-center font-semibold">
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
                    previewUrl.startsWith("blob:")
                      ? previewUrl
                      : `${previewUrl}${previewUrl.includes("?") ? "&" : "?"}t=${new Date().getTime()}`
                  }
                  alt="Profile Preview"
                  className="w-24 h-24 rounded-full object-cover border-4 border-[#12100e] group-hover:border-[#c8963c] transition-colors shadow-lg"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#c8963c] to-[#9a732a] flex items-center justify-center text-3xl font-black text-[#12100e] border-4 border-[#12100e] group-hover:border-[#c8963c] transition-colors shadow-lg">
                  {username.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="absolute inset-0 bg-[#12100e]/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <svg
                  className="w-8 h-8 text-[#c8963c]"
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
            <p className="text-xs text-[#f0e6cc]/50 mt-3 font-semibold uppercase tracking-wider">
              Click image to change (Max 5MB)
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#c8963c] uppercase tracking-wider ml-1 mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 text-[#f0e6cc] bg-[#12100e] border border-[#c8963c]/30 rounded-xl focus:outline-none focus:border-[#c8963c] focus:ring-1 focus:ring-[#c8963c]/50 transition-all shadow-inner"
              minLength={3}
              maxLength={20}
              required
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !username.trim()}
            className="w-full py-4 font-black text-[#12100e] uppercase tracking-widest transition bg-[#c8963c] rounded-xl hover:bg-[#e8c070] active:scale-[0.98] disabled:bg-[#2a241f] disabled:text-[#c8963c]/30 shadow-lg min-h-[52px]"
          >
            {isLoading ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
}

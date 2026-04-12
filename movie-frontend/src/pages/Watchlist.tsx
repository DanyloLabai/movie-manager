import { useState, useEffect, useRef } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
} from "recharts";
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
  releaseDate?: string | null;
  releaseYear?: string | null;
}

interface ProfileData {
  id?: number;
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
    averageRating: string | number;
    moviesCount: number;
    tvCount: number;
    favoriteDecade: string;
    ratingDistribution: { name: string; value: number }[];
    completionRate: number;
    longestMovie: { title: string; runtime: number };
    topActor: { name: string; count: number; profileUrl: string | null } | null;
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

const isReleased = (item: WatchlistItem): boolean => {
  if (item.releaseDate) {
    const today = new Date();
    const release = new Date(item.releaseDate);
    today.setHours(0, 0, 0, 0);
    release.setHours(0, 0, 0, 0);
    return release <= today;
  }
  return true;
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a1714] border border-[#c8963c]/50 p-2 rounded-xl shadow-xl z-50">
        <p className="text-[#f0e6cc] font-bold text-[10px] uppercase tracking-widest">
          {payload[0].name}:{" "}
          <span className="text-[#c8963c]">{payload[0].value}</span>
        </p>
      </div>
    );
  }
  return null;
};

const RatingTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a1714] border border-[#c8963c]/50 px-2 py-1.5 rounded-xl shadow-xl z-50 flex items-center gap-1.5">
        <span className="text-[#c8963c] font-black text-xs">
          ★ {payload[0].payload.name}
        </span>
        <span className="text-[#f0e6cc]/50 text-xs">|</span>
        <span className="text-[#f0e6cc] font-bold text-[10px]">
          {payload[0].value}
        </span>
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

  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialTab =
    (searchParams.get("tab") as "profile" | "watchlist" | "watched") ||
    "profile";
  const [activeTab, setActiveTab] = useState<
    "profile" | "watchlist" | "watched"
  >(initialTab);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    navigate(`?tab=${activeTab}`, { replace: true });
  }, [activeTab, navigate]);

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
  const [isFriendsModalOpen, setIsFriendsModalOpen] = useState(false);
  const [hoveredMovieId, setHoveredMovieId] = useState<number | null>(null);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [modalHoveredStar, setModalHoveredStar] = useState(0);
  const [ratingModalData, setRatingModalData] = useState<{
    isOpen: boolean;
    tmdbId: number | null;
    title: string;
  }>({ isOpen: false, tmdbId: null, title: "" });

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
      if (!localStorage.getItem(getAvatarKey()) && response.data.avatarUrl)
        setAvatarUrl(response.data.avatarUrl);
      if (!localStorage.getItem(getUsernameKey()) && response.data.username)
        setUsername(response.data.username);
      if (ENABLE_CACHE)
        localStorage.setItem(
          getProfileCacheKey(),
          JSON.stringify(response.data),
        );
    } catch (error: any) {
      if (error.response?.status === 401) handleLogout();
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleFavorite = async (tmdbId: number) => {
    const itemToCheck =
      movies.find((m) => m.tmdbId === tmdbId) ||
      profileData?.favorites.find((f) => f.tmdbId === tmdbId) ||
      profileData?.recent.find((r) => r.tmdbId === tmdbId);
    if (itemToCheck && !isReleased(itemToCheck)) {
      showToast("You can't favorite an unreleased movie!");
      return;
    }
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
    if (!targetMovie) return;
    setRatingModalData({
      isOpen: true,
      tmdbId: targetMovie.tmdbId,
      title: targetMovie.title,
    });
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

  const handleModalSkip = async () => {
    if (ratingModalData.tmdbId)
      await confirmMarkWatched(ratingModalData.tmdbId, null);
    setRatingModalData({ isOpen: false, tmdbId: null, title: "" });
  };

  const closeRatingModal = () =>
    setRatingModalData({ isOpen: false, tmdbId: null, title: "" });

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

    const hasStats = Boolean(
      profileData?.stats &&
      profileData.stats.genreDistribution &&
      profileData.stats.genreDistribution.length > 0,
    );

    const achievementsList = [
      { id: "first_blood", isUnlocked: totalCount > 0, text: "🏆 First Blood" },
      { id: "critic", isUnlocked: favoritesCount >= 5, text: "⭐ Critic" },
      { id: "cinephile", isUnlocked: watchedCount >= 10, text: "🍿 Cinephile" },
      { id: "collector", isUnlocked: totalCount >= 20, text: "📚 Collector" },
      {
        id: "tastemaker",
        isUnlocked: favoritesCount >= 20,
        text: "💖 Tastemaker",
      },
      { id: "filmbuff", isUnlocked: watchedCount >= 50, text: "🎬 Film Buff" },
      { id: "librarian", isUnlocked: totalCount >= 100, text: "🏛️ Librarian" },
    ];

    return (
      <div className="space-y-4 animate-fade-in">
        {/* Profile Header */}
        <div className="flex flex-col p-4 bg-[#1a1714] rounded-2xl border border-[#c8963c]/20 shadow-xl gap-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#c8963c] to-[#9a732a]" />

          {/* Avatar + Username row */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-tr from-[#c8963c] to-[#9a732a] rounded-full flex items-center justify-center text-2xl font-black shadow-lg uppercase text-[#12100e] shrink-0 overflow-hidden border-2 border-[#c8963c]/50">
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

            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-black text-[#f0e6cc] tracking-tight truncate">
                {username}
              </h2>
              <p className="text-[10px] text-[#c8963c] font-bold uppercase tracking-[0.15em]">
                {userRank}
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setIsEditModalOpen(true)}
                className="w-8 h-8 bg-[#12100e] hover:bg-[#c8963c]/20 rounded-full flex items-center justify-center border border-[#c8963c]/30 text-[#c8963c] transition"
                title="Edit Profile"
              >
                <span className="text-xs">✏️</span>
              </button>
              <button
                onClick={() => {
                  const currentId = profileData?.id || getUserIdFromToken();
                  navigator.clipboard.writeText(
                    `${window.location.origin}/user/${currentId}`,
                  );
                  showToast("Invite link copied! 🔗");
                }}
                className="w-8 h-8 bg-[#12100e] hover:bg-[#c8963c]/20 rounded-full flex items-center justify-center border border-[#c8963c]/30 text-[#c8963c] transition"
                title="Share"
              >
                <span className="text-xs">🔗</span>
              </button>
              <button
                onClick={() => setIsFriendsModalOpen(true)}
                className="w-8 h-8 bg-[#12100e] hover:bg-[#c8963c]/20 rounded-full flex items-center justify-center border border-[#c8963c]/30 text-[#c8963c] transition"
                title="Friends"
              >
                <span className="text-xs">👥</span>
              </button>
            </div>
          </div>

          {/* Achievements */}
          <div className="flex flex-wrap gap-1.5">
            {achievementsList.map((ach) => (
              <div
                key={ach.id}
                className={`px-2 py-1 rounded-md text-[9px] font-bold border uppercase tracking-wider ${
                  ach.isUnlocked
                    ? "bg-[#c8963c]/10 border-[#c8963c]/40 text-[#c8963c]"
                    : "bg-[#12100e] border-[#c8963c]/10 text-[#f0e6cc]/25 grayscale"
                }`}
              >
                {ach.isUnlocked ? ach.text : `🔒 ${ach.text.split(" ")[1]}`}
              </div>
            ))}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="text-center bg-[#12100e] px-3 py-3 rounded-xl border border-[#c8963c]/20">
              <div className="text-2xl font-black text-[#c8963c]">
                {favoritesCount}
              </div>
              <div className="text-[9px] text-[#f0e6cc]/50 uppercase tracking-widest font-bold mt-0.5">
                Favorites
              </div>
            </div>
            <div className="text-center bg-[#12100e] px-3 py-3 rounded-xl border border-[#c8963c]/20">
              <div className="text-2xl font-black text-[#c8963c]">
                {watchedCount}
              </div>
              <div className="text-[9px] text-[#f0e6cc]/50 uppercase tracking-widest font-bold mt-0.5">
                Watched
              </div>
            </div>
          </div>
        </div>

        {/* Completion Rate */}
        {hasStats && (
          <div className="w-full bg-[#12100e] border border-[#c8963c]/10 rounded-xl p-3">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[9px] font-black uppercase tracking-widest text-[#f0e6cc]/50">
                Completion Rate
              </span>
              <span className="text-[#c8963c] font-black text-xs">
                {profileData?.stats?.completionRate || 0}%
              </span>
            </div>
            <div className="w-full h-2 bg-[#1a1714] rounded-full overflow-hidden border border-[#c8963c]/10">
              <div
                className="h-full bg-gradient-to-r from-[#9a732a] to-[#c8963c] transition-all duration-1000 ease-out"
                style={{ width: `${profileData?.stats?.completionRate || 0}%` }}
              />
            </div>
            <p className="text-[8px] text-center text-[#f0e6cc]/40 mt-1.5 italic">
              {watchedCount} of {totalCount} watched
            </p>
          </div>
        )}

        {/* Movie Wrapped */}
        {hasStats && (
          <div className="p-4 bg-[#1a1714] rounded-2xl border border-[#c8963c]/20 shadow-xl">
            <h3 className="text-xs font-black text-[#f0e6cc] uppercase tracking-widest mb-4 border-b border-[#c8963c]/20 pb-2">
              Your Movie Wrapped
            </h3>

            {/* Stat cards — 2 columns on mobile */}
            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-[#12100e] border border-[#c8963c]/20 p-3 rounded-xl">
                <p className="text-[8px] text-[#f0e6cc]/50 uppercase font-bold mb-1">
                  ⏱ Time Spent
                </p>
                <p className="text-base font-black text-[#c8963c]">
                  {Math.floor((profileData?.stats?.totalMinutes || 0) / 60)}h{" "}
                  {(profileData?.stats?.totalMinutes || 0) % 60}m
                </p>
              </div>
              <div className="bg-[#12100e] border border-[#c8963c]/20 p-3 rounded-xl">
                <p className="text-[8px] text-[#f0e6cc]/50 uppercase font-bold mb-1">
                  🏆 Top Genre
                </p>
                <p
                  className="text-base font-black text-[#c8963c] truncate"
                  title={profileData?.stats?.topGenre || "N/A"}
                >
                  {profileData?.stats?.topGenre || "N/A"}
                </p>
              </div>
              <div className="bg-[#12100e] border border-[#c8963c]/20 p-3 rounded-xl">
                <p className="text-[8px] text-[#f0e6cc]/50 uppercase font-bold mb-1">
                  📼 Fav Decade
                </p>
                <p className="text-base font-black text-[#c8963c]">
                  {profileData?.stats?.favoriteDecade || "N/A"}
                </p>
              </div>
              <div className="bg-[#12100e] border border-[#c8963c]/20 p-3 rounded-xl">
                <p className="text-[8px] text-[#f0e6cc]/50 uppercase font-bold mb-1">
                  🎬 Format
                </p>
                <div className="flex gap-2 items-center pt-0.5">
                  <div className="text-center">
                    <span className="block text-sm font-black text-[#c8963c]">
                      {profileData?.stats?.moviesCount || 0}
                    </span>
                    <span className="text-[7px] text-[#f0e6cc]/50 uppercase">
                      Movies
                    </span>
                  </div>
                  <span className="text-[#c8963c]/30">|</span>
                  <div className="text-center">
                    <span className="block text-sm font-black text-[#c8963c]">
                      {profileData?.stats?.tvCount || 0}
                    </span>
                    <span className="text-[7px] text-[#f0e6cc]/50 uppercase">
                      TV
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Longest Marathon */}
            {profileData?.stats?.longestMovie &&
              profileData.stats.longestMovie.runtime > 0 && (
                <div className="bg-[#12100e] border border-[#c8963c]/20 p-3 rounded-xl mb-2 flex items-center gap-3">
                  <span className="text-2xl">🏃‍♂️</span>
                  <div className="min-w-0">
                    <p className="text-[8px] text-[#f0e6cc]/50 uppercase font-bold">
                      Longest Marathon
                    </p>
                    <p className="text-xs font-bold text-[#c8963c] truncate">
                      {profileData.stats.longestMovie.title}
                    </p>
                    <p className="text-[10px] text-[#f0e6cc]/70 font-black">
                      {profileData.stats.longestMovie.runtime} min
                    </p>
                  </div>
                </div>
              )}

            {/* Top Actor */}
            {profileData?.stats?.topActor && (
              <div className="bg-[#12100e] border border-[#c8963c]/20 p-3 rounded-xl mb-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-[#c8963c]/30">
                  {profileData.stats.topActor.profileUrl ? (
                    <img
                      src={profileData.stats.topActor.profileUrl}
                      alt="Actor"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#1a1714] flex items-center justify-center text-base">
                      🌟
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[8px] text-[#f0e6cc]/50 uppercase font-bold">
                    Most Watched Actor
                  </p>
                  <p className="text-xs font-bold text-[#c8963c] truncate">
                    {profileData.stats.topActor.name}
                  </p>
                  <p className="text-[9px] text-[#f0e6cc]/60 italic">
                    In {profileData.stats.topActor.count} movies
                  </p>
                </div>
              </div>
            )}

            {/* Charts — stacked on mobile */}
            <div className="grid grid-cols-1 gap-3">
              <div className="bg-[#12100e] border border-[#c8963c]/20 rounded-xl p-3 h-[180px]">
                <p className="text-[8px] text-[#f0e6cc]/50 uppercase font-bold mb-1 text-center">
                  Genre Breakdown
                </p>
                <div className="h-full w-full relative -mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={profileData?.stats?.genreDistribution || []}
                        innerRadius="55%"
                        outerRadius="80%"
                        paddingAngle={4}
                        dataKey="value"
                        stroke="none"
                      >
                        {(profileData?.stats?.genreDistribution || []).map(
                          (_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={CHART_COLORS[index % CHART_COLORS.length]}
                            />
                          ),
                        )}
                      </Pie>
                      <Tooltip
                        content={<CustomTooltip />}
                        cursor={{ fill: "transparent" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col mt-2">
                    <span className="text-[#c8963c] text-lg font-black">
                      {profileData?.stats?.genreDistribution?.length || 0}
                    </span>
                  </div>
                </div>
              </div>

              {profileData?.stats?.ratingDistribution && (
                <div className="bg-[#12100e] border border-[#c8963c]/20 rounded-xl p-3 h-[180px] flex flex-col">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-[8px] text-[#f0e6cc]/50 uppercase font-bold">
                      Rating Distribution
                    </p>
                    <p className="text-[10px] font-black text-[#c8963c]">
                      Avg: {profileData.stats.averageRating}
                    </p>
                  </div>
                  <div className="flex-grow w-full -ml-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={profileData.stats.ratingDistribution}
                        margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                      >
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{
                            fill: "#f0e6cc",
                            opacity: 0.5,
                            fontSize: 9,
                            fontWeight: "bold",
                          }}
                          dy={4}
                        />
                        <Tooltip
                          content={<RatingTooltip />}
                          cursor={{ fill: "#c8963c", opacity: 0.1 }}
                        />
                        <Bar
                          dataKey="value"
                          fill="#c8963c"
                          radius={[3, 3, 0, 0]}
                          maxBarSize={32}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>

            {/* Top 3 */}
            {profileData?.stats?.topRated &&
              profileData.stats.topRated.length > 0 && (
                <div className="mt-5 border-t border-[#c8963c]/10 pt-4">
                  <h4 className="text-[9px] text-[#c8963c] font-black uppercase tracking-[0.3em] mb-4 text-center">
                    Top 3 Masterpieces
                  </h4>
                  <div className="flex flex-col gap-2">
                    {profileData.stats.topRated.map((item, index) => (
                      <Link
                        to={`/movie/${item.tmdbId}?type=${item.mediaType}&fromTab=profile`}
                        key={item.id}
                        className="relative group bg-[#12100e] border border-[#c8963c]/10 rounded-xl p-2.5 flex items-center gap-3 hover:border-[#c8963c]/40 transition-all"
                      >
                        <div className="absolute -top-1.5 -left-1.5 w-5 h-5 bg-[#c8963c] text-[#12100e] rounded-full flex items-center justify-center font-black text-[9px] z-10">
                          #{index + 1}
                        </div>
                        <div className="w-9 h-12 shrink-0 rounded-lg overflow-hidden border border-[#c8963c]/10 bg-[#1a1714]">
                          {item.posterUrl ? (
                            <img
                              src={item.posterUrl}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[6px] text-[#f0e6cc]/20 font-black">
                              N/A
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <h5 className="text-[#f0e6cc] font-bold text-[11px] truncate group-hover:text-[#c8963c] transition-colors">
                            {item.title}
                          </h5>
                          <span className="text-[#c8963c] text-[10px] font-black">
                            ★ {item.rating}.0
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
          </div>
        )}

        {/* Top Favorites */}
        <div className="p-4 bg-[#1a1714] rounded-2xl border border-[#c8963c]/20 shadow-xl">
          <h3 className="text-xs font-black text-[#f0e6cc] uppercase tracking-widest mb-3">
            Top Favorites
          </h3>
          {!profileData?.favorites || profileData.favorites.length === 0 ? (
            <div className="text-center py-6 bg-[#12100e] rounded-xl border border-[#c8963c]/20 border-dashed text-[#f0e6cc]/50 text-xs italic">
              You haven't liked any movies yet.
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-2">
              {profileData.favorites.slice(0, 5).map((fav) => {
                const released = isReleased(fav);
                return (
                  <div
                    key={fav.id}
                    className="group relative flex flex-col items-center"
                  >
                    <div className="w-full aspect-[2/3] rounded-lg overflow-hidden shadow border border-[#c8963c]/20 bg-[#12100e] relative">
                      <Link
                        to={`/movie/${fav.tmdbId}?type=${fav.mediaType || "movie"}&fromTab=profile`}
                        className="block w-full h-full"
                      >
                        {fav.posterUrl ? (
                          <img
                            src={fav.posterUrl}
                            alt={fav.title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          />
                        ) : (
                          <div className="flex items-center justify-center w-full h-full text-[8px] text-[#f0e6cc]/30 italic">
                            N/A
                          </div>
                        )}
                      </Link>
                      {released ? (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleToggleFavorite(fav.tmdbId);
                          }}
                          className="absolute top-1 right-1 w-6 h-6 bg-[#12100e]/80 rounded-full flex items-center justify-center border border-[#c8963c]/30 transition z-10"
                        >
                          <svg
                            className={`w-2.5 h-2.5 ${fav.isFavorite ? "text-red-500 fill-red-500" : "text-[#f0e6cc]/30"}`}
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            fill={fav.isFavorite ? "currentColor" : "none"}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2.5"
                              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                            />
                          </svg>
                        </button>
                      ) : (
                        <div className="absolute top-1 right-1 w-6 h-6 bg-[#12100e]/90 rounded-full flex items-center justify-center border border-[#c8963c]/40 text-[#c8963c] text-[9px] z-10">
                          ⏳
                        </div>
                      )}
                    </div>
                    <Link
                      to={`/movie/${fav.tmdbId}?type=${fav.mediaType || "movie"}&fromTab=profile`}
                      className="mt-1 w-full text-center"
                    >
                      <h4 className="text-[8px] font-bold text-[#f0e6cc] truncate hover:text-[#c8963c] transition">
                        {fav.title}
                      </h4>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="p-4 bg-[#1a1714] rounded-2xl border border-[#c8963c]/20 shadow-xl">
          <h3 className="text-xs font-black text-[#f0e6cc] uppercase tracking-widest mb-3">
            Recent Activity
          </h3>
          {!profileData?.recent || profileData.recent.length === 0 ? (
            <div className="text-center py-6 bg-[#12100e] rounded-xl border border-[#c8963c]/20 border-dashed text-[#f0e6cc]/50 text-xs italic">
              No recent activity.
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {profileData.recent.map((act) => {
                const addedStr = new Date(act.addedAt).toLocaleDateString(
                  "en-US",
                  { month: "short", day: "numeric" },
                );
                return (
                  <Link
                    to={`/movie/${act.tmdbId}?type=${act.mediaType || "movie"}&fromTab=profile`}
                    key={act.id}
                    className="flex items-center gap-2.5 bg-[#12100e] p-2 rounded-xl border border-[#c8963c]/10 hover:border-[#c8963c]/40 hover:bg-[#1a1714] transition group"
                  >
                    <div className="w-8 h-11 rounded-md bg-[#1a1714] overflow-hidden shrink-0 border border-[#c8963c]/20">
                      {act.posterUrl ? (
                        <img
                          src={act.posterUrl}
                          alt={act.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[6px] text-[#f0e6cc]/30">
                          N/A
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <h4 className="font-bold text-[#f0e6cc] group-hover:text-[#c8963c] transition truncate text-xs">
                        {act.title}
                      </h4>
                      <span className="text-[8px] text-[#f0e6cc]/50 uppercase font-semibold mt-0.5">
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
    );
  };

  return (
    <div className="min-h-[100dvh] bg-[#12100e] font-sans text-[#f0e6cc] relative overscroll-none selection:bg-[#c8963c] selection:text-[#12100e]">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        {/* 1. ВЕРХНЯ НАВІГАЦІЯ (Static Header) */}
        <header className="sticky top-0 z-50 bg-[#12100e]/95 flex flex-col sm:flex-row items-center justify-between gap-3 py-6 mb-2 border-b border-[#c8963c]/10">
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
              className="text-[#f0e6cc]/60 hover:text-[#c8963c] transition-colors text-xs sm:text-sm px-1 tracking-wide uppercase font-semibold whitespace-nowrap flex-shrink-0"
            >
              Search
            </Link>
            <Link
              to="/watchlist"
              className="text-[#c8963c] font-bold border-b-2 border-[#c8963c] transition-all text-xs sm:text-sm px-1 tracking-wide uppercase whitespace-nowrap flex-shrink-0"
            >
              My Profile
            </Link>
            <button
              onClick={handleLogout}
              className="text-[9px] sm:text-xs px-3 py-1.5 border border-red-900/50 bg-red-900/10 text-red-500 rounded-lg hover:bg-red-600 hover:text-white transition uppercase font-bold whitespace-nowrap flex-shrink-0"
            >
              Logout
            </button>
          </nav>
        </header>

        {/* 2. ПАНЕЛЬ ВКЛАДОК (Винесена окремо, зліва) */}
        <div className="flex gap-2 sm:gap-3 mb-8 overflow-x-auto scrollbar-hide pt-4">
          <button
            onClick={() => setActiveTab("profile")}
            className={`px-6 py-2.5 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95 ${
              activeTab === "profile"
                ? "bg-[#c8963c] text-[#12100e]"
                : "bg-[#1a1714] text-[#f0e6cc]/40 border border-[#c8963c]/10 hover:border-[#c8963c]/30"
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab("watchlist")}
            className={`px-6 py-2.5 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95 ${
              activeTab === "watchlist"
                ? "bg-[#c8963c] text-[#12100e]"
                : "bg-[#1a1714] text-[#f0e6cc]/40 border border-[#c8963c]/10 hover:border-[#c8963c]/30"
            }`}
          >
            In Plans
          </button>
          <button
            onClick={() => setActiveTab("watched")}
            className={`px-6 py-2.5 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95 ${
              activeTab === "watched"
                ? "bg-[#c8963c] text-[#12100e]"
                : "bg-[#1a1714] text-[#f0e6cc]/40 border border-[#c8963c]/10 hover:border-[#c8963c]/30"
            }`}
          >
            Watched
          </button>
        </div>

        {/* 3. ОСНОВНИЙ КОНТЕНТ */}
        <main className="pb-12">
          {activeTab === "profile" ? (
            renderProfileTab()
          ) : isLoading ? (
            <p className="text-center text-[#f0e6cc]/50 animate-pulse text-sm mt-10 font-semibold uppercase tracking-widest">
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
              {movies.map((item) => {
                const released = isReleased(item);
                return (
                  <div
                    key={item.id}
                    className="group overflow-hidden transition bg-[#1a1714] border border-[#c8963c]/20 shadow-lg rounded-2xl flex flex-col hover:border-[#c8963c]/70 hover:shadow-[#c8963c]/10 hover:-translate-y-1 relative"
                  >
                    <div className="relative w-full aspect-[2/3] bg-[#12100e] overflow-hidden">
                      <Link
                        to={`/movie/${item.tmdbId}?type=${item.mediaType || "movie"}&fromTab=${activeTab}`}
                        className="block w-full h-full"
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
                      </Link>

                      {activeTab === "watched" && (
                        <div className="absolute top-2 left-2 bg-[#c8963c] text-[#12100e] text-[8px] font-black px-2 py-0.5 rounded-full shadow-md uppercase tracking-wider pointer-events-none">
                          Watched
                        </div>
                      )}
                      {activeTab === "watchlist" && !released && (
                        <div className="absolute top-2 left-2 bg-blue-500/90 text-white text-[8px] font-black px-2 py-0.5 rounded-full shadow-md uppercase tracking-wider pointer-events-none">
                          Upcoming
                        </div>
                      )}

                      {released ? (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleToggleFavorite(item.tmdbId);
                          }}
                          className="absolute top-2 right-2 w-8 h-8 bg-[#12100e]/80 rounded-full flex items-center justify-center border border-[#c8963c]/30 hover:bg-[#1a1714] transition backdrop-blur-sm shadow-lg z-10"
                        >
                          <svg
                            className={`w-3.5 h-3.5 ${
                              item.isFavorite
                                ? "text-red-500 fill-red-500"
                                : "text-[#f0e6cc]/30 hover:text-red-500"
                            }`}
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            fill={item.isFavorite ? "currentColor" : "none"}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2.5"
                              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                            />
                          </svg>
                        </button>
                      ) : (
                        <div
                          className="absolute top-2 right-2 w-8 h-8 bg-[#12100e]/90 rounded-full flex items-center justify-center border border-[#c8963c]/40 text-[#c8963c] text-xs shadow-lg z-10 cursor-default"
                          title="Not released yet"
                        >
                          ⏳
                        </div>
                      )}
                    </div>

                    <div className="p-3 sm:p-4 flex flex-col flex-grow z-10 bg-[#1a1714]">
                      <Link
                        to={`/movie/${item.tmdbId}?type=${item.mediaType || "movie"}`}
                        className="text-xs sm:text-base font-bold text-[#f0e6cc] truncate hover:text-[#c8963c] transition"
                        title={item.title}
                      >
                        {item.title}
                      </Link>

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
                          released ? (
                            <button
                              onClick={() => handleMarkWatched(item.tmdbId)}
                              className="text-[10px] font-bold text-[#c8963c] hover:text-[#e8c070] transition uppercase tracking-widest min-h-[32px] flex items-center"
                            >
                              Watched
                            </button>
                          ) : (
                            <span className="text-[10px] font-black text-[#c8963c]/40 uppercase tracking-widest min-h-[32px] flex items-center gap-1 cursor-default">
                              Upcoming
                            </span>
                          )
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
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* 4. МОДАЛЬНІ ВІКНА ТА ТОСТИ */}
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
              ✕
            </button>
            <div className="text-center">
              <h3 className="text-xl sm:text-2xl font-black text-[#c8963c] mb-2 uppercase tracking-wide">
                How was it?
              </h3>
              <p className="text-sm text-[#f0e6cc]/60 mb-6">
                Rate "{ratingModalData.title}" or skip.
              </p>
              <div
                className="flex justify-center gap-2 mb-6"
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
                onClick={handleModalSkip}
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

      {isFriendsModalOpen && (
        <FriendsModal onClose={() => setIsFriendsModalOpen(false)} />
      )}

      {toastMessage && (
        <div className="fixed bottom-5 left-4 right-4 sm:left-auto sm:right-10 sm:bottom-10 bg-[#1a1714] border border-[#c8963c]/50 text-[#c8963c] px-6 py-4 rounded-xl shadow-2xl flex items-center justify-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300 z-50 uppercase tracking-widest font-bold">
          <span className="text-xs sm:text-sm text-center">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

interface Friend {
  id: number;
  username: string;
  avatarUrl: string | null;
}

interface FriendsModalProps {
  onClose: () => void;
}

function FriendsModal({ onClose }: FriendsModalProps) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFriends = async () => {
      try {
        const response = await api.get("/users/friends");
        setFriends(response.data);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchFriends();
  }, []);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md p-5 bg-[#1a1714] border border-[#c8963c]/30 rounded-t-3xl sm:rounded-3xl shadow-2xl relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-[#c8963c]/30 rounded-full mx-auto mb-4 sm:hidden" />
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#f0e6cc]/50 hover:text-[#c8963c] transition p-1"
        >
          <svg
            className="w-5 h-5"
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
        <h2 className="text-lg font-black text-[#f0e6cc] uppercase tracking-widest text-center mb-4">
          Friends List
        </h2>

        {isLoading ? (
          <div className="text-center text-[#c8963c] animate-pulse font-bold uppercase tracking-widest py-6 text-sm">
            Loading...
          </div>
        ) : friends.length === 0 ? (
          <div className="text-center text-[#f0e6cc]/50 text-sm py-6 italic border border-[#c8963c]/20 rounded-xl border-dashed">
            You haven't added any friends yet.
          </div>
        ) : (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {friends.map((friend) => (
              <Link
                key={friend.id}
                to={`/user/${friend.id}`}
                onClick={onClose}
                className="flex items-center gap-3 bg-[#12100e] p-2.5 rounded-xl border border-[#c8963c]/20 hover:border-[#c8963c]/60 transition"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#c8963c] to-[#9a732a] flex items-center justify-center text-base font-black text-[#12100e] overflow-hidden shrink-0">
                  {friend.avatarUrl ? (
                    <img
                      src={friend.avatarUrl}
                      className="w-full h-full object-cover"
                      alt={friend.username}
                    />
                  ) : (
                    friend.username[0].toUpperCase()
                  )}
                </div>
                <span className="font-black text-[#f0e6cc] text-sm truncate">
                  {friend.username}
                </span>
                <span className="ml-auto text-[#c8963c] opacity-50">→</span>
              </Link>
            ))}
          </div>
        )}
      </div>
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
    if (trimmedUsername !== currentUsername)
      formData.append("username", trimmedUsername);
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
        setError("That username is already taken!");
      } else {
        setError("An error occurred. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full sm:max-w-md p-5 bg-[#1a1714] border border-[#c8963c]/30 rounded-t-3xl sm:rounded-3xl shadow-2xl relative">
        <div className="w-10 h-1 bg-[#c8963c]/30 rounded-full mx-auto mb-4 sm:hidden" />
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#f0e6cc]/50 hover:text-[#c8963c] transition p-1"
        >
          <svg
            className="w-5 h-5"
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
        <h2 className="text-lg font-black text-[#f0e6cc] uppercase tracking-widest text-center mb-4">
          Edit Profile
        </h2>

        {error && (
          <div className="mb-4 p-2.5 text-xs text-red-500 bg-red-900/10 border border-red-500/30 rounded-xl text-center font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
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
                  alt="Preview"
                  className="w-20 h-20 rounded-full object-cover border-4 border-[#12100e] group-hover:border-[#c8963c] transition shadow-lg"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#c8963c] to-[#9a732a] flex items-center justify-center text-2xl font-black text-[#12100e] border-4 border-[#12100e] group-hover:border-[#c8963c] transition shadow-lg">
                  {username.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="absolute inset-0 bg-[#12100e]/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                <svg
                  className="w-6 h-6 text-[#c8963c]"
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
            <p className="text-[9px] text-[#f0e6cc]/50 mt-2 font-semibold uppercase tracking-wider">
              Tap to change (max 5MB)
            </p>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-[#c8963c] uppercase tracking-wider ml-1 mb-1.5">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 text-[#f0e6cc] bg-[#12100e] border border-[#c8963c]/30 rounded-xl focus:outline-none focus:border-[#c8963c] transition text-sm"
              minLength={3}
              maxLength={20}
              required
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !username.trim()}
            className="w-full py-3.5 font-black text-[#12100e] uppercase tracking-widest transition bg-[#c8963c] rounded-xl hover:bg-[#e8c070] active:scale-[0.98] disabled:bg-[#2a241f] disabled:text-[#c8963c]/30 shadow text-sm"
          >
            {isLoading ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
}

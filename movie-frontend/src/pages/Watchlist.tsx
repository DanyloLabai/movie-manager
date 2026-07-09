import { useState, useEffect, useCallback } from "react";
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
import LogoImg from "../assets/logo.png";
import * as moviesApi from "../api/movies.api";
import * as usersApi from "../api/users.api";
import { useLang } from "../context/LanguageContext";
import type { TranslationKey } from "../context/LanguageContext";
import AchievementTooltip from "../components/AchievementTooltip";
import NotificationBell from "../components/NotificationBell";
import SettingsMenu from "../components/SettingsMenu";
import type {
  WatchlistItem as WatchlistItemType,
  ProfileData as ProfileDataType,
} from "../types/movie.types";

const CHART_COLORS = ["#c8963c", "#9a732a", "#e8c070", "#5c4519", "#3a2b0f"];

const isReleased = (item: WatchlistItemType): boolean => {
  if (item.releaseDate) {
    const today = new Date();
    const release = new Date(item.releaseDate);
    today.setHours(0, 0, 0, 0);
    release.setHours(0, 0, 0, 0);
    return release <= today;
  }
  return true;
};

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload?: Record<string, unknown>;
  }>;
}

const CustomTooltip = ({ active, payload }: ChartTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a1714] border border-[#c8963c]/50 p-2 rounded-xl shadow-xl">
        <p className="text-[#f0e6cc] font-bold text-[10px] uppercase tracking-widest whitespace-nowrap">
          {payload[0].name}:{" "}
          <span className="text-[#c8963c]">{payload[0].value}</span>
        </p>
      </div>
    );
  }
  return null;
};

interface RatingTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: { name: string }; value: number }>;
  t: (key: TranslationKey) => string;
}

const RatingTooltip = ({ active, payload, t }: RatingTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a1714] border border-[#c8963c]/50 px-2 py-1.5 rounded-xl shadow-xl flex items-center gap-1.5">
        <span className="text-[#c8963c] font-black text-xs">
          ★ {payload[0].payload.name}
        </span>
        <span className="text-[#f0e6cc]/50 text-xs">|</span>
        <span className="text-[#f0e6cc] font-bold text-[10px]">
          {payload[0].value} {t("stats_movies").toLowerCase()}
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
  const { t, lang } = useLang();
  const dateLocale = lang === "uk" ? "uk-UA" : "en-US";
  const [movies, setMovies] = useState<WatchlistItemType[]>([]);

  const [profileData, setProfileData] = useState<ProfileDataType | null>(null);
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

  const [username, setUsername] = useState<string>("");

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [isFriendsModalOpen, setIsFriendsModalOpen] = useState(false);
  const [hoveredMovieId, setHoveredMovieId] = useState<number | null>(null);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [modalHoveredStar, setModalHoveredStar] = useState(0);
  const [ratingModalData, setRatingModalData] = useState<{
    isOpen: boolean;
    tmdbId: number | null;
    title: string;
  }>({ isOpen: false, tmdbId: null, title: "" });

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchMovies = useCallback(async () => {
    setIsLoading(true);
    try {
      const endpointName = activeTab === "watchlist" ? "watchlist" : "watched";
      const response = await moviesApi.getWatchlist(endpointName);
      setMovies(response || []);
    } catch (error: unknown) {
      const apiError = error as { response?: { status?: number } };
      if (apiError.response?.status === 401) {
        localStorage.removeItem("token");
        navigate("/login");
      }
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, navigate]);

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await moviesApi.getProfile();
      setProfileData(data);

      if (data.username) {
        setUsername(data.username);
      }
      if (data.avatarUrl !== undefined) {
        setAvatarUrl(data.avatarUrl ?? null);
      }
    } catch (error: unknown) {
      const apiError = error as { response?: { status?: number } };
      if (apiError.response?.status === 401) {
        localStorage.removeItem("token");
        navigate("/login");
      }
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (activeTab === "watchlist" || activeTab === "watched") {
      fetchMovies();
    } else if (activeTab === "profile") {
      fetchProfile();
    }
  }, [activeTab, fetchMovies, fetchProfile]);

  const handleToggleFavorite = async (tmdbId: number) => {
    const itemToCheck =
      movies.find((m) => m.tmdbId === tmdbId) ||
      profileData?.favorites.find((f) => f.tmdbId === tmdbId) ||
      profileData?.recent.find((r) => r.tmdbId === tmdbId);
    if (itemToCheck && !isReleased(itemToCheck)) {
      showToast(t("search_fav_unreleased"));
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
      await moviesApi.toggleFavorite(tmdbId);
      showToast(t("search_fav_updated"));
      if (activeTab === "profile") fetchProfile();
    } catch {
      showToast(t("search_fav_error2"));
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
      await moviesApi.removeFromWatchlist(tmdbId);
      showToast(t("movie_removed"));
    } catch {
      showToast(t("search_remove_error"));
    }
  };

  const handleMarkWatched = (tmdbId: number) => {
    const targetMovie = movies.find((m) => m.tmdbId === tmdbId);
    if (!targetMovie) return;
    setModalHoveredStar(0);
    setRatingModalData({
      isOpen: true,
      tmdbId: targetMovie.tmdbId,
      title: targetMovie.title,
    });
  };

  const confirmMarkWatched = async (tmdbId: number, rating: number | null) => {
    setMovies((prev) => prev.filter((item) => item.tmdbId !== tmdbId));
    try {
      await moviesApi.markWatched(tmdbId);
      if (rating !== null) await moviesApi.rateMovie(tmdbId, rating);
      showToast(t("watchlist_moved"));
      fetchProfile();
    } catch {
      showToast(t("watchlist_status_error"));
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
      await moviesApi.rateMovie(tmdbId, newRating);
      showToast(
        newRating === 0
          ? t("watchlist_rating_cleared")
          : t("watchlist_rating_updated"),
      );
    } catch {
      showToast(t("watchlist_rating_error"));
    }
  };

  const closeRatingModal = () => {
    setRatingModalData({ isOpen: false, tmdbId: null, title: "" });
    setModalHoveredStar(0);
  };

  const handleModalRate = async (star: number) => {
    if (ratingModalData.tmdbId)
      await confirmMarkWatched(ratingModalData.tmdbId, star);
    closeRatingModal();
  };

  const handleModalSkip = async () => {
    if (ratingModalData.tmdbId)
      await confirmMarkWatched(ratingModalData.tmdbId, null);
    closeRatingModal();
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
      {
        id: "first_blood",
        isUnlocked: totalCount > 0,
        text: "First Blood",
        requirement: "Add 1 movie to watchlist or mark as watched",
        current: totalCount,
        needed: 1,
      },
      {
        id: "critic",
        isUnlocked: favoritesCount >= 5,
        text: "Critic",
        requirement: "Add 5 movies to favorites",
        current: favoritesCount,
        needed: 5,
      },
      {
        id: "cinephile",
        isUnlocked: watchedCount >= 10,
        text: "Cinephile",
        requirement: "Mark 10 movies as watched",
        current: watchedCount,
        needed: 10,
      },
      {
        id: "collector",
        isUnlocked: totalCount >= 20,
        text: "Collector",
        requirement: "Collect 20 movies total (watched + watchlist)",
        current: totalCount,
        needed: 20,
      },
      {
        id: "tastemaker",
        isUnlocked: favoritesCount >= 20,
        text: "Tastemaker",
        requirement: "Add 20 movies to favorites",
        current: favoritesCount,
        needed: 20,
      },
      {
        id: "filmbuff",
        isUnlocked: watchedCount >= 50,
        text: "Film Buff",
        requirement: "Mark 50 movies as watched",
        current: watchedCount,
        needed: 50,
      },
      {
        id: "librarian",
        isUnlocked: totalCount >= 100,
        text: "Librarian",
        requirement: "Collect 100 movies total (watched + watchlist)",
        current: totalCount,
        needed: 100,
      },
    ];

    return (
      <div className="space-y-4 animate-fade-in">
        {/* Profile Header */}
        <div className="flex flex-col p-4 bg-[#1a1714] rounded-2xl border border-[#c8963c]/20 shadow-xl gap-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#c8963c] to-[#9a732a]" />

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-tr from-[#c8963c] to-[#9a732a] rounded-full flex items-center justify-center text-2xl font-black shadow-lg uppercase text-[#12100e] shrink-0 overflow-hidden border-2 border-[#c8963c]/50">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
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
                onClick={() => setIsFriendsModalOpen(true)}
                className="w-8 h-8 bg-[#12100e] hover:bg-[#c8963c]/20 rounded-full flex items-center justify-center border border-[#c8963c]/30 text-[#c8963c] transition"
                title={t("profile_friends")}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-5.13a4 4 0 11-8 0 4 4 0 018 0zm6 3a4 4 0 10-4-4"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Achievements */}
          <div className="flex flex-wrap gap-1.5">
            {achievementsList.map((ach) => (
              <AchievementTooltip key={ach.id} achievement={ach} />
            ))}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 gap-2">
            <div className="text-center bg-[#12100e] px-3 py-3 rounded-xl border border-[#c8963c]/20">
              <div className="text-2xl font-black text-[#c8963c]">
                {favoritesCount}
              </div>
              <div className="text-[9px] text-[#f0e6cc]/50 uppercase tracking-widest font-bold mt-0.5">
                {t("watchlist_favorites")}
              </div>
            </div>
            <div className="text-center bg-[#12100e] px-3 py-3 rounded-xl border border-[#c8963c]/20">
              <div className="text-2xl font-black text-[#c8963c]">
                {watchedCount}
              </div>
              <div className="text-[9px] text-[#f0e6cc]/50 uppercase tracking-widest font-bold mt-0.5">
                {t("watchlist_watched")}
              </div>
            </div>
          </div>
        </div>

        {/* Completion Rate */}
        {hasStats && (
          <div className="w-full bg-[#12100e] border border-[#c8963c]/10 rounded-xl p-3">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[9px] font-black uppercase tracking-widest text-[#f0e6cc]/50">
                {t("profile_completion")}
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
              {watchedCount} / {totalCount}{" "}
              {t("watchlist_watched").toLowerCase()}
            </p>
          </div>
        )}

        {/* Movie Wrapped */}
        {hasStats && (
          <div className="p-4 bg-[#1a1714] rounded-2xl border border-[#c8963c]/20 shadow-xl">
            <h3 className="text-xs font-black text-[#f0e6cc] uppercase tracking-widest mb-4 border-b border-[#c8963c]/20 pb-2">
              {t("stats_wrapped").replace("[username]", username)}
            </h3>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-[#12100e] border border-[#c8963c]/20 p-3 rounded-xl">
                <p className="text-[8px] text-[#f0e6cc]/50 uppercase font-bold mb-1">
                  {t("stats_time_spent")}
                </p>
                <p className="text-base font-black text-[#c8963c]">
                  {Math.floor((profileData?.stats?.totalMinutes || 0) / 60)}h{" "}
                  {(profileData?.stats?.totalMinutes || 0) % 60}m
                </p>
              </div>
              <div className="bg-[#12100e] border border-[#c8963c]/20 p-3 rounded-xl">
                <p className="text-[8px] text-[#f0e6cc]/50 uppercase font-bold mb-1">
                  {t("stats_top_genre")}
                </p>
                <p
                  className="text-base font-black text-[#c8963c] truncate"
                  title={profileData?.stats?.topGenre || t("common_na")}
                >
                  {profileData?.stats?.topGenre || t("common_na")}
                </p>
              </div>
              <div className="bg-[#12100e] border border-[#c8963c]/20 p-3 rounded-xl">
                <p className="text-[8px] text-[#f0e6cc]/50 uppercase font-bold mb-1">
                  {t("stats_fav_decade")}
                </p>
                <p className="text-base font-black text-[#c8963c]">
                  {profileData?.stats?.favoriteDecade || t("common_na")}
                </p>
              </div>
              <div className="bg-[#12100e] border border-[#c8963c]/20 p-3 rounded-xl">
                <p className="text-[8px] text-[#f0e6cc]/50 uppercase font-bold mb-1">
                  {t("stats_format")}
                </p>
                <div className="flex gap-2 items-center pt-0.5">
                  <div className="text-center">
                    <span className="block text-sm font-black text-[#c8963c]">
                      {profileData?.stats?.moviesCount || 0}
                    </span>
                    <span className="text-[7px] text-[#f0e6cc]/50 uppercase">
                      {t("stats_movies")}
                    </span>
                  </div>
                  <span className="text-[#c8963c]/30">|</span>
                  <div className="text-center">
                    <span className="block text-sm font-black text-[#c8963c]">
                      {profileData?.stats?.tvCount || 0}
                    </span>
                    <span className="text-[7px] text-[#f0e6cc]/50 uppercase">
                      {t("stats_tv")}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Longest Marathon */}
            {(profileData?.stats?.longestMovie?.runtime ?? 0) > 0 && (
              <div className="bg-[#12100e] border border-[#c8963c]/20 p-3 rounded-xl mb-2 flex items-center gap-3">
                <svg
                  className="w-6 h-6 text-[#c8963c] shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div className="min-w-0">
                  <p className="text-[8px] text-[#f0e6cc]/50 uppercase font-bold">
                    {t("stats_marathon")}
                  </p>
                  <p className="text-xs font-bold text-[#c8963c] truncate">
                    {profileData?.stats?.longestMovie?.title}
                  </p>
                  <p className="text-[10px] text-[#f0e6cc]/70 font-black">
                    {profileData?.stats?.longestMovie?.runtime} {t("stats_min")}
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
                    <div className="w-full h-full bg-[#1a1714] flex items-center justify-center text-[#c8963c]/60">
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-[8px] text-[#f0e6cc]/50 uppercase font-bold">
                    {t("stats_actor")}
                  </p>
                  <p className="text-xs font-bold text-[#c8963c] truncate">
                    {profileData.stats.topActor.name}
                  </p>
                  <p className="text-[9px] text-[#f0e6cc]/60 italic">
                    {t("stats_actor_count").replace(
                      "[X]",
                      profileData.stats.topActor.count.toString(),
                    )}
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3">
              <div className="bg-[#12100e] border border-[#c8963c]/20 rounded-xl p-3 h-[180px]">
                <p className="text-[8px] text-[#f0e6cc]/50 uppercase font-bold mb-1 text-center">
                  {t("stats_genres")}
                </p>
                <div className="h-full w-full relative -mt-2">
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col mt-2 z-0">
                    <span className="text-[#c8963c] text-lg font-black">
                      {profileData?.stats?.genreDistribution?.length || 0}
                    </span>
                  </div>

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
                          (
                            _: { name: string; value: number },
                            index: number,
                          ) => (
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
                        wrapperStyle={{ zIndex: 9999 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {profileData?.stats?.ratingDistribution && (
                <div className="bg-[#12100e] border border-[#c8963c]/20 rounded-xl p-3 h-[180px] flex flex-col">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-[8px] text-[#f0e6cc]/50 uppercase font-bold">
                      {t("stats_rating")}
                    </p>
                    <p className="text-[10px] font-black text-[#c8963c]">
                      {t("stats_avg")} {profileData.stats.averageRating}
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
                          content={<RatingTooltip t={t} />}
                          cursor={{ fill: "#c8963c", opacity: 0.1 }}
                          wrapperStyle={{ zIndex: 9999 }}
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
                    {t("stats_top3")}
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
                              {t("common_na")}
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
        <div className="p-4 bg-[#1a1714] rounded-2xl border border-[#c8963c]/20 shadow-xl mt-4">
          <h3 className="text-xs font-black text-[#f0e6cc] uppercase tracking-widest mb-3">
            {t("watchlist_top_fav")}
          </h3>
          {!profileData?.favorites || profileData.favorites.length === 0 ? (
            <div className="text-center py-6 bg-[#12100e] rounded-xl border border-[#c8963c]/20 border-dashed text-[#f0e6cc]/50 text-xs italic">
              {t("watchlist_no_fav")}
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
                            {t("common_na")}
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
                        <div className="absolute top-1 right-1 w-6 h-6 bg-[#12100e]/90 rounded-full flex items-center justify-center border border-[#c8963c]/40 text-[#c8963c] z-10">
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
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
        <div className="p-4 bg-[#1a1714] rounded-2xl border border-[#c8963c]/20 shadow-xl mt-4">
          <h3 className="text-xs font-black text-[#f0e6cc] uppercase tracking-widest mb-3">
            {t("recent_actions")}
          </h3>
          {!profileData?.recent || profileData.recent.length === 0 ? (
            <div className="text-center py-6 bg-[#12100e] rounded-xl border border-[#c8963c]/20 border-dashed text-[#f0e6cc]/50 text-xs italic">
              {t("no_recent_actions")}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {profileData.recent.map((act) => {
                const addedStr = act.addedAt
                  ? new Date(act.addedAt).toLocaleDateString(dateLocale, {
                      month: "short",
                      day: "numeric",
                    })
                  : "";
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
                          {t("common_na")}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                      <h4 className="font-bold text-[#f0e6cc] group-hover:text-[#c8963c] transition truncate text-xs">
                        {act.title}
                      </h4>
                      <span className="text-[8px] text-[#f0e6cc]/50 uppercase font-semibold mt-0.5">
                        {t("added")} {addedStr}
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
      <div className="sticky top-0 z-40 bg-[#12100e]/95 backdrop-blur-md border-b border-[#c8963c]/10 mb-6 pt-[env(safe-area-inset-top)]">
        <header className="flex flex-col sm:flex-row items-center justify-between gap-3 py-4 sm:py-5 px-4 sm:px-8 w-full">
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
                Movie Tracker
              </span>
            </div>
          </Link>
          <nav className="hidden sm:flex items-center gap-2 sm:gap-8 overflow-x-auto w-full sm:w-auto pb-1 scrollbar-hide justify-center">
            <Link
              to="/ai-chat"
              className="text-[#f0e6cc]/60 hover:text-[#c8963c] transition-colors text-xs sm:text-sm px-1 tracking-wide uppercase font-semibold whitespace-nowrap flex-shrink-0"
            >
              {t("nav_ai_chat")}
            </Link>
            <Link
              to="/search"
              className="text-[#f0e6cc]/60 hover:text-[#c8963c] transition-colors text-xs sm:text-sm px-1 tracking-wide uppercase font-semibold whitespace-nowrap flex-shrink-0"
            >
              {t("nav_search")}
            </Link>
            <Link
              to="/watchlist"
              className="text-[#c8963c] font-bold border-b-2 border-[#c8963c] transition-all text-xs sm:text-sm px-1 tracking-wide uppercase whitespace-nowrap flex-shrink-0"
            >
              {t("nav_profile")}
            </Link>

            <NotificationBell />
            <SettingsMenu />
          </nav>
        </header>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 pb-24 sm:pb-12">
        <div className="flex gap-2 sm:gap-3 mb-8 overflow-x-auto scrollbar-hide">
          {(["profile", "watchlist", "watched"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 rounded-2xl font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95 max-w-[150px] ${
                activeTab === tab
                  ? "bg-[#c8963c] text-[#12100e]"
                  : "bg-[#1a1714] text-[#f0e6cc]/40 border border-[#c8963c]/10 hover:border-[#c8963c]/30"
              }`}
            >
              {tab === "watchlist"
                ? t("watchlist_planned")
                : tab === "profile"
                  ? t("nav_profile")
                  : t("watchlist_watched")}
            </button>
          ))}
        </div>

        <main>
          {activeTab === "profile" ? (
            renderProfileTab()
          ) : isLoading ? (
            <p className="text-center text-[#f0e6cc]/50 animate-pulse text-sm mt-10 font-semibold uppercase tracking-widest">
              Loading your list...
            </p>
          ) : movies.length === 0 ? (
            <div className="text-center p-8 bg-[#1a1714] rounded-2xl border border-[#c8963c]/20 shadow-2xl mt-8 max-w-sm mx-auto">
              <p className="text-[#f0e6cc]/60 text-base font-medium mb-5">
                {t("watchlist_empty")}
              </p>
              <Link
                to="/search"
                className="inline-block px-6 py-3 bg-[#c8963c] text-[#12100e] font-black uppercase tracking-wider rounded-xl hover:bg-[#e8c070] transition shadow-lg text-sm"
              >
                Discover Movies
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
              {movies.map((item) => {
                const released = isReleased(item);
                return (
                  <div
                    key={item.id}
                    className="group overflow-hidden bg-[#1a1714] border border-[#c8963c]/20 shadow rounded-xl flex flex-col hover:border-[#c8963c]/70 hover:-translate-y-0.5 transition relative"
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
                          <div className="flex items-center justify-center w-full h-full text-[#f0e6cc]/30 text-[9px] italic">
                            {t("common_na")}
                          </div>
                        )}
                      </Link>

                      {activeTab === "watched" && (
                        <div className="absolute top-1.5 left-1.5 bg-[#c8963c] text-[#12100e] text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                          {t("watched")}
                        </div>
                      )}
                      {activeTab === "watchlist" && !released && (
                        <div className="absolute top-1.5 left-1.5 bg-blue-500/90 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase">
                          {t("umcoming")}
                        </div>
                      )}

                      {released ? (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleToggleFavorite(item.tmdbId);
                          }}
                          className="absolute top-1.5 right-1.5 w-7 h-7 bg-[#12100e]/80 rounded-full flex items-center justify-center border border-[#c8963c]/30 transition backdrop-blur-sm z-10"
                        >
                          <svg
                            className={`w-3 h-3 ${item.isFavorite ? "text-red-500 fill-red-500" : "text-[#f0e6cc]/30"}`}
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
                        <div className="absolute top-1.5 right-1.5 w-7 h-7 bg-[#12100e]/90 rounded-full flex items-center justify-center border border-[#c8963c]/40 text-[#c8963c] z-10">
                          <svg
                            className="w-3.5 h-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        </div>
                      )}
                    </div>

                    <div className="p-2.5 flex flex-col flex-grow bg-[#1a1714]">
                      <Link
                        to={`/movie/${item.tmdbId}?type=${item.mediaType || "movie"}`}
                        className="text-[11px] font-bold text-[#f0e6cc] truncate hover:text-[#c8963c] transition"
                        title={item.title}
                      >
                        {item.title}
                      </Link>

                      {released || activeTab === "watched" ? (
                        <div
                          className="flex justify-center gap-0 mb-1.5 mt-auto pt-2"
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
                                onClick={() =>
                                  handleRateMovie(item.tmdbId, star)
                                }
                                className={`text-lg p-0.5 transition-all active:scale-150 ${
                                  isActive
                                    ? "text-[#c8963c]"
                                    : "text-[#f0e6cc]/20"
                                }`}
                              >
                                ★
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex justify-center mb-1.5 mt-auto pt-2">
                          <span className="text-[8px] font-black text-[#f0e6cc]/20 uppercase tracking-wider py-1.5">
                            {t("common_unreleased")}
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between items-center gap-1 pt-2 border-t border-[#c8963c]/20">
                        {activeTab === "watchlist" ? (
                          released ? (
                            <button
                              onClick={() => handleMarkWatched(item.tmdbId)}
                              className="text-[9px] font-bold text-[#c8963c] hover:text-[#e8c070] transition uppercase tracking-wide"
                            >
                              {t("watchlist_mark_watched").replace(
                                "Mark as ",
                                "",
                              )}
                            </button>
                          ) : (
                            <span className="text-[9px] font-black text-[#c8963c]/40 uppercase tracking-wide">
                              {t("umcoming")}
                            </span>
                          )
                        ) : (
                          <Link
                            to={`/movie/${item.tmdbId}?type=${item.mediaType || "movie"}`}
                            className="text-[9px] font-bold text-[#c8963c] uppercase tracking-wide hover:text-[#e8c070] transition"
                          >
                            {t("details")}
                          </Link>
                        )}
                        <button
                          onClick={() => handleDelete(item.tmdbId)}
                          className="text-[9px] font-bold text-red-500/60 hover:text-red-500 transition uppercase"
                        >
                          {t("deleted")}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {ratingModalData.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div
            className="bg-[#1a1714] border border-[#c8963c]/30 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative animate-modal-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#c8963c] to-[#9a732a]" />
            <button
              onClick={closeRatingModal}
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
            <div className="text-center">
              <h3 className="text-lg font-black text-[#c8963c] mb-1 uppercase tracking-wide">
                {t("movie_how_was_it")}
              </h3>
              <p className="text-sm text-[#f0e6cc]/60 mb-6">
                {t("movie_rate_desc")} "{ratingModalData.title}"{" "}
                {t("movie_or_skip")}.
              </p>
              <div
                className="flex justify-center gap-1 mb-6"
                onMouseLeave={() => setModalHoveredStar(0)}
              >
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onMouseEnter={() => setModalHoveredStar(star)}
                    onClick={() => handleModalRate(star)}
                    className={`text-4xl transition-all duration-150 transform active:scale-125 p-1 ${modalHoveredStar >= star ? "text-[#c8963c]" : "text-[#f0e6cc]/20"}`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <button
                onClick={handleModalSkip}
                className="text-xs font-bold text-[#f0e6cc]/50 hover:text-[#c8963c] uppercase tracking-widest transition py-2 px-4"
              >
                {t("movie_skip_rating")}
              </button>
            </div>
          </div>
        </div>
      )}

      {isFriendsModalOpen && (
        <FriendsModal onClose={() => setIsFriendsModalOpen(false)} />
      )}

      {toastMessage && (
        <div className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-6 sm:bottom-6 bg-[#1a1714] border border-[#c8963c]/50 text-[#c8963c] px-4 py-3 rounded-xl shadow-2xl flex items-center justify-center gap-2 z-50 uppercase tracking-widest font-bold animate-fade-in">
          <span className="text-[10px] text-center">{toastMessage}</span>
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

interface SearchUser {
  id: number;
  username: string;
  avatarUrl: string | null;
  isFriend: boolean;
  requestPending?: boolean;
}

interface FeedItem {
  id: number;
  type: "watched" | "rated" | "added_watchlist" | "favorited";
  tmdbId: number;
  title: string;
  posterUrl: string | null;
  mediaType: string;
  rating: number | null;
  createdAt: string;
  user: { id: number; username: string; avatarUrl: string | null };
}

function formatTimeAgo(
  iso: string,
  t: (key: TranslationKey) => string,
): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return t("time_just_now");
  if (minutes < 60) return `${minutes}${t("time_minutes_short")}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}${t("time_hours_short")}`;
  const days = Math.floor(hours / 24);
  return `${days}${t("time_days_short")}`;
}

function FriendsModal({ onClose }: FriendsModalProps) {
  const { t } = useLang();
  const [mode, setMode] = useState<"list" | "search" | "feed">("list");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);

  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedLoaded, setFeedLoaded] = useState(false);

  const fetchFriends = async () => {
    try {
      const data = await usersApi.getFriends();
      setFriends(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFriends();
  }, []);

  useEffect(() => {
    if (mode !== "feed" || feedLoaded) return;
    setFeedLoading(true);
    usersApi
      .getFriendsFeed()
      .then((data) => setFeedItems(data || []))
      .catch((error) => console.error(error))
      .finally(() => {
        setFeedLoading(false);
        setFeedLoaded(true);
      });
  }, [mode, feedLoaded]);

  useEffect(() => {
    if (mode !== "search") return;
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const data = await usersApi.searchUsers(trimmed);
        setSearchResults(data || []);
      } catch (error) {
        console.error(error);
      } finally {
        setSearchLoading(false);
      }
    }, 350);
    return () => clearTimeout(timeout);
  }, [searchQuery, mode]);

  const handleRemoveFriend = async (friendId: number) => {
    setRemovingId(friendId);
    try {
      await usersApi.removeFriend(friendId);
      setFriends((prev) => prev.filter((f) => f.id !== friendId));
    } catch (error) {
      console.error(error);
    } finally {
      setRemovingId(null);
    }
  };

  const handleAddFriend = async (userId: number) => {
    setAddingId(userId);
    try {
      const result = await usersApi.addFriend(userId);
      const accepted = result?.status === "accepted";
      setSearchResults((prev) =>
        prev.map((u) =>
          u.id === userId
            ? {
                ...u,
                isFriend: accepted ? true : u.isFriend,
                requestPending: !accepted,
              }
            : u,
        ),
      );
      if (accepted) fetchFriends();
    } catch (error) {
      console.error(error);
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md p-5 bg-[#1a1714] border border-[#c8963c]/30 rounded-3xl shadow-2xl relative animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
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

        <div className="flex items-center justify-center gap-2 mb-4">
          <h2 className="text-lg font-black text-[#f0e6cc] uppercase tracking-widest text-center">
            {mode === "list"
              ? t("profile_friends_list")
              : mode === "feed"
                ? t("profile_feed")
                : t("profile_search_friends")}
          </h2>
        </div>

        <div className="flex bg-[#12100e] rounded-full p-1 border border-[#c8963c]/20 mb-4">
          <button
            onClick={() => setMode("list")}
            className={`flex-1 py-2 rounded-full font-black text-[10px] uppercase tracking-widest transition ${
              mode === "list"
                ? "bg-[#c8963c] text-[#12100e] shadow"
                : "text-[#f0e6cc]/40 hover:text-[#c8963c]"
            }`}
          >
            {t("profile_friends_list")}
          </button>
          <button
            onClick={() => setMode("feed")}
            className={`flex-1 py-2 rounded-full font-black text-[10px] uppercase tracking-widest transition ${
              mode === "feed"
                ? "bg-[#c8963c] text-[#12100e] shadow"
                : "text-[#f0e6cc]/40 hover:text-[#c8963c]"
            }`}
          >
            {t("profile_feed")}
          </button>
          <button
            onClick={() => setMode("search")}
            className={`flex-1 py-2 rounded-full font-black text-[10px] uppercase tracking-widest transition flex items-center justify-center ${
              mode === "search"
                ? "bg-[#c8963c] text-[#12100e] shadow"
                : "text-[#f0e6cc]/40 hover:text-[#c8963c]"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-4.35-4.35M19 11a8 8 0 11-16 0 8 8 0 0116 0z"
              />
            </svg>
          </button>
        </div>

        {mode === "feed" ? (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {feedLoading ? (
              <div className="text-center text-[#c8963c] animate-pulse font-bold uppercase tracking-widest py-6 text-sm">
                {t("profile_loading")}
              </div>
            ) : feedItems.length === 0 ? (
              <div className="text-center text-[#f0e6cc]/50 text-sm py-6 italic border border-[#c8963c]/20 rounded-xl border-dashed">
                {t("profile_feed_empty")}
              </div>
            ) : (
              feedItems.map((item) => (
                <Link
                  key={item.id}
                  to={`/movie/${item.tmdbId}?type=${item.mediaType}`}
                  onClick={onClose}
                  className="flex items-center gap-3 bg-[#12100e] p-2.5 rounded-xl border border-[#c8963c]/20 hover:border-[#c8963c]/50 transition"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#c8963c] to-[#9a732a] flex items-center justify-center text-sm font-black text-[#12100e] overflow-hidden shrink-0">
                    {item.user.avatarUrl ? (
                      <img
                        src={item.user.avatarUrl}
                        className="w-full h-full object-cover"
                        alt={item.user.username}
                      />
                    ) : (
                      item.user.username[0].toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-[#f0e6cc] truncate">
                      <span className="font-black">{item.user.username}</span>{" "}
                      <span className="text-[#f0e6cc]/50">
                        {t(`feed_${item.type}`)}
                      </span>{" "}
                      <span className="font-bold text-[#c8963c]">
                        {item.title}
                      </span>
                      {item.type === "rated" && item.rating != null && (
                        <span className="text-[#f0e6cc]/50"> ({item.rating}/10)</span>
                      )}
                    </p>
                    <p className="text-[9px] text-[#f0e6cc]/40 uppercase tracking-wide mt-0.5">
                      {formatTimeAgo(item.createdAt, t)}
                    </p>
                  </div>
                  {item.posterUrl && (
                    <div className="w-9 h-12 rounded-md overflow-hidden shrink-0 border border-[#c8963c]/20">
                      <img
                        src={item.posterUrl}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </Link>
              ))
            )}
          </div>
        ) : mode === "search" ? (
          <div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("profile_search_placeholder")}
              autoFocus
              className="w-full px-4 py-2.5 mb-3 text-sm text-[#f0e6cc] bg-[#12100e] border border-[#c8963c]/30 rounded-xl focus:outline-none focus:border-[#c8963c] placeholder-[#f0e6cc]/30"
            />

            {searchLoading ? (
              <div className="text-center text-[#c8963c] animate-pulse font-bold uppercase tracking-widest py-6 text-sm">
                {t("profile_loading")}
              </div>
            ) : searchQuery.trim().length < 2 ? (
              <div className="text-center text-[#f0e6cc]/50 text-sm py-6 italic border border-[#c8963c]/20 rounded-xl border-dashed">
                {t("profile_search_hint")}
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center text-[#f0e6cc]/50 text-sm py-6 italic border border-[#c8963c]/20 rounded-xl border-dashed">
                {t("profile_search_no_results")}
              </div>
            ) : (
              <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                {searchResults.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 bg-[#12100e] p-2.5 rounded-xl border border-[#c8963c]/20"
                  >
                    <Link
                      to={`/user/${u.id}`}
                      onClick={onClose}
                      className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition"
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#c8963c] to-[#9a732a] flex items-center justify-center text-base font-black text-[#12100e] overflow-hidden shrink-0">
                        {u.avatarUrl ? (
                          <img
                            src={u.avatarUrl}
                            className="w-full h-full object-cover"
                            alt={u.username}
                          />
                        ) : (
                          u.username[0].toUpperCase()
                        )}
                      </div>
                      <span className="font-black text-[#f0e6cc] text-sm truncate">
                        {u.username}
                      </span>
                    </Link>
                    {u.isFriend ? (
                      <span className="shrink-0 text-[9px] font-black text-[#c8963c] uppercase tracking-wide px-1">
                        ✓ {t("profile_friends")}
                      </span>
                    ) : u.requestPending ? (
                      <span className="shrink-0 text-[9px] font-black text-[#f0e6cc]/40 uppercase tracking-wide px-1">
                        {t("profile_request_sent")}
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAddFriend(u.id)}
                        disabled={addingId === u.id}
                        className="shrink-0 text-[9px] font-black text-[#12100e] bg-[#c8963c] hover:bg-[#e8c070] uppercase tracking-wide transition disabled:opacity-40 px-2.5 py-1.5 rounded-lg"
                      >
                        {addingId === u.id ? "..." : t("profile_add_friend")}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : isLoading ? (
          <div className="text-center text-[#c8963c] animate-pulse font-bold uppercase tracking-widest py-6 text-sm">
            {t("profile_loading")}
          </div>
        ) : friends.length === 0 ? (
          <div className="text-center text-[#f0e6cc]/50 text-sm py-6 italic border border-[#c8963c]/20 rounded-xl border-dashed">
            {t("profile_no_friends")}
          </div>
        ) : (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {friends.map((friend) => (
              <div
                key={friend.id}
                className="flex items-center gap-3 bg-[#12100e] p-2.5 rounded-xl border border-[#c8963c]/20"
              >
                <Link
                  to={`/user/${friend.id}`}
                  onClick={onClose}
                  className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition"
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
                </Link>
                <button
                  onClick={() => handleRemoveFriend(friend.id)}
                  disabled={removingId === friend.id}
                  className="shrink-0 text-[9px] font-black text-red-500/60 hover:text-red-500 uppercase tracking-wide transition disabled:opacity-40 px-1"
                  title={t("profile_remove_friend")}
                >
                  {removingId === friend.id ? "..." : "✕"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

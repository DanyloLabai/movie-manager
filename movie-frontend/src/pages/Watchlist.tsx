import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import LogoImg from "../assets/logo.png";
import * as moviesApi from "../api/movies.api";
import * as usersApi from "../api/users.api";
import * as quizApi from "../api/quiz.api";
import type { QuizStats } from "../api/quiz.api";
import { useLang } from "../context/LanguageContext";
import { getUserRank, getAchievementsList } from "../utils/achievements";
import type { TranslationKey } from "../context/LanguageContext";
import NotificationBell from "../components/NotificationBell";
import StarRating from "../components/StarRating";
import RatingDistributionChart from "../components/RatingDistributionChart";
import ActivityHeatmap from "../components/ActivityHeatmap";
import { useActivityHeatmap } from "../hooks/useActivityHeatmap";
import type {
  WatchlistItem as WatchlistItemType,
  ProfileData as ProfileDataType,
} from "../types/movie.types";

const CHART_COLORS = ["#c8963c", "#9a732a", "#e8c070", "#5c4519", "#3a2b0f"];
const WATCHLIST_PAGE_SIZE = 30;
const FRIENDS_FEED_PAGE_SIZE = 30;

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

export default function Watchlist() {
  const { t } = useLang();
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
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMovies, setHasMoreMovies] = useState(false);

  useEffect(() => {
    navigate(`?tab=${activeTab}`, { replace: true });
  }, [activeTab, navigate]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [username, setUsername] = useState<string>("");

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [isFriendsModalOpen, setIsFriendsModalOpen] = useState(false);
  const [quizStats, setQuizStats] = useState<QuizStats | null>(null);

  useEffect(() => {
    quizApi
      .getMyStats()
      .then(setQuizStats)
      .catch(() => {});
  }, []);

  // Achievements card should never grow taller than its Overview sibling —
  // CSS Grid stretch would do the opposite (grow both to the tallest), so
  // measure Overview's real height and cap Achievements to match it,
  // scrolling internally. Only applied at the md+ breakpoint where the two
  // sit side by side; below that they stack and should size naturally.
  const overviewCardRef = useRef<HTMLDivElement>(null);
  const [achievementsMaxHeight, setAchievementsMaxHeight] = useState<
    number | undefined
  >(undefined);

  useEffect(() => {
    if (activeTab !== "profile") return;
    const el = overviewCardRef.current;
    if (!el) return;
    const update = () => {
      setAchievementsMaxHeight(
        window.innerWidth >= 768 ? el.offsetHeight : undefined,
      );
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [activeTab, profileData, quizStats]);
  const [ratingModalData, setRatingModalData] = useState<{
    isOpen: boolean;
    tmdbId: number | null;
    title: string;
  }>({ isOpen: false, tmdbId: null, title: "" });
  const [modalRating, setModalRating] = useState(0);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchMovies = useCallback(async () => {
    setIsLoading(true);
    try {
      const endpointName = activeTab === "watchlist" ? "watchlist" : "watched";
      const response = await moviesApi.getWatchlist(endpointName, {
        limit: WATCHLIST_PAGE_SIZE,
        offset: 0,
      });
      setMovies(response || []);
      setHasMoreMovies((response?.length || 0) === WATCHLIST_PAGE_SIZE);
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

  const loadMoreMovies = useCallback(async () => {
    if (isLoadingMore || !hasMoreMovies) return;
    setIsLoadingMore(true);
    try {
      const endpointName = activeTab === "watchlist" ? "watchlist" : "watched";
      const response = await moviesApi.getWatchlist(endpointName, {
        limit: WATCHLIST_PAGE_SIZE,
        offset: movies.length,
      });
      setMovies((prev) => [...prev, ...(response || [])]);
      setHasMoreMovies((response?.length || 0) === WATCHLIST_PAGE_SIZE);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [activeTab, movies.length, isLoadingMore, hasMoreMovies]);

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

  const activityHeatmap = useActivityHeatmap(activeTab === "profile");

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
    setModalRating(0);
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

  const handleRateMovie = async (tmdbId: number, newRating: number) => {
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
    setModalRating(0);
  };

  const handleModalConfirm = async () => {
    if (ratingModalData.tmdbId)
      await confirmMarkWatched(
        ratingModalData.tmdbId,
        modalRating > 0 ? modalRating : null,
      );
    closeRatingModal();
  };

  const renderProfileTab = () => {
    const totalCount = profileData?.totalCount || 0;
    const favoritesCount = profileData?.favorites?.length || 0;
    const watchedCount = profileData?.watchedCount || 0;

    const hasStats = Boolean(
      profileData?.stats &&
      profileData.stats.genreDistribution &&
      profileData.stats.genreDistribution.length > 0,
    );

    const achievementsList = getAchievementsList(
      {
        favoritesCount,
        watchedCount,
        totalCount,
        quizSolvedCount: quizStats?.totalSolved,
        quizPerfectCount: quizStats?.perfectSolves,
        quizCurrentStreak: quizStats?.currentStreak,
      },
      t,
    );

    return (
      <div className="space-y-4 animate-fade-in">
        {/* Overview + Achievements bento */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
          <div
            ref={overviewCardRef}
            className="md:col-span-2 glass-panel border border-[#c8963c]/20 rounded-2xl p-4 sm:p-6"
          >
            <h3 className="text-sm font-black text-[#f0e6cc] uppercase tracking-widest mb-4">
              {t("profile_overview")}
            </h3>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="bg-[#12100e] border border-[#c8963c]/10 rounded-xl p-3 text-center">
                <div className="text-xl sm:text-2xl font-black text-[#c8963c]">
                  {watchedCount}
                </div>
                <div className="text-[8px] sm:text-[9px] text-[#f0e6cc]/40 uppercase font-bold tracking-widest">
                  {t("watchlist_watched")}
                </div>
              </div>
              <div className="bg-[#12100e] border border-[#c8963c]/10 rounded-xl p-3 text-center">
                <div className="text-xl sm:text-2xl font-black text-[#c8963c]">
                  {profileData?.stats?.averageRating || "0.0"}
                </div>
                <div className="text-[8px] sm:text-[9px] text-[#f0e6cc]/40 uppercase font-bold tracking-widest">
                  {t("stats_avg")}
                </div>
              </div>
              <div className="bg-[#12100e] border border-[#c8963c]/10 rounded-xl p-3 text-center">
                <div className="text-xl sm:text-2xl font-black text-[#c8963c]">
                  {quizStats?.currentStreak ?? 0}
                </div>
                <div className="text-[8px] sm:text-[9px] text-[#f0e6cc]/40 uppercase font-bold tracking-widest">
                  {t("quiz_streak_current")}
                </div>
              </div>
            </div>

            {hasStats && (
              <div className="mt-4 pt-4 border-t border-[#c8963c]/10">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#f0e6cc]/50">
                    {t("profile_completion")}
                  </span>
                  <span className="text-[#c8963c] font-black text-xs">
                    {profileData?.stats?.completionRate || 0}%
                  </span>
                </div>
                <div className="w-full h-2 bg-[#12100e] rounded-full overflow-hidden border border-[#c8963c]/10">
                  <div
                    className="h-full bg-gradient-to-r from-[#9a732a] to-[#c8963c] transition-all duration-1000 ease-out"
                    style={{
                      width: `${profileData?.stats?.completionRate || 0}%`,
                    }}
                  />
                </div>
                <p className="text-[8px] text-center text-[#f0e6cc]/40 mt-1.5 italic">
                  {watchedCount} / {totalCount}{" "}
                  {t("watchlist_watched").toLowerCase()}
                </p>
              </div>
            )}
          </div>

          <div
            className="glass-panel border border-[#c8963c]/20 rounded-2xl p-4 sm:p-6 flex flex-col"
            style={
              achievementsMaxHeight
                ? { maxHeight: achievementsMaxHeight }
                : undefined
            }
          >
            <h3 className="text-sm font-black text-[#f0e6cc] uppercase tracking-widest mb-4 shrink-0">
              {t("profile_achievements")}
            </h3>
            <div className="grid grid-cols-2 sm:flex sm:flex-col gap-1.5 sm:gap-2 flex-1 min-h-0 overflow-y-auto scrollbar-hide pr-1">
              {achievementsList.map((ach) => (
                <div
                  key={ach.id}
                  className={`flex items-center gap-1.5 sm:gap-3 border p-1.5 sm:p-2.5 rounded-lg transition ${
                    ach.isUnlocked
                      ? "bg-[#12100e] border-[#c8963c]/10"
                      : "bg-[#12100e]/40 border-[#c8963c]/5"
                  }`}
                >
                  <svg
                    className={`w-3.5 h-3.5 sm:w-5 sm:h-5 shrink-0 ${ach.isUnlocked ? "text-[#c8963c]" : "text-[#f0e6cc]/20"}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    {ach.isUnlocked ? (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35"
                      />
                    ) : (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    )}
                  </svg>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-[10px] sm:text-xs font-bold truncate ${ach.isUnlocked ? "text-[#f0e6cc]" : "text-[#f0e6cc]/40"}`}
                    >
                      {ach.text}
                    </p>
                    <p className="hidden sm:block text-[9px] text-[#f0e6cc]/40 truncate">
                      {ach.requirement}
                      {!ach.isUnlocked && ` · ${ach.current}/${ach.needed}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Activity Heatmap */}
        <ActivityHeatmap
          days={activityHeatmap.days}
          year={activityHeatmap.year}
          isLoading={activityHeatmap.isLoading}
          onPrevYear={activityHeatmap.goToPreviousYear}
          onNextYear={activityHeatmap.goToNextYear}
          canGoNext={activityHeatmap.canGoNext}
        />

        {/* Top Favorites */}
        <div className="p-4 glass-panel rounded-2xl border border-[#c8963c]/20 shadow-xl">
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
                          className="absolute top-1 right-1 w-6 h-6 btn-glass btn-glass-dark rounded-full flex items-center justify-center transition z-10"
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

        {/* Movie Wrapped */}
        {hasStats && (
          <div className="p-4 glass-panel rounded-2xl border border-[#c8963c]/20 shadow-xl">
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
                <RatingDistributionChart
                  data={profileData.stats.ratingDistribution}
                  averageRating={profileData.stats.averageRating}
                />
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
                            ★ {item.rating}/10
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-[100dvh] bg-[#12100e] font-sans text-[#f0e6cc] relative overscroll-none selection:bg-[#c8963c] selection:text-[#12100e]">
      <div className="sm:hidden sticky top-0 z-40 bg-[#12100e]/95 backdrop-blur-md border-b border-[#c8963c]/10 mb-6 pt-[env(safe-area-inset-top)]">
        <header className="flex flex-row items-center justify-between gap-3 py-4 sm:py-5 px-4 sm:px-8 w-full">
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
                {t("app_tagline")}
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-2 shrink-0">
            <NotificationBell />
          </div>
        </header>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 pb-24 sm:pb-12 sm:pt-10">
        <div className="flex items-center gap-4 p-4 mb-6 glass-panel rounded-2xl border border-[#c8963c]/20 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#c8963c] to-[#9a732a]" />

          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-tr from-[#c8963c] to-[#9a732a] rounded-full flex items-center justify-center text-2xl font-black shadow-lg uppercase text-[#12100e] shrink-0 overflow-hidden border-2 border-[#c8963c]/50 glow-gold-sm">
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
              {getUserRank(profileData?.watchedCount || 0, t)}
            </p>
          </div>

          <button
            onClick={() => setIsFriendsModalOpen(true)}
            className="shrink-0 h-10 sm:h-11 px-4 btn-glass btn-glass-dark rounded-full flex items-center gap-2 text-[#c8963c] font-black uppercase tracking-widest text-[10px] sm:text-xs transition active:scale-95"
            title={t("profile_friends")}
          >
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-5.13a4 4 0 11-8 0 4 4 0 018 0zm6 3a4 4 0 10-4-4"
              />
            </svg>
            <span className="hidden sm:inline">{t("profile_friends")}</span>
          </button>
        </div>

        <div className="flex gap-6 sm:gap-8 mb-8 border-b border-[#c8963c]/10 overflow-x-auto scrollbar-hide">
          {(["profile", "watchlist", "watched"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`relative pb-3 shrink-0 font-black text-[10px] sm:text-xs uppercase tracking-widest transition-colors ${
                activeTab === tab
                  ? "text-[#c8963c]"
                  : "text-[#f0e6cc]/40 hover:text-[#f0e6cc]/70"
              }`}
            >
              {tab === "watchlist"
                ? t("watchlist_planned")
                : tab === "profile"
                  ? t("nav_profile")
                  : t("watchlist_watched")}
              {activeTab === tab && (
                <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-[#c8963c] shadow-[0_0_8px_1px_rgba(200,150,60,0.6)]" />
              )}
            </button>
          ))}
        </div>

        <main>
          {activeTab === "profile" ? (
            renderProfileTab()
          ) : isLoading ? (
            <p className="text-center text-[#f0e6cc]/50 animate-pulse text-sm mt-10 font-semibold uppercase tracking-widest">
              {t("watchlist_loading")}
            </p>
          ) : movies.length === 0 ? (
            <div className="text-center p-8 bg-[#1a1714] rounded-2xl border border-[#c8963c]/20 shadow-2xl mt-8 max-w-sm mx-auto">
              <p className="text-[#f0e6cc]/60 text-base font-medium mb-5">
                {t("watchlist_empty")}
              </p>
              <Link
                to="/search"
                className="inline-block px-6 py-3 btn-glass btn-glass-gold text-[#12100e] font-black uppercase tracking-wider rounded-xl transition text-sm"
              >
                {t("watchlist_discover")}
              </Link>
            </div>
          ) : (
            <>
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
                          <div className="absolute top-1.5 left-1.5 bg-[#c8963c] text-[#12100e] text-[7px] lg:text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                            {t("watched")}
                          </div>
                        )}
                        {activeTab === "watchlist" && !released && (
                          <div className="absolute top-1.5 left-1.5 bg-blue-500/90 text-white text-[7px] lg:text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase">
                            {t("umcoming")}
                          </div>
                        )}
                        {item.mediaType === "tv" &&
                          item.currentSeason &&
                          item.currentEpisode && (
                            <div className="absolute top-10 right-1.5 bg-[#12100e]/90 text-[#c8963c] border border-[#c8963c]/40 text-[7px] lg:text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                              S{item.currentSeason}E{item.currentEpisode}
                            </div>
                          )}

                        {released ? (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleToggleFavorite(item.tmdbId);
                            }}
                            className="absolute top-1.5 right-1.5 w-7 h-7 btn-glass btn-glass-dark rounded-full flex items-center justify-center transition z-10"
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
                          className="text-[11px] lg:text-[13px] font-bold text-[#f0e6cc] truncate hover:text-[#c8963c] transition"
                          title={item.title}
                        >
                          {item.title}
                        </Link>

                        {released || activeTab === "watched" ? (
                          <div className="mb-1.5 mt-auto pt-2">
                            <StarRating
                              size="sm"
                              value={item.rating || 0}
                              onRate={(rating) =>
                                handleRateMovie(item.tmdbId, rating)
                              }
                            />
                          </div>
                        ) : (
                          <div className="flex justify-center mb-1.5 mt-auto pt-2">
                            <span className="text-[8px] lg:text-[10px] font-black text-[#f0e6cc]/20 uppercase tracking-wider py-1.5">
                              {t("common_unreleased")}
                            </span>
                          </div>
                        )}

                        <div className="flex justify-between items-center gap-1 pt-2 border-t border-[#c8963c]/20">
                          {activeTab === "watchlist" ? (
                            released ? (
                              <button
                                onClick={() => handleMarkWatched(item.tmdbId)}
                                className="text-[9px] lg:text-[11px] font-bold text-[#c8963c] hover:text-[#e8c070] transition uppercase tracking-wide"
                              >
                                {t("watchlist_mark_watched").replace(
                                  "Mark as ",
                                  "",
                                )}
                              </button>
                            ) : (
                              <span className="text-[9px] lg:text-[11px] font-black text-[#c8963c]/40 uppercase tracking-wide">
                                {t("umcoming")}
                              </span>
                            )
                          ) : (
                            <Link
                              to={`/movie/${item.tmdbId}?type=${item.mediaType || "movie"}`}
                              className="text-[9px] lg:text-[11px] font-bold text-[#c8963c] uppercase tracking-wide hover:text-[#e8c070] transition"
                            >
                              {t("details")}
                            </Link>
                          )}
                          <button
                            onClick={() => handleDelete(item.tmdbId)}
                            className="text-[9px] lg:text-[11px] font-bold text-red-500/60 hover:text-red-500 transition uppercase"
                          >
                            {t("deleted")}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {hasMoreMovies && (
                <div className="flex justify-center mt-6">
                  <button
                    onClick={loadMoreMovies}
                    disabled={isLoadingMore}
                    className="px-6 py-2.5 btn-glass btn-glass-dark text-[#c8963c] font-black uppercase tracking-wider rounded-xl transition text-xs disabled:opacity-50"
                  >
                    {isLoadingMore
                      ? t("common_loading_more")
                      : t("common_load_more")}
                  </button>
                </div>
              )}
            </>
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
                {t("movie_rate_desc")} "{ratingModalData.title}"
              </p>
              <div className="mb-6">
                <StarRating
                  size="lg"
                  value={modalRating}
                  onRate={setModalRating}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={closeRatingModal}
                  className="flex-1 py-3 font-black text-[#f0e6cc] uppercase tracking-widest transition btn-glass btn-glass-dark active:scale-[0.98] text-xs"
                >
                  {t("movie_rating_cancel")}
                </button>
                <button
                  onClick={handleModalConfirm}
                  className="flex-1 py-3 font-black text-[#12100e] uppercase tracking-widest transition btn-glass btn-glass-gold active:scale-[0.98] text-xs"
                >
                  {t("movie_rating_ok")}
                </button>
              </div>
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
  const [feedHasMore, setFeedHasMore] = useState(false);
  const [feedLoadingMore, setFeedLoadingMore] = useState(false);

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
      .then((data) => {
        setFeedItems(data || []);
        setFeedHasMore((data?.length || 0) === FRIENDS_FEED_PAGE_SIZE);
      })
      .catch((error) => console.error(error))
      .finally(() => {
        setFeedLoading(false);
        setFeedLoaded(true);
      });
  }, [mode, feedLoaded]);

  const loadMoreFeed = async () => {
    if (feedLoadingMore || !feedHasMore || feedItems.length === 0) return;
    setFeedLoadingMore(true);
    try {
      const cursor = feedItems[feedItems.length - 1].createdAt;
      const data = await usersApi.getFriendsFeed(cursor);
      setFeedItems((prev) => [...prev, ...(data || [])]);
      setFeedHasMore((data?.length || 0) === FRIENDS_FEED_PAGE_SIZE);
    } catch (error) {
      console.error(error);
    } finally {
      setFeedLoadingMore(false);
    }
  };

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
                ? "btn-glass btn-glass-gold text-[#12100e]"
                : "text-[#f0e6cc]/40 hover:text-[#c8963c]"
            }`}
          >
            {t("profile_friends_list")}
          </button>
          <button
            onClick={() => setMode("feed")}
            className={`flex-1 py-2 rounded-full font-black text-[10px] uppercase tracking-widest transition ${
              mode === "feed"
                ? "btn-glass btn-glass-gold text-[#12100e]"
                : "text-[#f0e6cc]/40 hover:text-[#c8963c]"
            }`}
          >
            {t("profile_feed")}
          </button>
          <button
            onClick={() => setMode("search")}
            className={`flex-1 py-2 rounded-full font-black text-[10px] uppercase tracking-widest transition flex items-center justify-center ${
              mode === "search"
                ? "btn-glass btn-glass-gold text-[#12100e]"
                : "text-[#f0e6cc]/40 hover:text-[#c8963c]"
            }`}
          >
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
                        <span className="text-[#f0e6cc]/50">
                          {" "}
                          ({item.rating}/10)
                        </span>
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
            {!feedLoading && feedItems.length > 0 && feedHasMore && (
              <div className="flex justify-center pt-2">
                <button
                  onClick={loadMoreFeed}
                  disabled={feedLoadingMore}
                  className="px-5 py-2 btn-glass btn-glass-dark text-[#c8963c] font-black uppercase tracking-wider rounded-xl transition text-[10px] disabled:opacity-50"
                >
                  {feedLoadingMore
                    ? t("common_loading_more")
                    : t("common_load_more")}
                </button>
              </div>
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
                        className="shrink-0 text-[9px] font-black text-[#12100e] btn-glass btn-glass-gold uppercase tracking-wide transition disabled:opacity-40 px-2.5 py-1.5 rounded-lg"
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

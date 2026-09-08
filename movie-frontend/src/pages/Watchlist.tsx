import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { saveScrollState, consumeScrollState } from "../utils/scrollRestoration";
import * as moviesApi from "../api/movies.api";
import * as usersApi from "../api/users.api";
import type { FriendRequest } from "../api/users.api";
import * as quizApi from "../api/quiz.api";
import type { QuizStats } from "../api/quiz.api";
import { useLang } from "../context/LanguageContext";
import { getUserRank, getAchievementsList } from "../utils/achievements";
import { formatTimeAgo } from "../utils/time";
import NotificationBell from "../components/NotificationBell";
import LogoIcon from "../components/LogoIcon";
import StarRating from "../components/StarRating";
import ActivityHeatmap from "../components/ActivityHeatmap";
import { useActivityHeatmap } from "../hooks/useActivityHeatmap";
import ProfileHero from "../components/profile/ProfileHero";
import ProfileSection from "../components/profile/ProfileSection";
import ProfileStatsStrip from "../components/profile/ProfileStatsStrip";
import ProfileFavoritesPanel from "../components/profile/ProfileFavoritesPanel";
import ProfileWrappedPanel from "../components/profile/ProfileWrappedPanel";
import ProfileChartsPanel from "../components/profile/ProfileChartsPanel";
import type {
  WatchlistItem as WatchlistItemType,
  ProfileData as ProfileDataType,
} from "../types/movie.types";
import type { Friend } from "../types/friend.types";

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

export default function Watchlist() {
  const { t } = useLang();
  const [movies, setMovies] = useState<WatchlistItemType[]>([]);

  const [profileData, setProfileData] = useState<ProfileDataType | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialTab =
    (searchParams.get("tab") as
      | "profile"
      | "watchlist"
      | "watched"
      | "favorites") || "profile";
  const [activeTab, setActiveTab] = useState<
    "profile" | "watchlist" | "watched" | "favorites"
  >(initialTab);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreMovies, setHasMoreMovies] = useState(false);
  const [mediaFilter, setMediaFilter] = useState<"all" | "movie" | "tv">("all");
  const [sortDesc, setSortDesc] = useState(true);
  const [watchedSortBy, setWatchedSortBy] = useState<"rating" | "addedAt">(
    "rating",
  );

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

  const [friends, setFriends] = useState<Friend[]>([]);

  useEffect(() => {
    usersApi
      .getFriends()
      .then(setFriends)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab === "profile") return;
    moviesApi
      .getProfile()
      .then((data) => {
        if (data.username) setUsername(data.username);
        if (data.avatarUrl !== undefined) setAvatarUrl(data.avatarUrl ?? null);
        setProfileData((prev) => prev ?? data);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const fetchMoviesPage = useCallback(
    (offset: number, limit: number = WATCHLIST_PAGE_SIZE) => {
      const sortDir = sortDesc ? "desc" : "asc";
      if (activeTab === "favorites") {
        return moviesApi.getFavorites({
          limit,
          offset,
          sortBy: "updatedAt",
          sortDir,
        });
      }
      const endpointName = activeTab === "watchlist" ? "watchlist" : "watched";
      return moviesApi.getWatchlist(endpointName, {
        limit,
        offset,
        sortBy: activeTab === "watched" ? watchedSortBy : "addedAt",
        sortDir,
      });
    },
    [activeTab, sortDesc, watchedSortBy],
  );

  // Restoring scroll position after returning from a movie's details page needs
  // the same number of items re-loaded first (pagination is offset-based), so we
  // stash the target scrollY here and only apply it once that data has rendered.
  const pendingScrollYRef = useRef<number | null>(null);

  const fetchMovies = useCallback(async () => {
    setIsLoading(true);
    try {
      const savedScroll = consumeScrollState(activeTab);
      const initialLimit =
        savedScroll?.itemCount && savedScroll.itemCount > WATCHLIST_PAGE_SIZE
          ? savedScroll.itemCount
          : WATCHLIST_PAGE_SIZE;
      const response = await fetchMoviesPage(0, initialLimit);
      setMovies(response || []);
      setHasMoreMovies((response?.length || 0) === initialLimit);
      if (savedScroll) pendingScrollYRef.current = savedScroll.scrollY;
    } catch (error: unknown) {
      const apiError = error as { response?: { status?: number } };
      if (apiError.response?.status === 401) {
        localStorage.removeItem("token");
        navigate("/login");
      }
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, fetchMoviesPage, navigate]);

  const loadMoreMovies = useCallback(async () => {
    if (isLoadingMore || !hasMoreMovies) return;
    setIsLoadingMore(true);
    try {
      const response = await fetchMoviesPage(movies.length);
      setMovies((prev) => [...prev, ...(response || [])]);
      setHasMoreMovies((response?.length || 0) === WATCHLIST_PAGE_SIZE);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [fetchMoviesPage, movies.length, isLoadingMore, hasMoreMovies]);

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
      const savedScroll = consumeScrollState("profile");
      if (savedScroll) pendingScrollYRef.current = savedScroll.scrollY;
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
    if (
      activeTab === "watchlist" ||
      activeTab === "watched" ||
      activeTab === "favorites"
    ) {
      fetchMovies();
    } else if (activeTab === "profile") {
      fetchProfile();
    }
  }, [activeTab, fetchMovies, fetchProfile]);

  useEffect(() => {
    if (isLoading || pendingScrollYRef.current === null) return;
    const targetY = pendingScrollYRef.current;
    pendingScrollYRef.current = null;
    // Wait a frame so the just-rendered content has been painted/laid out
    // before we scroll to a position that depends on its height.
    requestAnimationFrame(() => window.scrollTo({ top: targetY }));
  }, [isLoading, movies, profileData]);

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
    } else if (activeTab === "favorites") {
      setMovies((prev) => prev.filter((item) => item.tmdbId !== tmdbId));
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
      // Roll the optimistic update back by re-fetching whichever list it touched-
      // every branch above except "profile" mutates `movies`.
      if (activeTab === "profile") fetchProfile();
      else fetchMovies();
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
      fetchMovies();
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
    if (activeTab === "favorites") {
      setMovies((prev) =>
        prev.map((item) =>
          item.tmdbId === tmdbId
            ? { ...item, isWatched: true, rating: rating ?? item.rating }
            : item,
        ),
      );
    } else {
      setMovies((prev) => prev.filter((item) => item.tmdbId !== tmdbId));
    }
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
      fetchMovies();
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
    const favoritesCount =
      profileData?.totalFavorites ?? profileData?.favorites?.length ?? 0;
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
      <div className="animate-fade-in">
        <ProfileSection>
          <ProfileStatsStrip
            stats={[
              { value: watchedCount, label: t("watchlist_watched") },
              {
                value: profileData?.stats?.averageRating || "0.0",
                label: t("stats_avg"),
              },
              {
                value: quizStats?.currentStreak ?? 0,
                label: t("quiz_streak_current"),
              },
              { value: friends.length, label: t("profile_friends") },
            ]}
            watchedCount={watchedCount}
            completionRate={profileData?.stats?.completionRate || 0}
            totalCount={totalCount}
          />
        </ProfileSection>

        <ProfileSection>
          <ActivityHeatmap
            days={activityHeatmap.days}
            year={activityHeatmap.year}
            isLoading={activityHeatmap.isLoading}
            onPrevYear={activityHeatmap.goToPreviousYear}
            onNextYear={activityHeatmap.goToNextYear}
            canGoNext={activityHeatmap.canGoNext}
          />
        </ProfileSection>

        <ProfileSection noBorder={!hasStats}>
          <ProfileFavoritesPanel
            favorites={profileData?.favorites || []}
            achievements={achievementsList}
            friends={friends}
            friendsCount={friends.length}
            isReleased={isReleased}
            onToggleFavorite={handleToggleFavorite}
            onOpenFriends={() => setIsFriendsModalOpen(true)}
            onViewAllFavorites={() => setActiveTab("favorites")}
            onMovieLinkClick={handleMovieLinkClick}
          />
        </ProfileSection>

        {hasStats && profileData?.stats && (
          <ProfileSection>
            <ProfileWrappedPanel
              username={username}
              stats={profileData.stats}
            />
          </ProfileSection>
        )}

        {hasStats && profileData?.stats && (
          <ProfileSection noBorder>
            <ProfileChartsPanel
              genreDistribution={profileData.stats.genreDistribution || []}
              ratingDistribution={profileData.stats.ratingDistribution || []}
              averageRating={profileData.stats.averageRating || "0.0"}
              topRated={profileData.stats.topRated || []}
              onMovieLinkClick={handleMovieLinkClick}
            />
          </ProfileSection>
        )}
      </div>
    );
  };

  const displayedMovies = movies.filter(
    (item) => mediaFilter === "all" || item.mediaType === mediaFilter,
  );

  const handleMovieLinkClick = () => saveScrollState(activeTab, movies.length);

  return (
    <div className="min-h-[100dvh] bg-[#0f0d0a] font-ui text-[#f2ead9] relative overscroll-none selection:bg-[#d9ac54] selection:text-[#14110c]">
      <div className="sm:hidden sticky top-0 z-40 bg-[#0f0d0a]/95 backdrop-blur-md border-b border-[rgba(217,172,84,.16)] pt-[env(safe-area-inset-top)]">
        <header className="flex flex-row items-center justify-between gap-3 py-4 px-4 w-full">
          <Link
            to="/search"
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity shrink-0"
          >
            <span className="font-ui font-bold text-[17px] tracking-[4px] text-[#d9ac54]">
              LUMEN
            </span>
            <LogoIcon />
          </Link>

          <div className="flex items-center gap-2 shrink-0">
            <NotificationBell />
          </div>
        </header>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-8 pb-24 sm:pb-12 sm:pt-9">
        <div className="mb-6">
          <ProfileHero
            username={username}
            avatarUrl={avatarUrl}
            rank={getUserRank(profileData?.watchedCount || 0, t)}
            memberSince={profileData?.memberSince}
            recent={profileData?.recent || []}
            friendsCount={friends.length}
            userId={profileData?.id}
            onOpenFriends={() => setIsFriendsModalOpen(true)}
            onShowToast={showToast}
            compact={activeTab !== "profile"}
          />
        </div>

        <div className="flex items-center gap-1 mb-8 border-b border-[rgba(217,172,84,.16)] overflow-x-auto overscroll-x-contain touch-pan-x scrollbar-hide">
          {(["profile", "watchlist", "watched", "favorites"] as const).map(
            (tab) => {
              const watchedCount = profileData?.watchedCount ?? null;
              const watchlistCount =
                profileData?.totalCount != null && watchedCount != null
                  ? profileData.totalCount - watchedCount
                  : null;
              const tabCount =
                tab === "watchlist"
                  ? watchlistCount
                  : tab === "watched"
                    ? watchedCount
                    : null;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`relative px-4 py-4 shrink-0 font-ui font-semibold text-[11.5px] uppercase tracking-[2px] transition-colors ${
                    activeTab === tab
                      ? "text-[#d9ac54]"
                      : "text-[#8f8574] hover:text-[#c9c0ac]"
                  }`}
                >
                  {tab === "watchlist"
                    ? t("watchlist_planned")
                    : tab === "profile"
                      ? t("nav_profile")
                      : tab === "favorites"
                        ? t("watchlist_favorites")
                        : t("watchlist_watched")}
                  {tabCount != null && (
                    <span className="text-[#645c4d]"> · {tabCount}</span>
                  )}
                  {activeTab === tab && (
                    <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-[#d9ac54]" />
                  )}
                </button>
              );
            },
          )}

          {activeTab === "watchlist" && (
            <div className="ml-auto flex items-center gap-1.5 py-2">
              {(["all", "movie", "tv"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setMediaFilter(f)}
                  className={`px-3.5 py-1.5 rounded-full font-ui font-bold text-[10px] uppercase tracking-[1px] transition ${
                    mediaFilter === f
                      ? "bg-[#d9ac54] text-[#14110c]"
                      : "border border-white/[.15] text-[#8f8574] hover:text-[#c9c0ac]"
                  }`}
                >
                  {f === "all"
                    ? t("watchlist_filter_all")
                    : f === "movie"
                      ? t("watchlist_filter_movies")
                      : t("watchlist_filter_tv")}
                </button>
              ))}
              <button
                onClick={() => setSortDesc((v) => !v)}
                className="ml-2.5 text-[11px] text-[#8f8574] hover:text-[#d9ac54] transition whitespace-nowrap"
              >
                {t("watchlist_sort_added")} {sortDesc ? "↓" : "↑"}
              </button>
            </div>
          )}

          {activeTab === "watched" && (
            <div className="ml-auto flex items-center gap-1.5 py-2">
              {(["rating", "addedAt"] as const).map((field) => (
                <button
                  key={field}
                  onClick={() => setWatchedSortBy(field)}
                  className={`px-3.5 py-1.5 rounded-full font-ui font-bold text-[10px] uppercase tracking-[1px] transition ${
                    watchedSortBy === field
                      ? "bg-[#d9ac54] text-[#14110c]"
                      : "border border-white/[.15] text-[#8f8574] hover:text-[#c9c0ac]"
                  }`}
                >
                  {field === "rating"
                    ? t("watchlist_sort_by_rating")
                    : t("watchlist_sort_by_date")}
                </button>
              ))}
              <button
                onClick={() => setSortDesc((v) => !v)}
                className="ml-2.5 text-[11px] text-[#8f8574] hover:text-[#d9ac54] transition whitespace-nowrap"
              >
                {sortDesc ? "↓" : "↑"}
              </button>
            </div>
          )}
        </div>

        <main>
          {activeTab === "profile" ? (
            renderProfileTab()
          ) : isLoading ? (
            <p className="text-center text-[#8f8574] animate-pulse text-sm mt-10 font-semibold uppercase tracking-widest">
              {t("watchlist_loading")}
            </p>
          ) : movies.length === 0 ? (
            <div className="text-center p-10 border border-[rgba(217,172,84,.2)] border-dashed rounded-[10px] mt-8 max-w-sm mx-auto">
              <p className="text-[#c9c0ac] text-base font-medium mb-5">
                {t("watchlist_empty")}
              </p>
              <Link
                to="/search"
                className="inline-block px-6 py-3 bg-[#d9ac54] hover:bg-[#e8c377] text-[#14110c] font-bold uppercase tracking-wider rounded-full transition text-sm"
              >
                {t("watchlist_discover")}
              </Link>
            </div>
          ) : displayedMovies.length === 0 ? (
            <p className="text-center text-[#8f8574] text-sm mt-10 font-medium">
              {t("search_empty")}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-[18px] gap-y-[26px]">
                {displayedMovies.map((item) => {
                  const released = isReleased(item);
                  return (
                    <div key={item.id} className="group flex flex-col gap-[9px] font-ui">
                      <div className="relative w-full aspect-[2/3] rounded-[6px] overflow-hidden bg-[#0f0d0a]">
                        <Link
                          to={`/movie/${item.tmdbId}?type=${item.mediaType || "movie"}&fromTab=${activeTab}`}
                          onClick={handleMovieLinkClick}
                          className="block w-full h-full"
                        >
                          {item.posterUrl ? (
                            <img
                              src={item.posterUrl}
                              alt={item.title}
                              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex items-center justify-center w-full h-full text-[#f2ead9]/30 text-[9px] italic">
                              {t("common_na")}
                            </div>
                          )}
                        </Link>

                        {(activeTab === "watchlist" ||
                          (activeTab === "favorites" && !item.isWatched)) &&
                          !released && (
                          <div className="absolute top-1.5 left-1.5 font-mono-ui text-[8px] font-semibold tracking-[1px] text-[#d9ac54] bg-[rgba(15,13,10,.75)] px-1.5 py-0.5 rounded-full uppercase">
                            {t("umcoming")}
                          </div>
                        )}
                        {item.mediaType === "tv" &&
                          item.currentSeason &&
                          item.currentEpisode && (
                            <div className="absolute bottom-1.5 left-1.5 font-mono-ui text-[8px] font-semibold tracking-[1px] text-[#d9ac54] bg-[rgba(15,13,10,.75)] px-1.5 py-0.5 rounded-full uppercase">
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
                            className="absolute top-1.5 right-1.5 w-6 h-6 bg-[rgba(15,13,10,.75)] rounded-full flex items-center justify-center transition z-10 group/heart"
                          >
                            <svg
                              className={`w-3 h-3 ${item.isFavorite ? "text-red-500 fill-red-500" : "text-[#c9c0ac] group-hover/heart:text-red-500"}`}
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
                          <div className="absolute top-1.5 right-1.5 w-6 h-6 bg-[rgba(15,13,10,.75)] rounded-full flex items-center justify-center text-[#d9ac54] z-10">
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

                      <Link
                        to={`/movie/${item.tmdbId}?type=${item.mediaType || "movie"}`}
                        onClick={handleMovieLinkClick}
                        className="flex items-center justify-between gap-2"
                        title={item.title}
                      >
                        <span className="text-[13px] font-semibold text-[#f2ead9] truncate hover:text-[#d9ac54] transition">
                          {item.title}
                        </span>
                        {item.isWatched && (
                          <span className="font-mono-ui text-[11px] font-bold text-[#d9ac54] shrink-0">
                            {(item.rating || 0).toFixed(1).replace(/\.0$/, "")}/10
                          </span>
                        )}
                      </Link>

                      {activeTab === "watched" ||
                      (activeTab === "favorites" && item.isWatched) ? (
                        <div className="-mt-1">
                          <StarRating
                            size="sm"
                            value={item.rating || 0}
                            onRate={(rating) => handleRateMovie(item.tmdbId, rating)}
                          />
                        </div>
                      ) : (
                        <p className="font-mono-ui text-[10px] text-[#8f8574] -mt-1">
                          {(item.releaseDate
                            ? new Date(item.releaseDate).getFullYear()
                            : item.releaseYear) || "—"}{" "}
                          · {item.mediaType === "tv" ? t("common_tv") : t("common_movie")}
                        </p>
                      )}

                      <div className="flex justify-between items-center gap-1 pt-[9px] border-t border-[rgba(217,172,84,.16)]">
                        {activeTab === "watchlist" ||
                        (activeTab === "favorites" && !item.isWatched) ? (
                          released ? (
                            <button
                              onClick={() => handleMarkWatched(item.tmdbId)}
                              className="font-semibold text-[10px] tracking-[1.5px] text-[#d9ac54] hover:text-[#e8c377] transition uppercase"
                            >
                              ✓ {t("watched")}
                            </button>
                          ) : (
                            <span className="font-semibold text-[10px] tracking-[1.5px] text-[#645c4d] uppercase">
                              {t("umcoming")}
                            </span>
                          )
                        ) : (
                          <Link
                            to={`/movie/${item.tmdbId}?type=${item.mediaType || "movie"}`}
                            onClick={handleMovieLinkClick}
                            className="font-semibold text-[10px] tracking-[1.5px] text-[#d9ac54] hover:text-[#e8c377] transition uppercase"
                          >
                            {t("details")}
                          </Link>
                        )}
                        <button
                          onClick={() => handleDelete(item.tmdbId)}
                          className="font-semibold text-[10px] tracking-[1.5px] text-[#645c4d] hover:text-[#e0554d] transition uppercase"
                        >
                          {t("deleted")}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {hasMoreMovies && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={loadMoreMovies}
                    disabled={isLoadingMore}
                    className="px-6 py-2.5 border border-[#d9ac54]/40 hover:border-[#d9ac54] text-[#d9ac54] font-bold uppercase tracking-wider rounded-full transition text-xs disabled:opacity-50"
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
            className="bg-[#14110d] border border-[#d9ac54]/25 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative animate-modal-in font-ui"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeRatingModal}
              className="absolute top-4 right-4 text-[#8f8574] hover:text-[#d9ac54] transition p-1"
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
              <h3 className="text-lg font-bold text-[#f2ead9] mb-1">
                {t("movie_how_was_it")}
              </h3>
              <p className="text-sm text-[#8f8574] mb-6">
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
                  className="flex-1 py-3 font-bold text-[#f2ead9] uppercase tracking-widest transition border border-white/[.15] hover:border-[#d9ac54]/45 rounded-full active:scale-[0.98] text-xs"
                >
                  {t("movie_rating_cancel")}
                </button>
                <button
                  onClick={handleModalConfirm}
                  className="flex-1 py-3 font-bold text-[#14110c] uppercase tracking-widest transition bg-[#d9ac54] hover:bg-[#e8c377] rounded-full active:scale-[0.98] text-xs"
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
        <div className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-6 sm:bottom-6 bg-[#14110d] border border-[#d9ac54]/50 text-[#d9ac54] px-4 py-3 rounded-full shadow-2xl flex items-center justify-center gap-2 z-50 uppercase tracking-widest font-bold animate-fade-in">
          <span className="text-[10px] text-center">{toastMessage}</span>
        </div>
      )}
    </div>
  );
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
  type: "watched" | "rated" | "added_watchlist" | "favorited" | "rewatched";
  tmdbId: number;
  title: string;
  posterUrl: string | null;
  mediaType: string;
  rating: number | null;
  createdAt: string;
  user: { id: number; username: string; avatarUrl: string | null };
}

function FriendsModal({ onClose }: FriendsModalProps) {
  const { t } = useLang();
  const [mode, setMode] = useState<"list" | "requests" | "search" | "feed">(
    "list",
  );
  const [friends, setFriends] = useState<Friend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [processingRequestId, setProcessingRequestId] = useState<
    number | null
  >(null);

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
    usersApi
      .getFriendRequests()
      .then(setRequests)
      .catch(() => {})
      .finally(() => setRequestsLoading(false));
  }, []);

  const handleAcceptRequest = async (id: number) => {
    setProcessingRequestId(id);
    try {
      await usersApi.acceptFriendRequest(id);
      setRequests((prev) => prev.filter((r) => r.id !== id));
      fetchFriends();
    } catch (error) {
      console.error(error);
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleDeclineRequest = async (id: number) => {
    setProcessingRequestId(id);
    try {
      await usersApi.declineFriendRequest(id);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (error) {
      console.error(error);
    } finally {
      setProcessingRequestId(null);
    }
  };

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
        className="w-full max-w-lg bg-[#14110d] border border-[#d9ac54]/25 rounded-[14px] shadow-2xl relative animate-modal-in font-ui overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-[rgba(217,172,84,.16)]">
          <span className="font-bold text-[15px] tracking-[3px] text-[#f2ead9]">
            {t("profile_friends").toUpperCase()}{" "}
            <span className="text-[#d9ac54]">· {friends.length}</span>
          </span>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-[#8f8574] hover:text-[#f2ead9] hover:bg-white/[.05] transition"
          >
            ✕
          </button>
        </div>

        <div className="flex items-center gap-1.5 px-6 pt-3.5">
          <button
            onClick={() => setMode("list")}
            className={`font-semibold text-[10.5px] tracking-[1.5px] uppercase rounded-full px-3 py-1.5 transition ${
              mode === "list"
                ? "bg-[#d9ac54] text-[#14110c]"
                : "border border-white/[.12] text-[#8f8574] hover:border-[#d9ac54]/45 hover:text-[#c9c0ac]"
            }`}
          >
            {t("profile_friends")}
          </button>
          <button
            onClick={() => setMode("requests")}
            className={`font-semibold text-[10.5px] tracking-[1.5px] uppercase rounded-full px-3 py-1.5 transition ${
              mode === "requests"
                ? "bg-[#d9ac54] text-[#14110c]"
                : "border border-white/[.12] text-[#8f8574] hover:border-[#d9ac54]/45 hover:text-[#c9c0ac]"
            }`}
          >
            {t("notif_friend_requests")}{" "}
            {requests.length > 0 && (
              <span
                className={mode === "requests" ? "" : "text-[#d9ac54]"}
              >
                {requests.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setMode("feed")}
            className={`font-semibold text-[10.5px] tracking-[1.5px] uppercase rounded-full px-3 py-1.5 transition ${
              mode === "feed"
                ? "bg-[#d9ac54] text-[#14110c]"
                : "border border-white/[.12] text-[#8f8574] hover:border-[#d9ac54]/45 hover:text-[#c9c0ac]"
            }`}
          >
            {t("profile_feed")}
          </button>
          <button
            onClick={() => setMode("search")}
            className={`ml-auto w-8 h-8 rounded-full flex items-center justify-center border transition ${
              mode === "search"
                ? "border-[#d9ac54] text-[#d9ac54]"
                : "border-white/[.12] text-[#8f8574] hover:border-[#d9ac54]/45 hover:text-[#d9ac54]"
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

        <div className="px-6 pt-3.5 pb-6">

        {mode === "feed" ? (
          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {feedLoading ? (
              <div className="text-center text-[#d9ac54] animate-pulse font-bold uppercase tracking-widest py-6 text-sm">
                {t("profile_loading")}
              </div>
            ) : feedItems.length === 0 ? (
              <div className="text-center text-[#f2ead9]/50 text-sm py-6 italic border border-[#d9ac54]/20 rounded-xl border-dashed">
                {t("profile_feed_empty")}
              </div>
            ) : (
              feedItems.map((item) => (
                <Link
                  key={item.id}
                  to={`/movie/${item.tmdbId}?type=${item.mediaType}`}
                  onClick={onClose}
                  className="flex items-center gap-3.5 py-3 border-b border-[rgba(217,172,84,.12)] last:border-b-0 hover:opacity-80 transition"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#d9ac54] to-[#a87c2e] flex items-center justify-center text-sm font-bold text-[#14110c] overflow-hidden shrink-0">
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
                    <p className="text-[13px] text-[#f2ead9] truncate">
                      <span className="font-semibold">{item.user.username}</span>{" "}
                      <span className="text-[#8f8574]">
                        {t(`feed_${item.type}`)}
                      </span>{" "}
                      <span className="font-semibold text-[#d9ac54]">
                        {item.title}
                      </span>
                      {(item.type === "rated" || item.type === "rewatched") &&
                        item.rating != null && (
                          <span className="text-[#8f8574]">
                            {" "}
                            ({item.rating}/10)
                          </span>
                        )}
                    </p>
                    <p className="font-mono-ui text-[10px] text-[#645c4d] uppercase tracking-wide mt-0.5">
                      {formatTimeAgo(item.createdAt, t)}
                    </p>
                  </div>
                  {item.posterUrl && (
                    <div className="w-9 h-12 rounded-md overflow-hidden shrink-0">
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
                  className="px-5 py-2 btn-glass btn-glass-dark text-[#d9ac54] font-black uppercase tracking-wider rounded-xl transition text-[10px] disabled:opacity-50"
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
              className="w-full px-4 py-2.5 mb-3 text-sm text-[#f2ead9] bg-white/[.03] border border-[#d9ac54]/30 rounded-full focus:outline-none focus:border-[#d9ac54] placeholder-[#8f8574]"
            />

            {searchLoading ? (
              <div className="text-center text-[#d9ac54] animate-pulse font-bold uppercase tracking-widest py-6 text-sm">
                {t("profile_loading")}
              </div>
            ) : searchQuery.trim().length < 2 ? (
              <div className="text-center text-[#f2ead9]/50 text-sm py-6 italic border border-[#d9ac54]/20 rounded-xl border-dashed">
                {t("profile_search_hint")}
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center text-[#f2ead9]/50 text-sm py-6 italic border border-[#d9ac54]/20 rounded-xl border-dashed">
                {t("profile_search_no_results")}
              </div>
            ) : (
              <div className="flex flex-col max-h-[45vh] overflow-y-auto pr-1">
                {searchResults.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-3.5 py-3.5 border-b border-[rgba(217,172,84,.12)] last:border-b-0"
                  >
                    <Link
                      to={`/user/${u.id}`}
                      onClick={onClose}
                      className="flex items-center gap-3.5 flex-1 min-w-0 hover:opacity-80 transition"
                    >
                      <div className="w-[38px] h-[38px] rounded-full bg-gradient-to-tr from-[#d9ac54] to-[#a87c2e] flex items-center justify-center text-sm font-bold text-[#14110c] overflow-hidden shrink-0">
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
                      <span className="font-semibold text-[13.5px] text-[#f2ead9] truncate">
                        {u.username}
                      </span>
                    </Link>
                    {u.isFriend ? (
                      <span className="shrink-0 font-semibold text-[10px] tracking-[1px] text-[#d9ac54] uppercase px-1">
                        ✓ {t("profile_friends")}
                      </span>
                    ) : u.requestPending ? (
                      <span className="shrink-0 font-semibold text-[10px] tracking-[1px] text-[#645c4d] uppercase px-1">
                        {t("profile_request_sent")}
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAddFriend(u.id)}
                        disabled={addingId === u.id}
                        className="shrink-0 font-semibold text-[10px] tracking-[1px] text-[#14110c] bg-[#d9ac54] hover:bg-[#e8c377] uppercase transition disabled:opacity-40 px-3 py-1.5 rounded-full"
                      >
                        {addingId === u.id ? "..." : t("profile_add_friend")}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : mode === "requests" ? (
          requestsLoading ? (
            <div className="text-center text-[#d9ac54] animate-pulse font-bold uppercase tracking-widest py-6 text-sm">
              {t("profile_loading")}
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center text-[#f2ead9]/50 text-sm py-6 italic border border-[#d9ac54]/20 rounded-xl border-dashed">
              {t("notif_empty")}
            </div>
          ) : (
            <div className="flex flex-col">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center gap-3.5 py-3.5 border-b border-[rgba(217,172,84,.12)] last:border-b-0"
                >
                  <div className="w-[38px] h-[38px] rounded-full bg-gradient-to-tr from-[#d9ac54] to-[#a87c2e] flex items-center justify-center text-sm font-bold text-[#14110c] overflow-hidden shrink-0">
                    {req.fromUser.avatarUrl ? (
                      <img
                        src={req.fromUser.avatarUrl}
                        className="w-full h-full object-cover"
                        alt={req.fromUser.username}
                      />
                    ) : (
                      req.fromUser.username[0].toUpperCase()
                    )}
                  </div>
                  <span className="flex-1 min-w-0 font-semibold text-[13.5px] text-[#f2ead9] truncate">
                    {req.fromUser.username}
                  </span>
                  <button
                    onClick={() => handleAcceptRequest(req.id)}
                    disabled={processingRequestId === req.id}
                    className="shrink-0 text-[10px] font-bold text-[#14110c] bg-[#d9ac54] hover:bg-[#e8c377] px-3 py-1.5 rounded-full transition disabled:opacity-40 active:scale-95"
                  >
                    ✓
                  </button>
                  <button
                    onClick={() => handleDeclineRequest(req.id)}
                    disabled={processingRequestId === req.id}
                    className="shrink-0 text-[13px] text-[#645c4d] hover:text-[#e0554d] transition disabled:opacity-40 active:scale-95"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )
        ) : isLoading ? (
          <div className="text-center text-[#d9ac54] animate-pulse font-bold uppercase tracking-widest py-6 text-sm">
            {t("profile_loading")}
          </div>
        ) : friends.length === 0 ? (
          <div className="text-center text-[#f2ead9]/50 text-sm py-6 italic border border-[#d9ac54]/20 rounded-xl border-dashed">
            {t("profile_no_friends")}
          </div>
        ) : (
          <div className="flex flex-col max-h-[50vh] overflow-y-auto pr-1">
            {friends.map((friend) => (
              <div
                key={friend.id}
                className="flex items-center gap-3.5 py-3.5 border-b border-[rgba(217,172,84,.12)] last:border-b-0"
              >
                <Link
                  to={`/user/${friend.id}`}
                  onClick={onClose}
                  className="flex items-center gap-3.5 flex-1 min-w-0 hover:opacity-80 transition"
                >
                  <div className="w-[38px] h-[38px] rounded-full bg-gradient-to-tr from-[#d9ac54] to-[#a87c2e] flex items-center justify-center text-sm font-bold text-[#14110c] overflow-hidden shrink-0">
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
                  <span className="font-semibold text-[13.5px] text-[#f2ead9] truncate">
                    {friend.username}
                  </span>
                </Link>
                <button
                  onClick={() => handleRemoveFriend(friend.id)}
                  disabled={removingId === friend.id}
                  className="shrink-0 text-[13px] text-[#645c4d] hover:text-[#e0554d] transition disabled:opacity-40 px-1"
                  title={t("profile_remove_friend")}
                >
                  {removingId === friend.id ? "..." : "✕"}
                </button>
              </div>
            ))}
          </div>
        )}

        {mode === "list" && (
          <button
            onClick={() => setMode("search")}
            className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-[#d9ac54]/35 hover:bg-[#d9ac54]/[.06] rounded-full transition"
          >
            <span className="font-semibold text-[11px] tracking-[1.5px] text-[#d9ac54] uppercase">
              {t("profile_add_friend")}
            </span>
          </button>
        )}
        </div>
      </div>
    </div>
  );
}

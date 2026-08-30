import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import * as usersApi from "../api/users.api";
import * as aiApi from "../api/ai.api";
import * as moviesApi from "../api/movies.api";
import { useLang } from "../context/LanguageContext";
import { getUserRank, getAchievementsList } from "../utils/achievements";
import ProfileHero from "../components/profile/ProfileHero";
import ProfileSection from "../components/profile/ProfileSection";
import ProfileStatsStrip from "../components/profile/ProfileStatsStrip";
import ProfileFavoritesPanel from "../components/profile/ProfileFavoritesPanel";
import ProfileWrappedPanel from "../components/profile/ProfileWrappedPanel";
import ProfileChartsPanel from "../components/profile/ProfileChartsPanel";
import LogoIcon from "../components/LogoIcon";
import type { MovieResult, WatchlistItem } from "../types/movie.types";

type PublicMovieRef = {
  id: number;
  tmdbId: number;
  title: string;
  posterUrl?: string | null;
  mediaType: string;
  isWatched?: boolean;
  rating?: number | null;
};

type PublicProfileData = {
  id: number;
  username: string;
  avatarUrl?: string | null;
  watchedCount?: number;
  totalCount?: number;
  totalFavorites?: number;
  favorites?: PublicMovieRef[];
  recent?: PublicMovieRef[];
  isFriend?: boolean;
  requestPending?: boolean;
  stats?: {
    genreDistribution?: Array<{ name: string; value: number }>;
    ratingDistribution?: Array<{ name: string; value: number }>;
    totalMinutes?: number;
    topGenre?: string;
    topRated?: PublicMovieRef[];
    averageRating?: string | number;
    moviesCount?: number;
    tvCount?: number;
    favoriteDecade?: string;
    completionRate?: number;
    longestMovie?: {
      title: string;
      runtime: number;
      tmdbId?: number;
      mediaType?: string;
    };
    topActor?: {
      id?: number;
      name: string;
      count: number;
      profileUrl: string | null;
    } | null;
  };
};

type TasteCompatibility = {
  score: number | null;
  commonWatchedCount: number;
  commonWatched: Array<{
    tmdbId: number;
    title: string;
    posterUrl?: string | null;
    mediaType: string;
  }>;
};

const PUBLIC_TAB_PAGE_SIZE = 30;

const isReleased = () => true;

function toWatchlistItem(
  m: PublicMovieRef,
  defaults: { isFavorite: boolean; isWatched: boolean },
): WatchlistItem {
  return {
    id: m.id,
    tmdbId: m.tmdbId,
    title: m.title,
    posterUrl: m.posterUrl,
    mediaType: m.mediaType,
    rating: m.rating,
    isFavorite: defaults.isFavorite,
    isWatched: m.isWatched ?? defaults.isWatched,
  };
}

export default function PublicProfile() {
  const { t } = useLang();
  const { id } = useParams<{ id: string }>();
  const [profileData, setProfileData] = useState<PublicProfileData | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"favorites" | "watched">(
    "favorites",
  );

  const [tabMovies, setTabMovies] = useState<WatchlistItem[]>([]);
  const [tabLoading, setTabLoading] = useState(true);
  const [tabLoadingMore, setTabLoadingMore] = useState(false);
  const [tabHasMore, setTabHasMore] = useState(false);

  const [compat, setCompat] = useState<TasteCompatibility | null>(null);
  const [isCompatModalOpen, setIsCompatModalOpen] = useState(false);
  const [watchTogetherResult, setWatchTogetherResult] = useState<{
    message?: string;
    movies?: MovieResult[];
  } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [addedIds, setAddedIds] = useState<number[]>([]);
  const [requestSent, setRequestSent] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    const fetchPublicProfile = async () => {
      try {
        const data = await usersApi.getPublicProfile(id as string);
        setProfileData(data);
      } catch (err: unknown) {
        const apiError = err as { response?: { status?: number } };
        if (apiError.response?.status === 401) {
          setNeedsAuth(true);
        } else {
          setError(true);
        }
      } finally {
        setIsLoading(false);
      }
    };
    if (id) fetchPublicProfile();
  }, [id]);

  useEffect(() => {
    if (!id || !profileData) return;
    setTabLoading(true);
    const fetcher =
      activeTab === "favorites"
        ? usersApi.getPublicFavorites
        : usersApi.getPublicWatched;
    fetcher(id, { limit: PUBLIC_TAB_PAGE_SIZE, offset: 0 })
      .then((data: WatchlistItem[]) => {
        setTabMovies(data || []);
        setTabHasMore((data?.length || 0) === PUBLIC_TAB_PAGE_SIZE);
      })
      .catch(() => {
        setTabMovies([]);
        setTabHasMore(false);
      })
      .finally(() => setTabLoading(false));
  }, [activeTab, id, profileData]);

  const loadMoreTabMovies = async () => {
    if (!id || tabLoadingMore || !tabHasMore) return;
    setTabLoadingMore(true);
    try {
      const fetcher =
        activeTab === "favorites"
          ? usersApi.getPublicFavorites
          : usersApi.getPublicWatched;
      const data: WatchlistItem[] = await fetcher(id, {
        limit: PUBLIC_TAB_PAGE_SIZE,
        offset: tabMovies.length,
      });
      setTabMovies((prev) => [...prev, ...(data || [])]);
      setTabHasMore((data?.length || 0) === PUBLIC_TAB_PAGE_SIZE);
    } catch (err) {
      console.error(err);
    } finally {
      setTabLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!id || !profileData?.isFriend) return;
    usersApi
      .getTasteCompatibility(id)
      .then(setCompat)
      .catch(() => setCompat(null));
  }, [id, profileData?.isFriend]);

  const handleGenerateWatchTogether = async () => {
    if (!id) return;
    setIsGenerating(true);
    try {
      const result = await aiApi.watchTogether(Number(id));
      setWatchTogetherResult(result);
    } catch (err: unknown) {
      const apiError = err as { response?: { status?: number } };
      showToast(
        apiError.response?.status === 429
          ? t("chat_daily_limit")
          : t("common_error"),
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddFromCompat = async (movie: MovieResult) => {
    try {
      await moviesApi.addToWatchlist({
        tmdbId: movie.id,
        title: movie.title,
        posterUrl: movie.posterUrl,
        mediaType: movie.mediaType,
        releaseDate: movie.releaseDate,
      });
      setAddedIds((prev) => [...prev, movie.id]);
      showToast(t("chat_added"));
    } catch (err: unknown) {
      const apiError = err as { response?: { status?: number } };
      if (apiError.response?.status === 400) {
        setAddedIds((prev) => [...prev, movie.id]);
        showToast(t("chat_added"));
      } else showToast(t("chat_add_error"));
    }
  };

  const handleAddFriend = async () => {
    try {
      const result = await usersApi.addFriend(id as string);
      if (result?.status === "accepted") {
        setProfileData((prev) => (prev ? { ...prev, isFriend: true } : prev));
        showToast(t("profile_friend_added"));
      } else {
        setRequestSent(true);
        showToast(t("profile_request_sent"));
      }
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { message?: string } } };
      showToast(apiError.response?.data?.message || t("common_error"));
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    const nav = navigator as Navigator & {
      share?: (data: { title?: string; url?: string }) => Promise<void>;
    };
    if (nav.share) {
      try {
        await nav.share({ title: profileData?.username, url });
      } catch {
        // user cancelled the native share sheet
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      showToast(t("profile_link_copied"));
    } catch {
      showToast(t("profile_link_copied"));
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-[#0f0d0a] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#14110d] border-t-[#d9ac54] rounded-full animate-spin" />
      </div>
    );
  }

  if (needsAuth) {
    return (
      <div className="min-h-[100dvh] bg-[#0f0d0a] flex flex-col items-center justify-center text-center p-4 font-ui">
        <h1 className="text-lg font-bold text-[#f2ead9] uppercase tracking-widest mb-2">
          {t("auth_required_title")}
        </h1>
        <p className="text-[#8f8574] mb-6 text-sm max-w-xs">
          {t("auth_required_message")}
        </p>
        <div className="flex flex-col gap-2.5 w-full max-w-xs">
          <Link
            to="/login"
            className="w-full py-2.5 rounded-xl font-ui font-semibold text-[12px] uppercase tracking-widest text-[#14110c] transition hover:opacity-90"
            style={{ background: "linear-gradient(90deg, #a87c2e, #d9ac54)" }}
          >
            {t("auth_required_login")}
          </Link>
          <Link
            to="/register"
            className="w-full py-2.5 rounded-xl font-ui font-semibold text-[12px] uppercase tracking-widest text-[#d9ac54] border border-[#d9ac54]/40 hover:bg-white/[.03] transition"
          >
            {t("auth_required_register")}
          </Link>
        </div>
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div className="min-h-[100dvh] bg-[#0f0d0a] flex flex-col items-center justify-center text-center p-4 font-ui">
        <h1 className="text-5xl font-bold text-[#d9ac54] mb-3">404</h1>
        <p className="text-[#8f8574] mb-6 text-base font-medium">
          {t("profile_not_found")}
        </p>
        <Link
          to="/search"
          className="px-6 py-3 bg-[#d9ac54] hover:bg-[#e8c377] text-[#14110c] font-bold uppercase tracking-widest rounded-full transition text-sm"
        >
          {t("profile_go_home")}
        </Link>
      </div>
    );
  }

  const watchedCount = profileData.watchedCount || 0;
  const favoritesCount =
    profileData.totalFavorites ?? profileData.favorites?.length ?? 0;
  const totalCount = profileData.totalCount || 0;
  const userRank = getUserRank(watchedCount, t);

  const hasStats = Boolean(
    profileData?.stats &&
      profileData.stats.genreDistribution &&
      profileData.stats.genreDistribution.length > 0,
  );

  const achievementsList = getAchievementsList(
    { favoritesCount, watchedCount, totalCount },
    t,
  );

  const favorites = (profileData.favorites || []).map((m) =>
    toWatchlistItem(m, { isFavorite: true, isWatched: true }),
  );
  const topRated = (profileData.stats?.topRated || []).map((m) =>
    toWatchlistItem(m, { isFavorite: false, isWatched: true }),
  );

  const friendActionSlot = (
    <>
      {profileData.isFriend ? (
        <div className="flex items-center justify-center gap-2 px-5 py-2.5 border border-[#d9ac54]/45 rounded-full font-ui font-semibold text-[11px] md:text-[12px] tracking-[1.5px] text-[#d9ac54] uppercase">
          ✓ {t("profile_friends")}
        </div>
      ) : requestSent || profileData.requestPending ? (
        <div className="flex items-center justify-center px-5 py-2.5 border border-white/[.15] rounded-full font-ui font-semibold text-[11px] md:text-[12px] tracking-[1.5px] text-[#8f8574] uppercase">
          {t("profile_request_sent")}
        </div>
      ) : (
        <button
          onClick={handleAddFriend}
          className="flex items-center justify-center px-5 py-2.5 bg-[#d9ac54] hover:bg-[#e8c377] rounded-full font-ui font-bold text-[11px] md:text-[12px] tracking-[1.5px] text-[#14110c] uppercase transition"
        >
          {t("profile_add_friend")}
        </button>
      )}
      <button
        onClick={handleShare}
        className="flex items-center justify-center px-5 py-2.5 border border-white/[.18] rounded-full font-ui font-semibold text-[11px] md:text-[12px] tracking-[1.5px] text-[#c9c0ac] uppercase transition hover:border-[#d9ac54]/45 hover:text-[#d9ac54]"
      >
        {t("profile_share")}
      </button>
    </>
  );

  return (
    <div className="min-h-[100dvh] bg-[#0f0d0a] font-ui text-[#f2ead9] relative overscroll-none selection:bg-[#d9ac54] selection:text-[#14110c]">
      <div className="sm:hidden sticky top-0 z-40 bg-[#0f0d0a]/95 backdrop-blur-md border-b border-[rgba(217,172,84,.16)] mb-6 pt-[env(safe-area-inset-top)]">
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
          <Link
            to="/watchlist"
            className="font-mono-ui text-[10px] font-semibold tracking-[1.5px] text-[#8f8574] hover:text-[#d9ac54] transition uppercase"
          >
            ‹ {t("watchlist_title")}
          </Link>
        </header>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-8 pb-24 sm:pb-12 sm:pt-9">
        <div className="hidden sm:flex justify-end mb-3">
          <Link
            to="/watchlist"
            className="font-mono-ui text-[10.5px] font-semibold tracking-[2px] text-[#8f8574] hover:text-[#d9ac54] transition uppercase"
          >
            ‹ {t("watchlist_title")}
          </Link>
        </div>

        <div className="mb-6">
          <ProfileHero
            username={profileData.username}
            avatarUrl={profileData.avatarUrl ?? null}
            rank={userRank}
            recent={[]}
            friendsCount={0}
            userId={profileData.id}
            onOpenFriends={() => {}}
            onShowToast={showToast}
            rightSlot={friendActionSlot}
          />
        </div>

        {profileData.isFriend && compat && compat.score !== null && (
          <ProfileSection>
            <button
              onClick={() => setIsCompatModalOpen(true)}
              className="w-full flex items-center justify-between gap-3 px-5 py-4 border border-[#d9ac54]/25 rounded-[10px] hover:border-[#d9ac54]/50 transition"
            >
              <div className="flex items-center gap-2.5">
                <svg
                  className="w-4 h-4 text-[#d9ac54]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
                <span className="font-mono-ui text-[10.5px] font-semibold tracking-[2px] text-[#8f8574] uppercase">
                  {t("compat_title")}
                </span>
              </div>
              <span className="text-lg font-bold text-[#d9ac54]">
                {Math.round(Math.max(0, Math.min(1, compat.score)) * 100)}%
              </span>
            </button>
          </ProfileSection>
        )}

        <ProfileSection>
          <ProfileStatsStrip
            stats={[
              { value: watchedCount, label: t("watchlist_watched") },
              {
                value: profileData?.stats?.averageRating || "0.0",
                label: t("stats_avg"),
              },
              { value: favoritesCount, label: t("watchlist_favorites") },
            ]}
            watchedCount={watchedCount}
            completionRate={profileData?.stats?.completionRate || 0}
            totalCount={totalCount}
          />
        </ProfileSection>

        <ProfileSection noBorder={!hasStats}>
          <ProfileFavoritesPanel
            favorites={favorites}
            achievements={achievementsList}
            friends={[]}
            friendsCount={0}
            isReleased={isReleased}
            onToggleFavorite={() => {}}
            onOpenFriends={() => {}}
            onViewAllFavorites={() => setActiveTab("favorites")}
            showFriends={false}
            readOnly
          />
        </ProfileSection>

        {hasStats && profileData?.stats && (
          <ProfileSection>
            <ProfileWrappedPanel
              username={profileData.username}
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
              topRated={topRated}
            />
          </ProfileSection>
        )}

        <div className="pt-8">
          <div className="flex items-center gap-1 mb-6 border-b border-[rgba(217,172,84,.16)]">
            {(["favorites", "watched"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative px-4 py-3 font-ui font-semibold text-[11.5px] uppercase tracking-[2px] transition-colors ${
                  activeTab === tab
                    ? "text-[#d9ac54]"
                    : "text-[#8f8574] hover:text-[#c9c0ac]"
                }`}
              >
                {tab === "favorites"
                  ? t("watchlist_favorites")
                  : t("watchlist_watched")}
                {activeTab === tab && (
                  <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-[#d9ac54]" />
                )}
              </button>
            ))}
          </div>

          {tabLoading ? (
            <p className="text-center text-[#8f8574] animate-pulse text-sm mt-4 font-semibold uppercase tracking-widest">
              {t("watchlist_loading")}
            </p>
          ) : tabMovies.length > 0 ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-[18px] gap-y-[26px]">
                {tabMovies.map((movie) => (
                  <Link
                    to={`/movie/${movie.tmdbId}?type=${movie.mediaType || "movie"}`}
                    key={movie.id}
                    className="group flex flex-col gap-[9px]"
                  >
                    <div className="relative w-full aspect-[2/3] rounded-[6px] overflow-hidden bg-[#0f0d0a]">
                      {movie.posterUrl ? (
                        <img
                          src={movie.posterUrl}
                          alt={movie.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex items-center justify-center w-full h-full text-[9px] text-[#f2ead9]/30">
                          {t("common_na")}
                        </div>
                      )}
                      {(movie.rating ?? 0) > 0 && (
                        <div className="absolute top-1.5 right-1.5 bg-[rgba(15,13,10,.75)] px-1.5 py-0.5 rounded-md text-[#d9ac54] text-[10px] font-mono-ui font-bold">
                          ★ {movie.rating}
                        </div>
                      )}
                    </div>
                    <span className="text-[13px] font-semibold text-[#f2ead9] truncate group-hover:text-[#d9ac54] transition">
                      {movie.title}
                    </span>
                  </Link>
                ))}
              </div>
              {tabHasMore && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={loadMoreTabMovies}
                    disabled={tabLoadingMore}
                    className="px-6 py-2.5 border border-[#d9ac54]/40 hover:border-[#d9ac54] text-[#d9ac54] font-bold uppercase tracking-wider rounded-full transition text-xs disabled:opacity-50"
                  >
                    {tabLoadingMore
                      ? t("common_loading_more")
                      : t("common_load_more")}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 border border-[rgba(217,172,84,.2)] border-dashed rounded-[10px]">
              <p className="text-[#8f8574] text-sm italic">
                {t("watchlist_empty")}
              </p>
            </div>
          )}
        </div>
      </div>

      {isCompatModalOpen && compat && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setIsCompatModalOpen(false)}
        >
          <div
            className="w-full max-w-md max-h-[85vh] overflow-y-auto p-5 bg-[#14110d] border border-[#d9ac54]/25 rounded-2xl shadow-2xl relative animate-modal-in font-ui"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsCompatModalOpen(false)}
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

            <h2 className="text-lg font-bold text-[#f2ead9] uppercase tracking-widest text-center mb-1">
              {t("compat_title")}
            </h2>
            <p className="text-center text-4xl font-bold text-[#d9ac54] mb-4">
              {compat.score !== null
                ? `${Math.round(Math.max(0, Math.min(1, compat.score)) * 100)}%`
                : "—"}
            </p>

            <div className="border border-[#d9ac54]/20 rounded-xl p-3 mb-4">
              <p className="font-mono-ui text-[9px] font-semibold tracking-[1.5px] text-[#8f8574] uppercase mb-2">
                {t("compat_common_watched").replace(
                  "{count}",
                  String(compat.commonWatchedCount),
                )}
              </p>
              {compat.commonWatched.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {compat.commonWatched.map((m) => (
                    <div
                      key={m.tmdbId}
                      className="w-12 aspect-[2/3] rounded-md overflow-hidden shrink-0 bg-[#0f0d0a]"
                      title={m.title}
                    >
                      {m.posterUrl ? (
                        <img
                          src={m.posterUrl}
                          alt={m.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[7px] text-[#f2ead9]/30 p-1 text-center">
                          {m.title}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!watchTogetherResult ? (
              <button
                onClick={handleGenerateWatchTogether}
                disabled={isGenerating}
                className="w-full py-3 bg-[#d9ac54] hover:bg-[#e8c377] text-[#14110c] font-bold uppercase tracking-widest rounded-full transition active:scale-95 disabled:opacity-50 text-xs"
              >
                {isGenerating ? t("compat_generating") : t("compat_generate")}
              </button>
            ) : (
              <div>
                {watchTogetherResult.message && (
                  <p className="text-sm text-[#f2ead9] mb-3">
                    {watchTogetherResult.message}
                  </p>
                )}
                <div className="space-y-2">
                  {(watchTogetherResult.movies || []).map((movie) => (
                    <div
                      key={movie.id}
                      className="flex items-center gap-2.5 p-2 rounded-xl border border-[#d9ac54]/20"
                    >
                      <Link
                        to={`/movie/${movie.id}?type=${movie.mediaType}`}
                        className="flex items-center gap-2.5 flex-1 min-w-0"
                      >
                        <div className="w-9 h-12 bg-[#0f0d0a] rounded-md overflow-hidden shrink-0">
                          {movie.posterUrl ? (
                            <img
                              src={movie.posterUrl}
                              alt={movie.title}
                              className="w-full h-full object-cover"
                            />
                          ) : null}
                        </div>
                        <span className="font-semibold text-[#f2ead9] text-xs truncate">
                          {movie.title}
                        </span>
                      </Link>
                      {addedIds.includes(movie.id) ? (
                        <span className="shrink-0 text-[9px] text-[#d9ac54] px-2 font-bold">
                          ✓
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAddFromCompat(movie)}
                          className="shrink-0 text-[9px] border border-[#d9ac54]/40 text-[#d9ac54] px-2.5 py-1 rounded-full font-bold transition active:scale-95 hover:bg-[#d9ac54]/10"
                        >
                          {t("chat_add_btn")}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleGenerateWatchTogether}
                  disabled={isGenerating}
                  className="w-full mt-3 py-2.5 border border-[#d9ac54]/40 hover:border-[#d9ac54] text-[#d9ac54] font-bold uppercase tracking-widest rounded-full transition active:scale-95 disabled:opacity-50 text-[10px]"
                >
                  {isGenerating ? t("compat_generating") : t("compat_regenerate")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:right-6 bg-[#14110d] border border-[#d9ac54]/50 text-[#d9ac54] px-4 py-3 rounded-full font-bold uppercase tracking-widest text-[10px] z-50 shadow-2xl text-center animate-fade-in">
          {toastMessage}
        </div>
      )}
    </div>
  );
}

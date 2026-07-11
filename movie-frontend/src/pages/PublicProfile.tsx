import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
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
import * as usersApi from "../api/users.api";
import * as aiApi from "../api/ai.api";
import * as moviesApi from "../api/movies.api";
import LogoImg from "../assets/logo.png";
import { useLang } from "../context/LanguageContext";
import { getUserRank, getAchievementsList } from "../utils/achievements";
import AchievementTooltip from "../components/AchievementTooltip";
import type { MovieResult } from "../types/movie.types";

type PublicProfileData = {
  id: number;
  username: string;
  avatarUrl?: string | null;
  watchedCount?: number;
  totalCount?: number;
  favorites?: Array<{
    id: number;
    tmdbId: number;
    title: string;
    posterUrl?: string | null;
    mediaType: string;
    isWatched?: boolean;
    rating?: number | null;
  }>;
  recent?: Array<{
    id: number;
    tmdbId: number;
    title: string;
    posterUrl?: string | null;
    mediaType: string;
    isWatched?: boolean;
    rating?: number | null;
  }>;
  isFriend?: boolean;
  stats?: {
    genreDistribution?: Array<{ name: string; value: number }>;
    ratingDistribution?: Array<{ name: string; value: number }>;
    totalMinutes?: number;
    topGenre?: string;
    topRated?: Array<{
      id: number;
      tmdbId: number;
      title: string;
      posterUrl?: string | null;
      mediaType: string;
      rating?: number;
    }>;
    averageRating?: string | number;
    moviesCount?: number;
    tvCount?: number;
    favoriteDecade?: string;
    completionRate?: number;
    longestMovie?: { title: string; runtime: number };
    topActor?: {
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

const CHART_COLORS = ["#c8963c", "#9a732a", "#e8c070", "#5c4519", "#3a2b0f"];

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
      <div className="bg-[#1a1714] border border-[#c8963c]/50 p-2 rounded-xl shadow-xl z-50">
        <p className="text-[#f0e6cc] font-bold text-[10px] uppercase tracking-widest whitespace-nowrap">
          {payload[0].name}:{" "}
          <span className="text-[#c8963c]">{payload[0].value}</span>
        </p>
      </div>
    );
  }
  return null;
};

type LangT = ReturnType<typeof useLang>["t"];

interface RatingTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: { name: string }; value: number }>;
  t: LangT;
}

const RatingTooltip = ({ active, payload, t }: RatingTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a1714] border border-[#c8963c]/50 px-2 py-1.5 rounded-xl shadow-xl z-50 flex items-center gap-1.5">
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

export default function PublicProfile() {
  const { t } = useLang();
  const { id } = useParams<{ id: string }>();
  const [profileData, setProfileData] = useState<PublicProfileData | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"favorites" | "watched">(
    "favorites",
  );

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
        const data = await (
          await import("../api/users.api")
        ).getPublicProfile(id as string);
        setProfileData(data);
      } catch {
        setError(true);
      } finally {
        setIsLoading(false);
      }
    };
    if (id) fetchPublicProfile();
  }, [id]);

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
    } catch {
      showToast(t("common_error"));
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

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-[#12100e] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#1a1714] border-t-[#c8963c] rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div className="min-h-[100dvh] bg-[#12100e] flex flex-col items-center justify-center text-center p-4">
        <h1 className="text-5xl font-black text-[#c8963c] mb-3">404</h1>
        <p className="text-[#f0e6cc]/60 mb-6 text-base font-medium">
          {t("profile_not_found")}
        </p>
        <Link
          to="/search"
          className="px-6 py-3 bg-[#c8963c] text-[#12100e] font-black uppercase tracking-widest rounded-xl hover:bg-[#e8c070] transition shadow text-sm"
        >
          {t("profile_go_home")}
        </Link>
      </div>
    );
  }

  const watchedCount = profileData.watchedCount || 0;
  const favoritesCount = profileData.favorites?.length || 0;
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

  const displayedMovies =
    activeTab === "favorites"
      ? profileData?.favorites || []
      : profileData?.recent?.filter((m) => m.isWatched) || [];

  return (
    <div className="min-h-[100dvh] bg-[#12100e] font-sans text-[#f0e6cc] selection:bg-[#c8963c] selection:text-[#12100e]">
      <div className="sticky top-0 z-40 bg-[#12100e]/95 backdrop-blur-md border-b border-[#c8963c]/10 pt-[env(safe-area-inset-top)]">
        <header className="flex justify-between items-center px-4 sm:px-8 py-4 w-full">
          <Link
            to="/search"
            className="flex items-center gap-3 sm:gap-4 hover:opacity-80 transition-opacity shrink-0"
          >
            <img
              src={LogoImg}
              alt="LUMEN™ Logo"
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
          <Link
            to="/watchlist"
            className="text-[10px] sm:text-sm font-bold text-[#f0e6cc]/50 hover:text-[#c8963c] uppercase tracking-widest transition flex items-center gap-1.5 shrink-0"
          >
            <svg
              className="w-3 h-3 sm:w-4 sm:h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            {t("watchlist_title")}
          </Link>
        </header>
      </div>

      <div className="px-3 py-6 space-y-4 max-w-3xl mx-auto">
        <div className="p-4 bg-[#1a1714] rounded-2xl border border-[#c8963c]/20 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#c8963c] to-[#9a732a]" />

          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-[#12100e] border-2 border-[#c8963c]/50 rounded-full flex items-center justify-center text-2xl font-black text-[#c8963c] shrink-0 overflow-hidden">
              {profileData.avatarUrl ? (
                <img
                  src={profileData.avatarUrl}
                  alt={profileData.username}
                  className="w-full h-full object-cover"
                />
              ) : (
                profileData.username.charAt(0)
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-black text-[#f0e6cc] tracking-tight truncate">
                {profileData.username}
              </h2>
              <p className="text-[10px] text-[#c8963c] font-bold uppercase tracking-[0.15em]">
                {userRank}
              </p>
            </div>
            <div className="shrink-0">
              {profileData.isFriend ? (
                <div className="px-3 py-1.5 bg-[#c8963c]/10 text-[#c8963c] rounded-full font-black uppercase text-[9px] flex items-center gap-1 border border-[#c8963c]/30">
                  <span>✓</span> {t("profile_friends")}
                </div>
              ) : requestSent ? (
                <div className="px-3 py-1.5 bg-[#f0e6cc]/5 text-[#f0e6cc]/40 rounded-full font-black uppercase text-[9px] border border-[#f0e6cc]/10">
                  {t("profile_request_sent")}
                </div>
              ) : (
                <button
                  onClick={handleAddFriend}
                  className="px-3 py-1.5 bg-[#c8963c] text-[#12100e] rounded-full font-black uppercase text-[9px] hover:bg-[#e8c070] transition shadow active:scale-95"
                >
                  {t("profile_add_friend")}
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-4">
            {achievementsList.map((ach) => (
              <AchievementTooltip key={ach.id} achievement={ach} />
            ))}
          </div>

          {profileData.isFriend && compat && compat.score !== null && (
            <button
              onClick={() => setIsCompatModalOpen(true)}
              className="w-full flex items-center justify-between gap-3 p-3 mb-4 bg-[#12100e] border border-[#c8963c]/30 rounded-xl hover:border-[#c8963c]/60 transition"
            >
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-[#c8963c]"
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
                <span className="text-[10px] font-black uppercase tracking-widest text-[#f0e6cc]/70">
                  {t("compat_title")}
                </span>
              </div>
              <span className="text-lg font-black text-[#c8963c]">
                {Math.round(Math.max(0, Math.min(1, compat.score)) * 100)}%
              </span>
            </button>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2 border-t border-[#c8963c]/10 pt-3">
            <div>
              <div className="text-xl font-black text-[#c8963c]">
                {favoritesCount}
              </div>
              <div className="text-[9px] text-[#f0e6cc]/40 uppercase font-bold tracking-widest">
                {t("watchlist_favorites")}
              </div>
            </div>
            <div className="border-l border-[#c8963c]/10 pl-3">
              <div className="text-xl font-black text-[#c8963c]">
                {watchedCount}
              </div>
              <div className="text-[9px] text-[#f0e6cc]/40 uppercase font-bold tracking-widest">
                {t("watchlist_watched")}
              </div>
            </div>
          </div>
        </div>

        {/* Completion Rate */}
        {hasStats && (
          <div className="bg-[#1a1714] border border-[#c8963c]/10 rounded-xl p-3">
            <div className="flex justify-between items-center mb-1.5 px-0.5">
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
                style={{ width: `${profileData?.stats?.completionRate || 0}%` }}
              />
            </div>
          </div>
        )}

        {/* Movie Wrapped */}
        {hasStats && (
          <div className="p-4 bg-[#1a1714] rounded-2xl border border-[#c8963c]/20 shadow-xl">
            <h3 className="text-[10px] font-black text-[#c8963c] uppercase tracking-[0.25em] mb-4 flex items-center gap-2">
              <span className="w-6 h-[1px] bg-[#c8963c]/30" />{" "}
              {t("stats_wrapped").replace("[username]", profileData.username)}
            </h3>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-[#12100e] border border-[#c8963c]/10 p-3 rounded-xl">
                <p className="text-[8px] text-[#f0e6cc]/40 uppercase font-black mb-1">
                  {t("stats_time_spent")}
                </p>
                <p className="text-base font-black text-[#f0e6cc]">
                  {Math.floor((profileData?.stats?.totalMinutes || 0) / 60)}h{" "}
                  {(profileData?.stats?.totalMinutes || 0) % 60}m
                </p>
              </div>
              <div className="bg-[#12100e] border border-[#c8963c]/10 p-3 rounded-xl">
                <p className="text-[8px] text-[#f0e6cc]/40 uppercase font-black mb-1">
                  {t("stats_top_genre")}
                </p>
                <p className="text-base font-black text-[#c8963c] truncate">
                  {profileData?.stats?.topGenre || t("common_na")}
                </p>
              </div>
              <div className="bg-[#12100e] border border-[#c8963c]/10 p-3 rounded-xl">
                <p className="text-[8px] text-[#f0e6cc]/40 uppercase font-black mb-1">
                  {t("stats_avg")}
                </p>
                <p className="text-base font-black text-[#f0e6cc]">
                  {profileData?.stats?.averageRating || "0.0"}
                </p>
              </div>
              <div className="bg-[#12100e] border border-[#c8963c]/10 p-3 rounded-xl">
                <p className="text-[8px] text-[#f0e6cc]/40 uppercase font-black mb-1">
                  {t("stats_fav_decade")}
                </p>
                <p className="text-base font-black text-[#f0e6cc]">
                  {profileData?.stats?.favoriteDecade || t("common_na")}
                </p>
              </div>
            </div>

            {/* Longest Marathon */}
            {(profileData?.stats?.longestMovie?.runtime ?? 0) > 0 && (
              <div className="bg-[#12100e] border border-[#c8963c]/10 p-3 rounded-xl mb-2 flex items-center gap-3">
                <svg
                  className="w-5 h-5 text-[#c8963c] shrink-0"
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
                  <p className="text-[8px] text-[#f0e6cc]/40 uppercase font-black">
                    {t("stats_marathon")}
                  </p>
                  <p className="text-xs font-bold text-[#c8963c] truncate">
                    {profileData?.stats?.longestMovie?.title}
                  </p>
                  <p className="text-[9px] text-[#f0e6cc]/60">
                    {profileData?.stats?.longestMovie?.runtime} {t("stats_min")}
                  </p>
                </div>
              </div>
            )}

            {/* Top Actor */}
            {profileData.stats?.topActor && (
              <div className="bg-[#12100e] border border-[#c8963c]/10 p-3 rounded-xl mb-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 border border-[#c8963c]/30">
                  {profileData?.stats?.topActor?.profileUrl ? (
                    <img
                      src={profileData?.stats?.topActor?.profileUrl}
                      alt="Actor"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#1a1714] flex items-center justify-center text-[#c8963c]/60">
                      <svg
                        className="w-4 h-4"
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
                  <p className="text-[8px] text-[#f0e6cc]/40 uppercase font-black">
                    {t("stats_actor")}
                  </p>
                  <p className="text-xs font-bold text-[#c8963c] truncate">
                    {profileData?.stats?.topActor?.name}
                  </p>
                  <p className="text-[9px] text-[#f0e6cc]/60">
                    {t("stats_actor_count").replace(
                      "[X]",
                      (profileData?.stats?.topActor?.count ?? 0).toString(),
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

                  <div className="relative z-10 w-full h-full">
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
                          wrapperStyle={{ zIndex: 9999 }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {profileData?.stats?.ratingDistribution && (
                <div className="bg-[#12100e] border border-[#c8963c]/20 rounded-xl p-3 h-[180px] flex flex-col">
                  <div className="flex justify-between items-center mb-1">
                    <p className="text-[8px] text-[#f0e6cc]/50 uppercase font-bold">
                      {t("stats_rating")}
                    </p>
                    <p className="text-[10px] font-black text-[#c8963c]">
                      {t("stats_avg")} {profileData?.stats?.averageRating}
                    </p>
                  </div>
                  <div className="flex-grow w-full -ml-3">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={profileData?.stats?.ratingDistribution}
                        margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
                      >
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#f0e6cc", opacity: 0.3, fontSize: 9 }}
                        />
                        <Tooltip
                          content={<RatingTooltip t={t} />}
                          cursor={{ fill: "#c8963c", opacity: 0.05 }}
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
            {(profileData?.stats?.topRated?.length ?? 0) > 0 && (
              <div className="mt-5 pt-4 border-t border-[#c8963c]/10">
                <h4 className="text-[9px] text-[#c8963c] font-black uppercase tracking-[0.3em] mb-3 text-center">
                  {t("stats_top3")}
                </h4>
                <div className="flex flex-col gap-2">
                  {profileData?.stats?.topRated?.map((item, index: number) => (
                    <Link
                      to={`/movie/${item.tmdbId}?type=${item.mediaType}`}
                      key={item.id}
                      className="relative group bg-[#12100e] border border-[#c8963c]/10 rounded-xl p-2.5 flex items-center gap-3 hover:border-[#c8963c]/40 transition"
                    >
                      <div className="absolute -top-1.5 -left-1.5 w-5 h-5 bg-[#c8963c] text-[#12100e] rounded-full flex items-center justify-center font-black text-[8px] z-10">
                        #{index + 1}
                      </div>
                      <div className="w-8 h-11 shrink-0 rounded-md overflow-hidden border border-[#c8963c]/10 bg-[#1a1714]">
                        {item.posterUrl ? (
                          <img
                            src={item.posterUrl}
                            alt=""
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                          />
                        ) : (
                          <div className="w-full h-full bg-[#1a1714]" />
                        )}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <h5 className="text-[#f0e6cc] font-bold text-[11px] truncate group-hover:text-[#c8963c] transition-colors">
                          {item.title}
                        </h5>
                        <p className="text-[#c8963c] text-[10px] font-black mt-0.5">
                          ★ {item.rating}/10
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex justify-center pt-2">
          <div className="flex bg-[#1a1714] rounded-full p-1 border border-[#c8963c]/20 shadow-xl">
            <button
              onClick={() => setActiveTab("favorites")}
              className={`px-5 py-2 rounded-full font-black text-[10px] uppercase tracking-widest transition ${
                activeTab === "favorites"
                  ? "bg-[#c8963c] text-[#12100e] shadow"
                  : "text-[#f0e6cc]/40 hover:text-[#c8963c]"
              }`}
            >
              {t("watchlist_favorites")}
            </button>
            <button
              onClick={() => setActiveTab("watched")}
              className={`px-5 py-2 rounded-full font-black text-[10px] uppercase tracking-widest transition ${
                activeTab === "watched"
                  ? "bg-[#c8963c] text-[#12100e] shadow"
                  : "text-[#f0e6cc]/40 hover:text-[#c8963c]"
              }`}
            >
              {t("watchlist_watched")}
            </button>
          </div>
        </div>

        {/* Movie grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2.5 pb-8">
          {displayedMovies?.length > 0 ? (
            displayedMovies.map((movie) => (
              <Link
                to={`/movie/${movie.tmdbId}?type=${movie.mediaType || "movie"}`}
                key={movie.id}
                className="group flex flex-col bg-[#1a1714] border border-[#c8963c]/10 rounded-xl overflow-hidden hover:border-[#c8963c]/50 transition duration-300 shadow relative"
              >
                <div className="aspect-[2/3] relative overflow-hidden bg-[#12100e]">
                  {movie.posterUrl ? (
                    <img
                      src={movie.posterUrl}
                      alt={movie.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full text-[8px] text-[#f0e6cc]/20 uppercase font-black">
                      {t("common_na")}
                    </div>
                  )}
                  {(movie.rating ?? 0) > 0 && (
                    <div className="absolute top-1 right-1 bg-[#12100e]/90 backdrop-blur-md px-1.5 py-0.5 rounded-md border border-[#c8963c]/30 text-[#c8963c] text-[8px] font-black">
                      ★ {movie.rating}
                    </div>
                  )}
                </div>
                <div className="p-1.5">
                  <h4 className="text-[9px] font-bold text-[#f0e6cc] truncate group-hover:text-[#c8963c] transition uppercase tracking-tight">
                    {movie.title}
                  </h4>
                </div>
              </Link>
            ))
          ) : (
            <div className="col-span-full py-12 text-center bg-[#1a1714] rounded-2xl border border-[#c8963c]/10 border-dashed">
              <p className="text-[#f0e6cc]/30 uppercase tracking-widest font-black text-xs italic">
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
            className="w-full max-w-md max-h-[85vh] overflow-y-auto p-5 bg-[#1a1714] border border-[#c8963c]/30 rounded-3xl shadow-2xl relative animate-modal-in"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsCompatModalOpen(false)}
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

            <h2 className="text-lg font-black text-[#f0e6cc] uppercase tracking-widest text-center mb-1">
              {t("compat_title")}
            </h2>
            <p className="text-center text-4xl font-black text-[#c8963c] mb-4">
              {compat.score !== null
                ? `${Math.round(Math.max(0, Math.min(1, compat.score)) * 100)}%`
                : "—"}
            </p>

            <div className="bg-[#12100e] border border-[#c8963c]/20 rounded-xl p-3 mb-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-[#f0e6cc]/50 mb-2">
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
                      className="w-12 aspect-[2/3] rounded-lg overflow-hidden shrink-0 border border-[#c8963c]/20 bg-[#1a1714]"
                      title={m.title}
                    >
                      {m.posterUrl ? (
                        <img
                          src={m.posterUrl}
                          alt={m.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[7px] text-[#f0e6cc]/30 p-1 text-center">
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
                className="w-full py-3 bg-[#c8963c] text-[#12100e] font-black uppercase tracking-widest rounded-xl hover:bg-[#e8c070] transition active:scale-95 disabled:opacity-50 text-xs"
              >
                {isGenerating ? t("compat_generating") : t("compat_generate")}
              </button>
            ) : (
              <div>
                {watchTogetherResult.message && (
                  <p className="text-sm text-[#f0e6cc] mb-3">
                    {watchTogetherResult.message}
                  </p>
                )}
                <div className="space-y-2">
                  {(watchTogetherResult.movies || []).map((movie) => (
                    <div
                      key={movie.id}
                      className="flex items-center gap-2.5 bg-[#12100e] p-2 rounded-xl border border-[#c8963c]/20"
                    >
                      <Link
                        to={`/movie/${movie.id}?type=${movie.mediaType}`}
                        className="flex items-center gap-2.5 flex-1 min-w-0"
                      >
                        <div className="w-9 h-12 bg-[#1a1714] rounded-md overflow-hidden shrink-0 border border-[#c8963c]/20">
                          {movie.posterUrl ? (
                            <img
                              src={movie.posterUrl}
                              alt={movie.title}
                              className="w-full h-full object-cover"
                            />
                          ) : null}
                        </div>
                        <span className="font-bold text-[#f0e6cc] text-xs truncate">
                          {movie.title}
                        </span>
                      </Link>
                      {addedIds.includes(movie.id) ? (
                        <span className="shrink-0 text-[9px] text-[#c8963c] px-2 font-bold">
                          ✓
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAddFromCompat(movie)}
                          className="shrink-0 text-[9px] border border-[#c8963c]/50 text-[#c8963c] px-2.5 py-1 rounded-lg font-bold hover:bg-[#c8963c] hover:text-[#12100e] transition active:scale-95"
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
                  className="w-full mt-3 py-2.5 bg-[#12100e] border border-[#c8963c]/30 text-[#c8963c] font-black uppercase tracking-widest rounded-xl hover:border-[#c8963c]/60 transition active:scale-95 disabled:opacity-50 text-[10px]"
                >
                  {isGenerating ? t("compat_generating") : t("compat_regenerate")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:right-6 bg-[#1a1714] border border-[#c8963c]/50 text-[#c8963c] px-4 py-3 rounded-xl font-bold uppercase tracking-widest text-[10px] z-50 shadow-2xl text-center animate-fade-in">
          {toastMessage}
        </div>
      )}
    </div>
  );
}

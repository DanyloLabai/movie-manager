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
import { api } from "../api";

const CHART_COLORS = ["#c8963c", "#9a732a", "#e8c070", "#5c4519", "#3a2b0f"];

const getUserRank = (watchedCount: number) => {
  if (watchedCount >= 100) return "Film Legend";
  if (watchedCount >= 50) return "Cinema Curator";
  if (watchedCount >= 20) return "Cinephile";
  if (watchedCount >= 5) return "Movie Enthusiast";
  return "Cinema Guest";
};

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#1a1714] border border-[#c8963c]/50 p-3 rounded-xl shadow-xl z-50">
        <p className="text-[#f0e6cc] font-bold text-xs uppercase tracking-widest">
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
      <div className="bg-[#1a1714] border border-[#c8963c]/50 px-3 py-2 rounded-xl shadow-xl z-50 flex items-center gap-2">
        <span className="text-[#c8963c] font-black text-sm">
          ★ {payload[0].payload.name}
        </span>
        <span className="text-[#f0e6cc]/50">|</span>
        <span className="text-[#f0e6cc] font-bold text-xs">
          {payload[0].value} movies
        </span>
      </div>
    );
  }
  return null;
};

export default function PublicProfile() {
  const { id } = useParams<{ id: string }>();
  const [profileData, setProfileData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"favorites" | "watched">(
    "favorites",
  );

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    const fetchPublicProfile = async () => {
      try {
        const response = await api.get(`/users/public/${id}`);
        setProfileData(response.data);
      } catch {
        setError(true);
      } finally {
        setIsLoading(false);
      }
    };
    if (id) fetchPublicProfile();
  }, [id]);

  const handleAddFriend = async () => {
    try {
      await api.post(`/users/friends/${id}`);
      setProfileData((prev: any) => ({ ...prev, isFriend: true }));
      showToast("Added to friends!");
    } catch (err: any) {
      showToast(err.response?.data?.message || "Error adding friend.");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-[#12100e] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#1a1714] border-t-[#c8963c] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error || !profileData) {
    return (
      <div className="min-h-[100dvh] bg-[#12100e] flex flex-col items-center justify-center text-center p-4">
        <h1 className="text-6xl font-black text-[#c8963c] mb-4">404</h1>
        <p className="text-[#f0e6cc]/60 mb-8 text-lg font-medium">
          Profile not found.
        </p>
        <Link
          to="/search"
          className="px-8 py-4 bg-[#c8963c] text-[#12100e] font-black uppercase tracking-widest rounded-xl hover:bg-[#e8c070] transition shadow-lg"
        >
          Return Home
        </Link>
      </div>
    );
  }

  const watchedCount = profileData.watchedCount || 0;
  const favoritesCount = profileData.favorites?.length || 0;
  const totalCount = profileData.totalCount || 0;
  const userRank = getUserRank(watchedCount);

  const hasStats = Boolean(
    profileData.stats &&
    profileData.stats.genreDistribution &&
    profileData.stats.genreDistribution.length > 0,
  );

  const achievementsList = [
    { id: "fb", isUnlocked: totalCount > 0, text: "🏆 First Blood" },
    { id: "crit", isUnlocked: favoritesCount >= 5, text: "⭐ Critic" },
    { id: "cine", isUnlocked: watchedCount >= 10, text: "🍿 Cinephile" },
    { id: "coll", isUnlocked: totalCount >= 20, text: "📚 Collector" },
    { id: "taste", isUnlocked: favoritesCount >= 20, text: "💖 Tastemaker" },
    { id: "buff", isUnlocked: watchedCount >= 50, text: "🎬 Film Buff" },
    { id: "lib", isUnlocked: totalCount >= 100, text: "🏛️ Librarian" },
  ];

  const displayedMovies =
    activeTab === "favorites"
      ? profileData.favorites
      : profileData.recent?.filter((m: any) => m.isWatched) || [];

  return (
    <div className="min-h-[100dvh] p-3 sm:p-8 bg-[#12100e] font-sans text-[#f0e6cc] selection:bg-[#c8963c] selection:text-[#12100e]">
      <div className="max-w-5xl mx-auto space-y-8 animate-fade-in">
        <header className="flex justify-between items-center mb-6">
          <Link
            to="/search"
            className="text-xl sm:text-2xl font-black text-[#c8963c] tracking-widest uppercase drop-shadow-md"
          >
            Movie Tracker
          </Link>
          <Link
            to="/watchlist"
            className="text-[10px] sm:text-xs font-bold text-[#f0e6cc]/50 hover:text-[#c8963c] uppercase tracking-widest transition-colors"
          >
            ← My Profile
          </Link>
        </header>

        <div className="flex flex-col p-6 sm:p-8 bg-[#1a1714] rounded-3xl border border-[#c8963c]/20 shadow-xl relative overflow-hidden h-fit">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#c8963c] to-[#9a732a]" />

          {/* USER INFO HEADER */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 sm:gap-8">
            <div className="w-24 h-24 sm:w-32 sm:h-32 bg-[#12100e] border-2 border-[#c8963c]/50 rounded-full flex items-center justify-center text-4xl sm:text-5xl font-black shadow-lg uppercase text-[#c8963c] shrink-0 overflow-hidden">
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

            <div className="flex flex-col items-center sm:items-start flex-grow w-full">
              <div className="flex flex-col sm:flex-row items-center sm:items-center gap-4 w-full justify-between mb-2">
                <div>
                  <h2 className="text-2xl sm:text-4xl font-black text-[#f0e6cc] tracking-tight mb-1 text-center sm:text-left">
                    {profileData.username}
                  </h2>
                  <p className="text-[10px] text-[#c8963c] font-bold uppercase tracking-[0.2em] text-center sm:text-left">
                    {userRank}
                  </p>
                </div>

                <div className="flex-shrink-0">
                  {profileData.isFriend ? (
                    <div className="px-6 py-2 bg-[#c8963c]/10 text-[#c8963c] rounded-full font-black uppercase tracking-widest text-[10px] flex items-center gap-2 border border-[#c8963c]/30 cursor-default">
                      <span>✓</span> Friends
                    </div>
                  ) : (
                    <button
                      onClick={handleAddFriend}
                      className="px-6 py-2.5 bg-[#c8963c] text-[#12100e] rounded-full font-black uppercase tracking-widest text-[10px] hover:bg-[#e8c070] transition-all shadow-lg active:scale-95"
                    >
                      + Add to Friends
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap justify-center sm:justify-start gap-2 my-4">
                {achievementsList.map((ach) => (
                  <div
                    key={ach.id}
                    className={`px-2 py-1.5 rounded-lg text-[9px] font-bold transition-all border uppercase tracking-wider ${
                      ach.isUnlocked
                        ? "bg-[#c8963c]/10 border-[#c8963c]/40 text-[#c8963c] shadow-sm"
                        : "bg-[#12100e] border-[#c8963c]/10 text-[#f0e6cc]/30 grayscale"
                    }`}
                  >
                    {ach.isUnlocked ? ach.text : `🔒 ${ach.text.split(" ")[1]}`}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 w-full border-t border-[#c8963c]/10 pt-4 mt-2">
                <div className="text-center sm:text-left">
                  <div className="text-xl sm:text-2xl font-black text-[#c8963c]">
                    {favoritesCount}
                  </div>
                  <div className="text-[9px] sm:text-[10px] text-[#f0e6cc]/40 uppercase font-bold tracking-widest">
                    Favorites
                  </div>
                </div>
                <div className="text-center sm:text-left border-l border-[#c8963c]/10 pl-3">
                  <div className="text-xl sm:text-2xl font-black text-[#c8963c]">
                    {watchedCount}
                  </div>
                  <div className="text-[9px] sm:text-[10px] text-[#f0e6cc]/40 uppercase font-bold tracking-widest">
                    Watched
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* СТАТИСТИКА ПРОФІЛЮ (Прогрес-бар) */}
        {hasStats && (
          <div className="w-full mt-4 bg-[#12100e] border border-[#c8963c]/10 rounded-2xl p-4 shadow-inner">
            <div className="flex justify-between items-end mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#f0e6cc]/50">
                Completion Rate
              </span>
              <span className="text-[#c8963c] font-black text-sm">
                {profileData.stats?.completionRate || 0}%
              </span>
            </div>
            <div className="w-full h-3 bg-[#1a1714] rounded-full overflow-hidden border border-[#c8963c]/10">
              <div
                className="h-full bg-gradient-to-r from-[#9a732a] to-[#c8963c] transition-all duration-1000 ease-out relative"
                style={{ width: `${profileData.stats?.completionRate || 0}%` }}
              >
                <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMSIgZmlsbC1ydWxlPSJldmVub2RkIj48cGF0aCBkPSJNMCAwaDQwdjQwSDBWMHptMjAgMjBWMGgyMHYyMEgyMHoiLz48L2c+PC9zdmc+')] opacity-20" />
              </div>
            </div>
            <p className="text-[9px] text-center text-[#f0e6cc]/40 mt-2 italic">
              {profileData.username} has watched {watchedCount} out of{" "}
              {totalCount} movies in their list.
            </p>
          </div>
        )}

        {/* --- MOVIE WRAPPED --- */}
        {hasStats && (
          <div className="p-5 sm:p-8 bg-[#1a1714] rounded-3xl border border-[#c8963c]/20 shadow-xl mt-5 sm:mt-8">
            <h3 className="text-base sm:text-xl font-black text-[#f0e6cc] uppercase tracking-widest mb-6 border-b border-[#c8963c]/20 pb-3 flex items-center justify-between">
              {profileData.username}'s Movie Wrapped
            </h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* ЛІВА КОЛОНКА (Картки статів) */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {/* Time Spent */}
                <div className="bg-[#12100e] border border-[#c8963c]/20 p-4 sm:p-5 rounded-2xl shadow-inner col-span-2 sm:col-span-1">
                  <p className="text-[10px] text-[#f0e6cc]/50 uppercase tracking-widest font-bold mb-2 flex items-center gap-2">
                    <span className="text-[#c8963c]">⏱</span> Time Spent
                  </p>
                  <p className="text-xl sm:text-2xl font-black text-[#c8963c]">
                    {Math.floor((profileData.stats?.totalMinutes || 0) / 60)}{" "}
                    <span className="text-xs font-medium text-[#f0e6cc]/60 uppercase tracking-widest">
                      h
                    </span>{" "}
                    {(profileData.stats?.totalMinutes || 0) % 60}{" "}
                    <span className="text-xs font-medium text-[#f0e6cc]/60 uppercase tracking-widest">
                      m
                    </span>
                  </p>
                </div>

                {/* Top Genre */}
                <div className="bg-[#12100e] border border-[#c8963c]/20 p-4 sm:p-5 rounded-2xl shadow-inner col-span-2 sm:col-span-1">
                  <p className="text-[10px] text-[#f0e6cc]/50 uppercase tracking-widest font-bold mb-2 flex items-center gap-2">
                    <span className="text-[#c8963c]">🏆</span> Top Genre
                  </p>
                  <p
                    className="text-xl sm:text-2xl font-black text-[#c8963c] truncate"
                    title={profileData.stats?.topGenre || "N/A"}
                  >
                    {profileData.stats?.topGenre || "N/A"}
                  </p>
                </div>

                {/* Favorite Decade */}
                <div className="bg-[#12100e] border border-[#c8963c]/20 p-4 sm:p-5 rounded-2xl shadow-inner">
                  <p className="text-[10px] text-[#f0e6cc]/50 uppercase tracking-widest font-bold mb-2 flex items-center gap-2">
                    <span className="text-[#c8963c]">📼</span> Fav Decade
                  </p>
                  <p className="text-xl sm:text-2xl font-black text-[#c8963c]">
                    {profileData.stats?.favoriteDecade || "N/A"}
                  </p>
                </div>

                {/* Movies vs TV */}
                <div className="bg-[#12100e] border border-[#c8963c]/20 p-4 sm:p-5 rounded-2xl shadow-inner">
                  <p className="text-[10px] text-[#f0e6cc]/50 uppercase tracking-widest font-bold mb-2 flex items-center gap-2">
                    <span className="text-[#c8963c]">🎬</span> Format
                  </p>
                  <div className="flex justify-between items-center h-full pb-2">
                    <div className="text-center w-1/2 border-r border-[#c8963c]/20">
                      <span className="block text-lg font-black text-[#c8963c]">
                        {profileData.stats?.moviesCount || 0}
                      </span>
                      <span className="text-[8px] text-[#f0e6cc]/50 uppercase tracking-widest font-bold">
                        Movies
                      </span>
                    </div>
                    <div className="text-center w-1/2">
                      <span className="block text-lg font-black text-[#c8963c]">
                        {profileData.stats?.tvCount || 0}
                      </span>
                      <span className="text-[8px] text-[#f0e6cc]/50 uppercase tracking-widest font-bold">
                        TV
                      </span>
                    </div>
                  </div>
                </div>

                {/* Longest Marathon */}
                {profileData.stats?.longestMovie &&
                  profileData.stats.longestMovie.runtime > 0 && (
                    <div className="bg-[#12100e] border border-[#c8963c]/20 p-4 rounded-2xl shadow-inner col-span-2 flex items-center gap-4">
                      <div className="text-3xl">🏃‍♂️</div>
                      <div className="min-w-0">
                        <p className="text-[10px] text-[#f0e6cc]/50 uppercase tracking-widest font-bold mb-0.5">
                          Longest Marathon
                        </p>
                        <p
                          className="text-sm font-bold text-[#c8963c] truncate"
                          title={profileData.stats.longestMovie.title}
                        >
                          {profileData.stats.longestMovie.title}
                        </p>
                        <p className="text-xs text-[#f0e6cc]/80 font-black">
                          {profileData.stats.longestMovie.runtime} min
                        </p>
                      </div>
                    </div>
                  )}

                {/* Top Actor */}
                {profileData.stats?.topActor && (
                  <div className="bg-[#12100e] border border-[#c8963c]/20 p-3 sm:p-4 rounded-2xl shadow-inner col-span-2 flex items-center gap-4 group cursor-pointer hover:border-[#c8963c]/50 transition-colors">
                    <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 border border-[#c8963c]/30">
                      {profileData.stats.topActor.profileUrl ? (
                        <img
                          src={profileData.stats.topActor.profileUrl}
                          alt="Actor"
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full bg-[#1a1714] flex items-center justify-center text-xl">
                          🌟
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-[#f0e6cc]/50 uppercase tracking-widest font-bold mb-0.5">
                        Most Watched Actor
                      </p>
                      <p className="text-sm font-bold text-[#c8963c] truncate">
                        {profileData.stats.topActor.name}
                      </p>
                      <p className="text-[10px] text-[#f0e6cc]/80 italic">
                        In {profileData.stats.topActor.count} recent movies
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* ПРАВА КОЛОНКА (Діаграми) */}
              <div className="flex flex-col gap-6 h-full">
                {/* Pie Chart (Genres) */}
                <div className="bg-[#12100e] border border-[#c8963c]/20 rounded-2xl p-4 shadow-inner h-[220px]">
                  <p className="text-[10px] text-[#f0e6cc]/50 uppercase tracking-widest font-bold mb-2 text-center">
                    Genre Breakdown
                  </p>
                  <div className="h-full w-full relative -mt-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={profileData.stats?.genreDistribution || []}
                          innerRadius="60%"
                          outerRadius="85%"
                          paddingAngle={5}
                          dataKey="value"
                          stroke="none"
                        >
                          {(profileData.stats?.genreDistribution || []).map(
                            (_: any, index: number) => (
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
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col mt-4">
                      <span className="text-[#c8963c] text-xl font-black">
                        {profileData.stats?.genreDistribution?.length || 0}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bar Chart (Ratings) */}
                {profileData.stats?.ratingDistribution && (
                  <div className="bg-[#12100e] border border-[#c8963c]/20 rounded-2xl p-4 shadow-inner h-[220px] flex flex-col">
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-[10px] text-[#f0e6cc]/50 uppercase tracking-widest font-bold">
                        Rating Distribution
                      </p>
                      <p className="text-xs font-black text-[#c8963c]">
                        Avg: {profileData.stats.averageRating}
                      </p>
                    </div>
                    <div className="flex-grow w-full h-full -ml-4">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={profileData.stats.ratingDistribution}
                          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        >
                          <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{
                              fill: "#f0e6cc",
                              opacity: 0.5,
                              fontSize: 10,
                              fontWeight: "bold",
                            }}
                            dy={5}
                          />
                          <Tooltip
                            content={<RatingTooltip />}
                            cursor={{ fill: "#c8963c", opacity: 0.1 }}
                          />
                          <Bar
                            dataKey="value"
                            fill="#c8963c"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={40}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* TOP 3 MASTERPIECES */}
            {profileData.stats?.topRated &&
              profileData.stats.topRated.length > 0 && (
                <div className="mt-8 border-t border-[#c8963c]/10 pt-6">
                  <h4 className="text-[10px] text-[#c8963c] font-black uppercase tracking-[0.4em] mb-6 text-center">
                    Top 3 Rated Masterpieces
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {profileData.stats.topRated.map(
                      (item: any, index: number) => (
                        <Link
                          to={`/movie/${item.tmdbId}?type=${item.mediaType}`}
                          key={item.id}
                          className="relative group bg-[#12100e] border border-[#c8963c]/10 rounded-2xl p-3 flex items-center gap-4 hover:border-[#c8963c]/40 transition-all shadow-lg"
                        >
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
                            </div>
                          </div>
                        </Link>
                      ),
                    )}
                  </div>
                </div>
              )}
          </div>
        )}

        <div className="flex justify-center gap-4 pt-6">
          <div className="flex bg-[#1a1714] rounded-full p-1 border border-[#c8963c]/20 shadow-xl">
            <button
              onClick={() => setActiveTab("favorites")}
              className={`px-6 sm:px-8 py-2.5 rounded-full font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all ${
                activeTab === "favorites"
                  ? "bg-[#c8963c] text-[#12100e] shadow-lg"
                  : "text-[#f0e6cc]/40 hover:text-[#c8963c]"
              }`}
            >
              Favorites
            </button>
            <button
              onClick={() => setActiveTab("watched")}
              className={`px-6 sm:px-8 py-2.5 rounded-full font-black text-[10px] sm:text-xs uppercase tracking-widest transition-all ${
                activeTab === "watched"
                  ? "bg-[#c8963c] text-[#12100e] shadow-lg"
                  : "text-[#f0e6cc]/40 hover:text-[#c8963c]"
              }`}
            >
              Watched
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6 pb-12">
          {displayedMovies?.length > 0 ? (
            displayedMovies.map((movie: any) => (
              <Link
                to={`/movie/${movie.tmdbId}?type=${movie.mediaType || "movie"}`}
                key={movie.id}
                className="group flex flex-col bg-[#1a1714] border border-[#c8963c]/10 rounded-2xl overflow-hidden hover:border-[#c8963c]/50 transition-all duration-300 shadow-lg relative"
              >
                <div className="aspect-[2/3] relative overflow-hidden bg-[#12100e]">
                  {movie.posterUrl ? (
                    <img
                      src={movie.posterUrl}
                      alt={movie.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full text-[10px] text-[#f0e6cc]/20 uppercase font-black">
                      No Image
                    </div>
                  )}
                  {movie.rating > 0 && (
                    <div className="absolute top-2 right-2 bg-[#12100e]/90 backdrop-blur-md px-2 py-1 rounded-lg border border-[#c8963c]/30 text-[#c8963c] text-[10px] font-black shadow-xl">
                      ★ {movie.rating}
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h4 className="text-[10px] sm:text-xs font-bold text-[#f0e6cc] truncate group-hover:text-[#c8963c] transition-colors uppercase tracking-tight">
                    {movie.title}
                  </h4>
                </div>
              </Link>
            ))
          ) : (
            <div className="col-span-full py-20 text-center bg-[#1a1714] rounded-3xl border border-[#c8963c]/10 border-dashed">
              <p className="text-[#f0e6cc]/30 uppercase tracking-widest font-black text-sm italic">
                The collection is currently empty
              </p>
            </div>
          )}
        </div>
      </div>

      {toastMessage && (
        <div className="fixed bottom-10 right-10 bg-[#1a1714] border border-[#c8963c]/50 text-[#c8963c] px-6 py-4 rounded-xl font-bold uppercase tracking-widest text-xs z-50 shadow-2xl animate-in slide-in-from-bottom-5">
          {toastMessage}
        </div>
      )}
    </div>
  );
}

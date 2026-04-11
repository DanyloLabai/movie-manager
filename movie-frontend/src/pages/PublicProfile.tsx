import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 flex flex-col p-6 sm:p-8 bg-[#1a1714] rounded-3xl border border-[#c8963c]/20 shadow-xl relative overflow-hidden h-fit">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#c8963c] to-[#9a732a]" />
            <div className="flex flex-col items-center text-center">
              <div className="w-24 h-24 sm:w-32 sm:h-32 bg-[#12100e] border-2 border-[#c8963c]/50 rounded-full flex items-center justify-center text-4xl sm:text-5xl font-black shadow-lg uppercase text-[#c8963c] shrink-0 overflow-hidden mb-4">
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
              <h2 className="text-2xl sm:text-3xl font-black text-[#f0e6cc] tracking-tight mb-1">
                {profileData.username}
              </h2>
              <p className="text-[10px] text-[#c8963c] font-bold uppercase tracking-[0.2em] mb-4">
                {userRank}
              </p>

              <div className="mb-6">
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

              <div className="flex flex-wrap justify-center gap-2 mb-6">
                {achievementsList.map((ach) => (
                  <div
                    key={ach.id}
                    className={`px-2 py-1.5 rounded-lg text-[9px] font-bold transition-all border uppercase tracking-wider ${
                      ach.isUnlocked
                        ? "bg-[#c8963c]/10 border-[#c8963c]/40 text-[#c8963c]"
                        : "bg-[#12100e]/50 border-[#c8963c]/5 text-[#f0e6cc]/10 grayscale"
                    }`}
                  >
                    {ach.text}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3 w-full border-t border-[#c8963c]/10 pt-4">
                <div>
                  <div className="text-xl font-black text-[#c8963c]">
                    {favoritesCount}
                  </div>
                  <div className="text-[9px] text-[#f0e6cc]/40 uppercase font-bold tracking-widest">
                    Favorites
                  </div>
                </div>
                <div>
                  <div className="text-xl font-black text-[#c8963c]">
                    {watchedCount}
                  </div>
                  <div className="text-[9px] text-[#f0e6cc]/40 uppercase font-bold tracking-widest">
                    Watched
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 p-6 sm:p-8 bg-[#1a1714] rounded-3xl border border-[#c8963c]/20 shadow-xl relative overflow-hidden">
            <h3 className="text-xs sm:text-sm font-black text-[#c8963c] uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
              <span className="w-8 h-[1px] bg-[#c8963c]/30"></span> Movie
              Wrapped
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center mb-10">
              <div className="space-y-4">
                <div className="bg-[#12100e] p-4 rounded-2xl border border-[#c8963c]/10 shadow-inner">
                  <p className="text-[9px] text-[#f0e6cc]/40 uppercase font-black mb-1">
                    Screen Time
                  </p>
                  <p className="text-xl font-black text-[#f0e6cc]">
                    {Math.floor((profileData.stats?.totalMinutes || 0) / 60)}h{" "}
                    {(profileData.stats?.totalMinutes || 0) % 60}m
                  </p>
                </div>
                <div className="bg-[#12100e] p-4 rounded-2xl border border-[#c8963c]/10 shadow-inner">
                  <p className="text-[9px] text-[#f0e6cc]/40 uppercase font-black mb-1">
                    Favorite Genre
                  </p>
                  <p className="text-xl font-black text-[#c8963c]">
                    {profileData.stats?.topGenre || "N/A"}
                  </p>
                </div>
              </div>
              <div className="h-48 relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={profileData.stats?.genreDistribution || []}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {profileData.stats?.genreDistribution?.map(
                        (_: any, index: number) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={CHART_COLORS[index % CHART_COLORS.length]}
                          />
                        ),
                      )}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col">
                  <span className="text-[#c8963c] text-xl font-black">
                    {profileData.stats?.genreDistribution?.length || 0}
                  </span>
                  <span className="text-[#f0e6cc]/40 text-[10px] font-bold uppercase tracking-widest">
                    Genres
                  </span>
                </div>
              </div>
            </div>

            {profileData.stats?.topRated?.length > 0 && (
              <div className="mt-4 pt-8 border-t border-[#c8963c]/10">
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
                        <div className="w-10 h-14 shrink-0 rounded-lg overflow-hidden border border-[#c8963c]/10 bg-[#1a1714]">
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
        </div>

        <div className="flex justify-center gap-4">
          <button
            onClick={() => setActiveTab("favorites")}
            className={`px-8 py-2.5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all ${
              activeTab === "favorites"
                ? "bg-[#c8963c] text-[#12100e] shadow-lg"
                : "bg-[#1a1714] text-[#f0e6cc]/40 border border-[#c8963c]/20 hover:border-[#c8963c]/50"
            }`}
          >
            Top Favorites
          </button>
          <button
            onClick={() => setActiveTab("watched")}
            className={`px-8 py-2.5 rounded-full font-black text-[10px] uppercase tracking-widest transition-all ${
              activeTab === "watched"
                ? "bg-[#c8963c] text-[#12100e] shadow-lg"
                : "bg-[#1a1714] text-[#f0e6cc]/40 border border-[#c8963c]/20 hover:border-[#c8963c]/50"
            }`}
          >
            Watched Collection
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
          {displayedMovies?.length > 0 ? (
            displayedMovies.map((movie: any) => (
              <Link
                to={`/movie/${movie.tmdbId}?type=${movie.mediaType || "movie"}`}
                key={movie.id}
                className="group flex flex-col bg-[#1a1714] border border-[#c8963c]/10 rounded-2xl overflow-hidden hover:border-[#c8963c]/50 transition-all duration-300 shadow-lg"
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

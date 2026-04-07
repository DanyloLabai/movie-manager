import { useEffect, useRef, useState } from "react";
import {
  useParams,
  useNavigate,
  Link,
  useSearchParams,
} from "react-router-dom";
import { api } from "../api";

interface MovieDetailsData {
  id: number;
  title: string;
  overview: string;
  release_date: string;
  vote_average: number;
  poster_path: string | null;
  backdrop_path: string | null;
  runtime: number;
  genres: { id: number; name: string }[];
  mediaType?: "movie" | "tv";
  trailerUrl?: string | null;
}

interface RecommendedMovie {
  id: number;
  title: string;
  releaseYear: string;
  rating: number;
  posterUrl: string | null;
  mediaType: "movie" | "tv";
}

interface UserMovieStatus {
  id: number;
  isWatched: boolean;
  isFavorite: boolean;
  rating: number | null;
}

export default function MovieDetails() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const mediaType = searchParams.get("type") || "movie";
  const navigate = useNavigate();

  const [movie, setMovie] = useState<MovieDetailsData | null>(null);
  const [status, setStatus] = useState<UserMovieStatus | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendedMovie[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [hoveredStar, setHoveredStar] = useState(0);
  const [modalHoveredStar, setModalHoveredStar] = useState(0);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    "new_watched" | "update_watched" | null
  >(null);

  const sliderRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    const el = sliderRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 8);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8);
  };

  useEffect(() => {
    const el = sliderRef.current;
    if (!el) return;
    el.addEventListener("scroll", checkScroll, { passive: true });
    checkScroll();
    return () => el.removeEventListener("scroll", checkScroll);
  }, [recommendations]);

  const scrollSlider = (dir: "left" | "right") => {
    const el = sliderRef.current;
    if (!el) return;
    const cardWidth = el.firstElementChild
      ? (el.firstElementChild as HTMLElement).offsetWidth + 16
      : 180;
    el.scrollBy({
      left: dir === "right" ? cardWidth * 2 : -cardWidth * 2,
      behavior: "smooth",
    });
  };

  useEffect(() => {
    if (id) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      setMovie(null);
      setRecommendations([]);
      setStatus(null);
      setIsLoading(true);
      fetchData(Number(id));
    }
  }, [id, mediaType]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchData = async (tmdbId: number) => {
    try {
      const [detailsRes, statusRes, recsRes] = await Promise.all([
        api.get(`/movies/${tmdbId}/details?type=${mediaType}`),
        api.get(`/movies/${tmdbId}/status`).catch(() => ({ data: null })),
        api
          .get(`/movies/${tmdbId}/similar?type=${mediaType}`)
          .catch(() => ({ data: [] })),
      ]);
      if (detailsRes.data) {
        setMovie(detailsRes.data);
        setStatus(statusRes.data);
        setRecommendations(recsRes.data);
      }
    } catch {
      setMovie(null);
    } finally {
      setIsLoading(false);
    }
  };

  const updateStatusCache = (newStatus: UserMovieStatus | null) => {
    setStatus(newStatus);
    if (newStatus && movie) {
      localStorage.setItem(
        `movie_status_${movie.id}`,
        JSON.stringify(newStatus),
      );
    } else if (movie) {
      localStorage.removeItem(`movie_status_${movie.id}`);
    }
  };

  const handleAddNewMovie = async (
    markWatched = false,
    initialRating: number | null = null,
  ) => {
    if (!movie) return;
    try {
      const posterUrl = movie.poster_path
        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
        : null;
      await api.post("/movies/watchlist", {
        tmdbId: movie.id,
        title: movie.title,
        posterUrl,
        mediaType,
      });
      if (initialRating) {
        await api.patch(`/movies/watchlist/${movie.id}/rate`, {
          rating: initialRating,
        });
        showToast("Added and rated!");
      } else if (markWatched) {
        await api.post(`/movies/watchlist/${movie.id}/watched`);
        showToast("Marked as Watched!");
      } else {
        showToast("Added to Watchlist!");
      }
      fetchData(movie.id);
    } catch {
      showToast("Error updating.");
    }
  };

  const handleMarkWatched = async () => {
    if (!movie) return;
    try {
      await api.post(`/movies/watchlist/${movie.id}/watched`);
      showToast("Marked as Watched!");
      fetchData(movie.id);
    } catch {
      showToast("Error.");
    }
  };

  const handleToggleFavorite = async () => {
    if (!movie || !status) return;
    try {
      await api.patch(`/movies/watchlist/${movie.id}/favorite`);
      updateStatusCache({ ...status, isFavorite: !status.isFavorite });
      showToast("Favorite updated");
    } catch {
      showToast("Failed.");
    }
  };

  const handleRate = async (star: number) => {
    if (!movie) return;
    const newRating = status?.rating === star ? 0 : star;
    try {
      await api.patch(`/movies/watchlist/${movie.id}/rate`, {
        rating: newRating,
      });
      showToast(newRating === 0 ? "Rating cleared!" : "Rating saved!");
      fetchData(movie.id);
    } catch {
      showToast("Error.");
    }
  };

  const handleRemove = async () => {
    if (!movie) return;
    try {
      await api.delete(`/movies/watchlist/${movie.id}`);
      showToast("Removed.");
      updateStatusCache(null);
    } catch {
      showToast("Error.");
    }
  };

  const handleModalRate = async (star: number) => {
    setIsRatingModalOpen(false);
    if (pendingAction === "new_watched") await handleAddNewMovie(true, star);
    else if (pendingAction === "update_watched") await handleRate(star);
    setPendingAction(null);
  };

  const handleModalSkip = async () => {
    setIsRatingModalOpen(false);
    if (pendingAction === "new_watched") await handleAddNewMovie(true, null);
    else if (pendingAction === "update_watched") await handleMarkWatched();
    setPendingAction(null);
  };

  if (isLoading)
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );

  if (!movie)
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <Link to="/search" className="text-blue-500 font-bold hover:underline">
          Movie not found. Back to Search
        </Link>
      </div>
    );

  const posterUrl = movie.poster_path
    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
    : null;
  const backdropUrl = movie.backdrop_path
    ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}`
    : null;

  return (
    <div className="min-h-screen bg-gray-900 font-sans text-gray-100 relative pb-24">
      <header className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-gray-800 bg-gray-900/90 backdrop-blur-md sticky top-0 z-40">
        <Link
          to="/search"
          className="text-lg sm:text-xl font-black bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent uppercase tracking-tighter"
        >
          Movie Tracker
        </Link>
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs font-black uppercase text-gray-500 hover:text-white transition active:scale-95"
        >
          <svg
            className="w-4 h-4"
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
          Back
        </button>
      </header>

      <div className="relative w-full h-[35vh] sm:h-[50vh] bg-gray-800">
        {backdropUrl && (
          <>
            <img
              src={backdropUrl}
              alt="Backdrop"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent" />
          </>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 -mt-28 sm:-mt-36 relative z-10">
        <div className="flex gap-4 sm:gap-6 items-end mb-6 sm:mb-0 sm:hidden">
          <div className="flex-shrink-0 w-28">
            {posterUrl ? (
              <img
                src={posterUrl}
                alt={movie.title}
                className="w-full rounded-2xl shadow-2xl border border-gray-700"
              />
            ) : (
              <div className="w-full aspect-[2/3] rounded-2xl bg-gray-800 border border-gray-700" />
            )}
          </div>

          <div className="flex-1 min-w-0 pb-1">
            <span className="inline-block mb-2 px-2 py-0.5 bg-gray-800 border border-gray-700 rounded-md text-[9px] text-gray-500 font-black uppercase tracking-widest">
              {mediaType === "tv" ? "TV Show" : "Movie"}
            </span>
            <h1 className="text-xl font-black text-white tracking-tight leading-tight mb-2 line-clamp-3">
              {movie.title}
            </h1>
            <div className="flex flex-wrap gap-2 text-[10px] text-gray-400 font-bold items-center">
              <span className="text-white">
                {movie.release_date?.split("-")[0]}
              </span>
              <span className="text-gray-700">•</span>
              <span>{movie.runtime || "0"} min</span>
              <span className="text-yellow-500 px-2 py-0.5 bg-yellow-500/10 rounded-md border border-yellow-500/20 font-black">
                ★ {movie.vote_average?.toFixed(1)}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {movie.genres?.slice(0, 3).map((g) => (
                <span
                  key={g.id}
                  className="text-[9px] text-gray-600 uppercase tracking-widest font-black"
                >
                  {g.name}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="hidden sm:grid grid-cols-12 gap-8 lg:gap-12">
          <div className="col-span-4 lg:col-span-3 flex flex-col gap-6">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-b from-blue-500/20 to-purple-500/20 rounded-[2.5rem] blur-xl opacity-50 group-hover:opacity-100 transition duration-1000" />
              <img
                src={posterUrl || ""}
                alt={movie.title}
                className="relative w-full rounded-[2rem] shadow-2xl border border-gray-700 bg-gray-800 transition-transform duration-500 group-hover:scale-[1.02]"
              />
            </div>
            <ActionPanel
              status={status}
              hoveredStar={hoveredStar}
              setHoveredStar={setHoveredStar}
              onAddWatchlist={() => handleAddNewMovie(false)}
              onWatched={() => {
                setPendingAction("new_watched");
                setIsRatingModalOpen(true);
              }}
              onToggleFavorite={handleToggleFavorite}
              onRate={handleRate}
              onRemove={handleRemove}
            />
          </div>

          <div className="col-span-8 lg:col-span-9 flex flex-col pt-32 md:pt-40">
            <h1 className="text-4xl sm:text-6xl font-black text-white mb-4 tracking-tighter">
              {movie.title}
              <span className="ml-4 inline-block px-2.5 py-1 bg-gray-800 border border-gray-700 rounded-lg text-xs align-middle text-gray-500 font-bold uppercase tracking-widest">
                {mediaType === "tv" ? "TV SHOW" : "MOVIE"}
              </span>
            </h1>
            <div className="flex flex-wrap gap-4 text-xs sm:text-sm text-gray-400 mb-8 items-center font-bold">
              <span className="text-white">
                {movie.release_date?.split("-")[0]}
              </span>
              <span className="w-1.5 h-1.5 bg-gray-700 rounded-full" />
              <span>{movie.runtime || "0"} min</span>
              <span className="w-1.5 h-1.5 bg-gray-700 rounded-full" />
              <span className="text-yellow-500 px-2 py-1 bg-yellow-500/10 rounded-lg border border-yellow-500/20 tracking-tighter font-black">
                IMDB: {movie.vote_average?.toFixed(1)}
              </span>
              <div className="flex gap-2">
                {movie.genres?.slice(0, 3).map((g) => (
                  <span
                    key={g.id}
                    className="text-[10px] text-gray-500 uppercase tracking-widest"
                  >
                    {g.name}
                  </span>
                ))}
              </div>
            </div>
            <p className="text-gray-400 text-base sm:text-lg leading-relaxed mb-12 max-w-4xl font-medium">
              {movie.overview}
            </p>
            {movie.trailerUrl && <TrailerBlock trailerUrl={movie.trailerUrl} />}
          </div>
        </div>

        {/* MOBILE: overview + actions */}
        <div className="sm:hidden mt-4 flex flex-col gap-4">
          <p className="text-gray-400 text-sm leading-relaxed font-medium">
            {movie.overview}
          </p>

          {/* Mobile Action Panel */}
          <div className="bg-gray-800/60 border border-gray-700/50 p-4 rounded-3xl shadow-xl backdrop-blur-md">
            {!status ? (
              <div className="flex gap-3">
                <button
                  onClick={() => handleAddNewMovie(false)}
                  className="flex-1 py-3 bg-blue-600 rounded-2xl font-black text-[11px] uppercase tracking-wider hover:bg-blue-500 transition active:scale-95 shadow-lg shadow-blue-900/20"
                >
                  + Watchlist
                </button>
                <button
                  onClick={() => {
                    setPendingAction("new_watched");
                    setIsRatingModalOpen(true);
                  }}
                  className="flex-1 py-3 bg-green-600 rounded-2xl font-black text-[11px] uppercase tracking-wider hover:bg-green-500 transition active:scale-95 shadow-lg shadow-green-900/20"
                >
                  ✓ Watched
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ${status.isWatched ? "text-green-400 bg-green-400/10" : "text-blue-400 bg-blue-400/10"}`}
                  >
                    {status.isWatched ? "✓ Watched" : "⋯ In Plans"}
                  </span>
                  <button
                    onClick={handleToggleFavorite}
                    className={`p-2.5 rounded-xl transition active:scale-90 ${status.isFavorite ? "bg-red-500 text-white shadow-lg shadow-red-900/40" : "bg-gray-700 text-gray-400"}`}
                  >
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                  </button>
                </div>

                <div>
                  <p className="text-[9px] font-black text-gray-500 mb-2 uppercase tracking-widest">
                    Your Rating
                  </p>
                  <div
                    className="flex justify-between"
                    onMouseLeave={() => setHoveredStar(0)}
                  >
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        onMouseEnter={() => setHoveredStar(s)}
                        onClick={() => handleRate(s)}
                        className={`text-3xl transition-all duration-150 active:scale-90 ${(hoveredStar || status.rating || 0) >= s ? "text-yellow-400" : "text-gray-700"}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleRemove}
                  className="w-full py-2 bg-red-900/20 text-red-500 rounded-xl text-[9px] font-black uppercase tracking-widest border border-red-500/20 hover:bg-red-600 hover:text-white transition active:scale-95"
                >
                  Remove from list
                </button>
              </div>
            )}
          </div>

          {/* Mobile Trailer */}
          {movie.trailerUrl && (
            <div className="mt-2">
              <div className="flex items-center gap-3 mb-3">
                <h3 className="text-sm font-black text-white uppercase tracking-widest italic">
                  Trailer
                </h3>
                <div className="h-px flex-grow bg-gradient-to-r from-gray-700 to-transparent" />
              </div>
              <div className="relative aspect-video rounded-2xl overflow-hidden border border-gray-700/50 bg-black shadow-xl">
                <iframe
                  src={`${movie.trailerUrl}?rel=0&showinfo=0&modestbranding=1&autoplay=0`}
                  title="Trailer"
                  className="absolute inset-0 w-full h-full"
                  allowFullScreen
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {recommendations.length > 0 && (
        <div className="mt-10 sm:mt-20 max-w-7xl mx-auto">
          <div className="flex items-center justify-between px-4 sm:px-6 mb-4 sm:mb-8">
            <div className="flex items-center gap-4">
              <h3 className="text-lg sm:text-2xl font-black text-white uppercase tracking-tighter italic">
                More Like This
              </h3>
              <div className="hidden sm:block h-[1px] w-24 bg-gray-800" />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => scrollSlider("left")}
                disabled={!canScrollLeft}
                className={`w-9 h-9 rounded-xl flex items-center justify-center border transition active:scale-90 ${canScrollLeft ? "bg-gray-800 border-gray-700 text-white hover:bg-gray-700" : "bg-gray-900 border-gray-800 text-gray-700 cursor-not-allowed"}`}
              >
                <svg
                  className="w-4 h-4"
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
              </button>
              <button
                onClick={() => scrollSlider("right")}
                disabled={!canScrollRight}
                className={`w-9 h-9 rounded-xl flex items-center justify-center border transition active:scale-90 ${canScrollRight ? "bg-gray-800 border-gray-700 text-white hover:bg-gray-700" : "bg-gray-900 border-gray-800 text-gray-700 cursor-not-allowed"}`}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div
            ref={sliderRef}
            className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide px-4 sm:px-6 pb-4 snap-x snap-mandatory"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            onScroll={checkScroll}
          >
            {recommendations.map((m) => (
              <Link
                key={m.id}
                to={`/movie/${m.id}?type=${mediaType}`}
                className="group flex-shrink-0 w-36 sm:w-44 snap-start bg-gray-800/40 rounded-2xl sm:rounded-[2rem] overflow-hidden border border-gray-700/50 hover:border-blue-500/50 transition-all duration-300 hover:-translate-y-1 shadow-lg"
              >
                <div className="aspect-[2/3] relative overflow-hidden">
                  {m.posterUrl ? (
                    <img
                      src={m.posterUrl}
                      alt={m.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-900 flex items-center justify-center text-[9px] text-gray-700 font-bold uppercase tracking-widest">
                      No Image
                    </div>
                  )}
                  <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-md px-1.5 py-0.5 rounded-md text-[9px] text-yellow-500 font-black border border-yellow-500/20">
                    ★ {m.rating?.toFixed(1) || "0.0"}
                  </div>
                </div>
                <div className="p-3 sm:p-4">
                  <h4 className="text-[10px] sm:text-xs font-bold text-white truncate group-hover:text-blue-400 transition-colors uppercase tracking-tight">
                    {m.title}
                  </h4>
                  <p className="text-[8px] sm:text-[9px] text-gray-600 mt-0.5 font-black uppercase tracking-widest">
                    {m.releaseYear}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {isRatingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/90 backdrop-blur-xl p-4">
          <div className="bg-gray-800 border border-gray-700 p-8 sm:p-10 rounded-[2.5rem] sm:rounded-[3.5rem] shadow-2xl w-full max-w-sm text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500" />
            <button
              onClick={() => setIsRatingModalOpen(false)}
              className="absolute top-5 right-6 text-gray-500 hover:text-white transition text-xl active:scale-90"
            >
              ✕
            </button>
            <h3 className="text-xl sm:text-2xl font-black text-white mb-2 uppercase tracking-tighter">
              How was it?
            </h3>
            <p className="text-gray-500 text-[10px] mb-8 uppercase tracking-[0.2em] font-bold px-4">
              Rate to mark as watched
            </p>
            <div
              className="flex justify-between mb-8 px-2"
              onMouseLeave={() => setModalHoveredStar(0)}
            >
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  onMouseEnter={() => setModalHoveredStar(s)}
                  onClick={() => handleModalRate(s)}
                  className={`text-4xl sm:text-5xl transition-all duration-150 active:scale-90 ${modalHoveredStar >= s ? "text-yellow-400 drop-shadow-[0_0_12px_rgba(250,204,21,0.6)]" : "text-gray-700"}`}
                >
                  ★
                </button>
              ))}
            </div>
            <button
              onClick={handleModalSkip}
              className="text-[10px] text-gray-500 hover:text-blue-400 transition font-black uppercase tracking-[0.3em] border-b border-transparent hover:border-blue-400/50 pb-1"
            >
              Skip Rating
            </button>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-10 sm:w-auto bg-gray-800 border border-gray-700 text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 z-[60] backdrop-blur-md">
          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse flex-shrink-0" />
          <span className="font-bold text-[10px] uppercase tracking-[0.2em]">
            {toastMessage}
          </span>
        </div>
      )}
    </div>
  );
}

function ActionPanel({
  status,
  hoveredStar,
  setHoveredStar,
  onAddWatchlist,
  onWatched,
  onToggleFavorite,
  onRate,
  onRemove,
}: {
  status: UserMovieStatus | null;
  hoveredStar: number;
  setHoveredStar: (n: number) => void;
  onAddWatchlist: () => void;
  onWatched: () => void;
  onToggleFavorite: () => void;
  onRate: (s: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="bg-gray-800/40 border border-gray-700/50 p-6 rounded-[2rem] shadow-2xl backdrop-blur-md">
      {!status ? (
        <div className="flex flex-col gap-3">
          <button
            onClick={onAddWatchlist}
            className="w-full py-3.5 bg-blue-600 rounded-2xl font-black text-[10px] uppercase tracking-wider hover:bg-blue-500 transition active:scale-95 shadow-lg shadow-blue-900/20"
          >
            Watchlist
          </button>
          <button
            onClick={onWatched}
            className="w-full py-3.5 bg-green-600 rounded-2xl font-black text-[10px] uppercase tracking-wider hover:bg-green-500 transition active:scale-95 shadow-lg shadow-green-900/20"
          >
            Watched
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <span
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest ${status.isWatched ? "text-green-400 bg-green-400/10" : "text-blue-400 bg-blue-400/10"}`}
            >
              {status.isWatched ? "Watched" : "In Plans"}
            </span>
            <button
              onClick={onToggleFavorite}
              className={`p-2.5 rounded-xl transition ${status.isFavorite ? "bg-red-500 text-white shadow-lg shadow-red-900/40" : "bg-gray-700 text-gray-400"}`}
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </button>
          </div>
          <div className="pt-4 border-t border-gray-700/50">
            <p className="text-[10px] font-black text-gray-500 mb-3 uppercase tracking-widest">
              Rate this media
            </p>
            <div
              className="flex justify-between"
              onMouseLeave={() => setHoveredStar(0)}
            >
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  onMouseEnter={() => setHoveredStar(s)}
                  onClick={() => onRate(s)}
                  className={`text-2xl transition-all duration-200 transform hover:scale-125 ${(hoveredStar || status.rating || 0) >= s ? "text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]" : "text-gray-700"}`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={onRemove}
            className="w-full py-2.5 bg-red-900/20 text-red-500 rounded-xl text-[9px] font-black uppercase tracking-widest border border-red-500/20 hover:bg-red-600 hover:text-white transition"
          >
            Remove from list
          </button>
        </div>
      )}
    </div>
  );
}

function TrailerBlock({ trailerUrl }: { trailerUrl: string }) {
  return (
    <div className="w-full max-w-2xl">
      <div className="flex items-center gap-4 mb-6">
        <h3 className="text-lg font-black text-white uppercase tracking-widest italic">
          Trailer
        </h3>
        <div className="h-[1px] flex-grow bg-gradient-to-r from-gray-800 to-transparent" />
      </div>
      <div className="relative group">
        <div className="absolute -inset-1 bg-blue-500/10 rounded-[2rem] blur-xl opacity-0 group-hover:opacity-100 transition duration-700" />
        <div className="relative aspect-video rounded-[2rem] overflow-hidden border border-gray-700/50 bg-black shadow-2xl transition-transform duration-500 group-hover:scale-[1.01]">
          <iframe
            src={`${trailerUrl}?rel=0&showinfo=0&modestbranding=1&autoplay=0`}
            title="Trailer"
            className="absolute inset-0 w-full h-full"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}

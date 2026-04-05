import { useEffect, useState } from "react";
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

  // Нові стани для зірочок та модалки
  const [hoveredStar, setHoveredStar] = useState(0);
  const [modalHoveredStar, setModalHoveredStar] = useState(0);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    "new_watched" | "update_watched" | null
  >(null);

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
    } catch (error) {
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
    markWatched: boolean = false,
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
    <div className="min-h-screen bg-gray-900 font-sans text-gray-100 relative pb-20">
      <header className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-800 bg-gray-900/80 backdrop-blur-md sticky top-0 z-40">
        <Link
          to="/search"
          className="text-xl font-black bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent uppercase tracking-tighter"
        >
          Movie Tracker
        </Link>
        <button
          onClick={() => navigate(-1)}
          className="text-xs font-black uppercase text-gray-500 hover:text-white transition"
        >
          Back
        </button>
      </header>

      <div className="relative w-full h-[40vh] sm:h-[55vh] bg-gray-800">
        {backdropUrl && (
          <>
            <img
              src={backdropUrl}
              alt="Backdrop"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/50 to-transparent"></div>
          </>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 -mt-32 relative z-10 grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12">
        {/* ЛІВА КОЛОНКА: ПОСТЕР + КНОПКИ */}
        <div className="md:col-span-4 lg:col-span-3 flex flex-col gap-6">
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-b from-blue-500/20 to-purple-500/20 rounded-[2.5rem] blur-xl opacity-50 group-hover:opacity-100 transition duration-1000"></div>
            <img
              src={posterUrl || ""}
              alt={movie.title}
              className="relative w-full rounded-[2rem] shadow-2xl border border-gray-700 bg-gray-800 transition-transform duration-500 group-hover:scale-[1.02]"
            />
          </div>

          <div className="bg-gray-800/40 border border-gray-700/50 p-6 rounded-[2rem] shadow-2xl backdrop-blur-md">
            {!status ? (
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => handleAddNewMovie(false)}
                  className="w-full py-3.5 bg-blue-600 rounded-2xl font-black text-[10px] uppercase tracking-wider hover:bg-blue-500 transition active:scale-95 shadow-lg shadow-blue-900/20"
                >
                  Watchlist
                </button>
                <button
                  onClick={() => {
                    setPendingAction("new_watched");
                    setIsRatingModalOpen(true);
                  }}
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
                    onClick={handleToggleFavorite}
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
                        onClick={() => handleRate(s)}
                        className={`text-2xl transition-all duration-200 transform hover:scale-125 ${(hoveredStar || status.rating || 0) >= s ? "text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]" : "text-gray-700"}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleRemove}
                  className="w-full py-2.5 bg-red-900/20 text-red-500 rounded-xl text-[9px] font-black uppercase tracking-widest border border-red-500/20 hover:bg-red-600 hover:text-white transition"
                >
                  Remove from list
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="md:col-span-8 lg:col-span-9 flex flex-col pt-32 md:pt-40">
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
            <span className="w-1.5 h-1.5 bg-gray-700 rounded-full"></span>
            <span>{movie.runtime || "0"} min</span>
            <span className="w-1.5 h-1.5 bg-gray-700 rounded-full"></span>
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

          {movie.trailerUrl && (
            <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-10 duration-1000">
              <div className="flex items-center gap-4 mb-6">
                <h3 className="text-lg font-black text-white uppercase tracking-widest italic">
                  Trailer
                </h3>
                <div className="h-[1px] flex-grow bg-gradient-to-r from-gray-800 to-transparent"></div>
              </div>

              <div className="relative group">
                <div className="absolute -inset-1 bg-blue-500/10 rounded-[2rem] blur-xl opacity-0 group-hover:opacity-100 transition duration-700"></div>

                <div className="relative aspect-video rounded-[2rem] overflow-hidden border border-gray-700/50 bg-black shadow-2xl transition-transform duration-500 group-hover:scale-[1.01]">
                  <iframe
                    src={`${movie.trailerUrl}?rel=0&showinfo=0&modestbranding=1&autoplay=0`}
                    title="Trailer"
                    className="absolute inset-0 w-full h-full"
                    allowFullScreen
                  ></iframe>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {recommendations.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-20">
          <div className="flex items-center gap-4 mb-10">
            <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">
              More Like This
            </h3>
            <div className="h-[1px] flex-grow bg-gray-800"></div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6">
            {recommendations.map((m) => (
              <Link
                key={m.id}
                to={`/movie/${m.id}?type=${mediaType}`}
                className="group bg-gray-800/40 rounded-[2rem] overflow-hidden border border-gray-700/50 hover:border-blue-500/50 transition-all duration-500 hover:-translate-y-2 shadow-lg"
              >
                <div className="aspect-[2/3] relative overflow-hidden">
                  {m.posterUrl ? (
                    <img
                      src={m.posterUrl}
                      alt={m.title}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-900 flex items-center justify-center text-[10px] text-gray-700 font-bold uppercase tracking-widest">
                      No Image
                    </div>
                  )}
                  <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md px-2 py-1 rounded-lg text-[9px] text-yellow-500 font-black border border-yellow-500/20">
                    ★ {m.rating?.toFixed(1) || "0.0"}
                  </div>
                </div>
                <div className="p-5">
                  <h4 className="text-xs font-bold text-white truncate group-hover:text-blue-400 transition-colors uppercase tracking-tight">
                    {m.title}
                  </h4>
                  <p className="text-[9px] text-gray-600 mt-1 font-black uppercase tracking-widest">
                    {m.releaseYear}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {isRatingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl p-4">
          <div className="bg-gray-800 border border-gray-700 p-10 rounded-[3.5rem] shadow-2xl max-w-sm w-full text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
            <button
              onClick={() => setIsRatingModalOpen(false)}
              className="absolute top-6 right-8 text-gray-500 hover:text-white transition text-xl"
            >
              ✕
            </button>
            <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter">
              How was it?
            </h3>
            <p className="text-gray-500 text-[10px] mb-8 uppercase tracking-[0.2em] font-bold px-4">
              Rate the experience to mark it as watched
            </p>
            <div
              className="flex justify-between mb-10"
              onMouseLeave={() => setModalHoveredStar(0)}
            >
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  onMouseEnter={() => setModalHoveredStar(s)}
                  onClick={() => handleModalRate(s)}
                  className={`text-4xl transition-all duration-200 transform hover:scale-125 ${modalHoveredStar >= s ? "text-yellow-400 drop-shadow-[0_0_12px_rgba(250,204,21,0.6)]" : "text-gray-700"}`}
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
        <div className="fixed bottom-10 right-5 left-5 sm:left-auto sm:right-10 bg-gray-800 border border-gray-700 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 z-[60] backdrop-blur-md">
          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
          <span className="font-bold text-[10px] uppercase tracking-[0.2em]">
            {toastMessage}
          </span>
        </div>
      )}
    </div>
  );
}

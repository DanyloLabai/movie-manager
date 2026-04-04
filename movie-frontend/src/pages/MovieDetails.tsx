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

  const [movie, setMovie] = useState<MovieDetailsData | null>(() => {
    try {
      if (!id) return null;
      const cached = localStorage.getItem(`movie_details_${id}_${mediaType}`);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [status, setStatus] = useState<UserMovieStatus | null>(() => {
    try {
      if (!id) return null;
      const cached = localStorage.getItem(`movie_status_${id}`);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState(!movie);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    "new_watched" | "update_watched" | null
  >(null);

  useEffect(() => {
    if (id) {
      if (!movie || movie.id !== Number(id)) {
        setIsLoading(true);
      }
      fetchData(Number(id));
    }
  }, [id, mediaType]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchData = async (tmdbId: number) => {
    try {
      const [detailsRes, statusRes] = await Promise.all([
        api.get(`/movies/${tmdbId}/details?type=${mediaType}`),
        api.get(`/movies/${tmdbId}/status`),
      ]);

      setMovie(detailsRes.data);
      setStatus(statusRes.data ? statusRes.data : null);

      localStorage.setItem(
        `movie_details_${tmdbId}_${mediaType}`,
        JSON.stringify(detailsRes.data),
      );
      if (statusRes.data) {
        localStorage.setItem(
          `movie_status_${tmdbId}`,
          JSON.stringify(statusRes.data),
        );
      } else {
        localStorage.removeItem(`movie_status_${tmdbId}`);
      }
    } catch {
      showToast("Failed to load movie details.");
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
        mediaType: mediaType,
      });

      if (initialRating) {
        await api.patch(`/movies/watchlist/${movie.id}/rate`, {
          rating: initialRating,
        });
        showToast("Added to Watched and rated!");
      } else if (markWatched) {
        await api.post(`/movies/watchlist/${movie.id}/watched`);
        showToast("Marked as Watched!");
      } else {
        showToast("Added to Watchlist!");
      }

      fetchData(movie.id);
    } catch {
      showToast("Error updating movie.");
    }
  };

  const handleMarkWatched = async () => {
    if (!movie) return;
    try {
      await api.post(`/movies/watchlist/${movie.id}/watched`);
      showToast("Marked as Watched!");
      fetchData(movie.id);
    } catch {
      showToast("Error updating status.");
    }
  };

  const handleToggleFavorite = async () => {
    if (!movie || !status) return;
    try {
      await api.patch(`/movies/watchlist/${movie.id}/favorite`);
      const newStatus = { ...status, isFavorite: !status.isFavorite };
      updateStatusCache(newStatus);
      showToast("Favorite status updated");
    } catch {
      showToast("Failed to update favorite status");
    }
  };

  const handleRate = async (clickedStar: number) => {
    if (!movie) return;
    const newRating = status?.rating === clickedStar ? 0 : clickedStar;

    try {
      await api.patch(`/movies/watchlist/${movie.id}/rate`, {
        rating: newRating,
      });
      showToast(newRating === 0 ? "Rating cleared!" : "Rating saved!");
      fetchData(movie.id);
    } catch {
      showToast("Error saving rating.");
    }
  };

  const handleRemove = async () => {
    if (!movie) return;
    try {
      await api.delete(`/movies/watchlist/${movie.id}`);
      showToast("Removed from your list.");
      updateStatusCache(null);
    } catch {
      showToast("Error removing movie.");
    }
  };

  const handleModalRate = async (star: number) => {
    setIsRatingModalOpen(false);
    if (pendingAction === "new_watched") {
      await handleAddNewMovie(true, star);
    } else if (pendingAction === "update_watched") {
      await handleRate(star);
    }
    setPendingAction(null);
  };

  const handleModalSkip = async () => {
    setIsRatingModalOpen(false);
    if (pendingAction === "new_watched") {
      await handleAddNewMovie(true, null);
    } else if (pendingAction === "update_watched") {
      await handleMarkWatched();
    }
    setPendingAction(null);
  };

  const handleModalCancel = () => {
    setIsRatingModalOpen(false);
    setPendingAction(null);
  };

  if (isLoading)
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex gap-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"></div>
          <div
            className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"
            style={{ animationDelay: "0.1s" }}
          ></div>
          <div
            className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"
            style={{ animationDelay: "0.2s" }}
          ></div>
        </div>
      </div>
    );

  if (!movie)
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <p className="text-gray-400 text-xl italic">Movie not found.</p>
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
      <header className="flex flex-col sm:flex-row items-center justify-between p-4 sm:p-6 gap-4 border-b border-gray-800 bg-gray-900/80 backdrop-blur-md sticky top-0 z-40">
        <Link
          to="/search"
          className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent"
        >
          Movie Tracker
        </Link>
        <button
          onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-white transition font-bold text-sm sm:text-base"
        >
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
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent"></div>
          </>
        )}
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 -mt-24 sm:-mt-32 relative z-10 flex flex-col md:flex-row gap-6 md:gap-10">
        <div className="flex-shrink-0 mx-auto md:mx-0 w-44 sm:w-64">
          {posterUrl ? (
            <img
              src={posterUrl}
              alt={movie.title}
              className="w-full rounded-2xl shadow-2xl border border-gray-700"
            />
          ) : (
            <div className="w-full h-64 sm:h-96 bg-gray-800 rounded-2xl flex items-center justify-center border border-gray-700 text-gray-500 italic">
              No poster
            </div>
          )}
        </div>

        <div className="flex-grow flex flex-col pt-2 md:pt-32 text-center md:text-left">
          <h1 className="text-3xl sm:text-5xl font-bold text-white mb-3">
            {movie.title}
            <span className="ml-3 inline-block px-2 py-1 bg-gray-800 border border-gray-700 rounded-lg text-sm sm:text-base align-middle text-gray-400 font-normal">
              {mediaType === "tv" ? "TV SHOW" : "MOVIE"}
            </span>
          </h1>

          <div className="flex flex-wrap justify-center md:justify-start gap-3 sm:gap-4 text-xs sm:text-sm text-gray-400 mb-6 items-center">
            <span>{movie.release_date?.split("-")[0]}</span>
            <span>•</span>
            <span>{movie.runtime || "?"} min</span>
            <span>•</span>
            <span className="flex items-center gap-1 text-yellow-500 font-bold">
              IMBD: {movie.vote_average?.toFixed(1) || "0.0"}
            </span>
            <div className="flex gap-2 flex-wrap justify-center md:justify-start">
              {movie.genres?.map((g) => (
                <span
                  key={g.id}
                  className="bg-gray-800 px-2 py-1 rounded-md border border-gray-700 text-[10px] sm:text-xs"
                >
                  {g.name}
                </span>
              ))}
            </div>
          </div>

          <p className="text-gray-300 text-sm sm:text-lg leading-relaxed mb-8 max-w-3xl">
            {movie.overview || "No overview available."}
          </p>

          <div className="bg-gray-800/60 border border-gray-700 p-5 sm:p-7 rounded-3xl w-full max-w-lg mx-auto md:mx-0 shadow-2xl backdrop-blur-sm">
            <h3 className="text-md sm:text-lg font-bold text-white mb-5 uppercase tracking-wider">
              Your Progress
            </h3>

            {!status ? (
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => handleAddNewMovie(false)}
                  className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition active:scale-95 text-sm"
                >
                  Watchlist
                </button>
                <button
                  onClick={() => {
                    setPendingAction("new_watched");
                    setIsRatingModalOpen(true);
                  }}
                  className="flex-1 py-3.5 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition active:scale-95 text-sm"
                >
                  Watched
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                  <span
                    className={`border px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest ${status.isWatched ? "bg-green-500/10 text-green-400 border-green-500/30" : "bg-blue-500/10 text-blue-400 border-blue-500/30"}`}
                  >
                    {status.isWatched ? "Status: Watched" : "Status: In Plans"}
                  </span>

                  {!status.isWatched && (
                    <button
                      onClick={() => {
                        setPendingAction("update_watched");
                        setIsRatingModalOpen(true);
                      }}
                      className="text-xs px-4 py-2 bg-gray-700 hover:bg-green-600 text-white font-bold rounded-xl transition border border-gray-600"
                    >
                      Mark as Watched
                    </button>
                  )}

                  <button
                    onClick={handleRemove}
                    className="text-xs px-4 py-2 bg-red-900/20 text-red-400 hover:bg-red-600 hover:text-white font-bold rounded-xl transition"
                  >
                    Remove
                  </button>

                  <button
                    onClick={handleToggleFavorite}
                    className={`flex items-center justify-center w-8 h-8 rounded-full transition group/heart ${
                      status.isFavorite
                        ? "bg-red-500/20"
                        : "bg-gray-700 hover:bg-gray-600"
                    }`}
                  >
                    <svg
                      className={`w-4 h-4 transition ${
                        status.isFavorite
                          ? "text-red-500 fill-red-500"
                          : "text-gray-400 group-hover/heart:text-red-500"
                      }`}
                      fill={status.isFavorite ? "currentColor" : "none"}
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                      ></path>
                    </svg>
                  </button>
                </div>

                <div className="pt-2">
                  <p className="text-xs text-gray-500 mb-3 uppercase font-semibold tracking-tighter">
                    Personal Rating:
                  </p>
                  <div className="flex justify-center md:justify-start gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => handleRate(star)}
                        className={`text-3xl sm:text-4xl transition-all hover:scale-125 ${(status.rating || 0) >= star ? "text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.3)]" : "text-gray-700 hover:text-yellow-400/40"}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {isRatingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-gray-800 border border-gray-700 p-8 rounded-[2rem] shadow-2xl max-w-sm w-full text-center relative animate-in zoom-in-95">
            <button
              onClick={handleModalCancel}
              className="absolute top-5 right-6 text-gray-500 hover:text-white text-xl transition"
            >
              ✕
            </button>
            <h3 className="text-2xl font-bold text-white mb-2">How was it?</h3>
            <p className="text-gray-400 mb-8 text-sm px-4">
              Rate "{movie.title}" or skip to just mark as watched.
            </p>
            <div className="flex justify-center gap-2 mb-8">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => handleModalRate(star)}
                  className="text-4xl text-gray-700 hover:text-yellow-400 transition-transform hover:scale-125"
                >
                  ★
                </button>
              ))}
            </div>
            <button
              onClick={handleModalSkip}
              className="text-gray-500 hover:text-blue-400 transition text-xs font-bold uppercase tracking-widest"
            >
              Skip Rating
            </button>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-5 left-5 right-5 sm:left-auto sm:right-10 sm:bottom-10 bg-gray-800 border border-gray-700 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center justify-center sm:justify-start gap-3 animate-in slide-in-from-bottom-5 z-[60]">
          <span className="font-bold text-sm">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

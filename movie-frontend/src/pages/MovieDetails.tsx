import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
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
}

interface UserMovieStatus {
  id: number;
  isWatched: boolean;
  rating: number | null;
}

export default function MovieDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [movie, setMovie] = useState<MovieDetailsData | null>(null);
  const [status, setStatus] = useState<UserMovieStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    "new_watched" | "update_watched" | null
  >(null);

  useEffect(() => {
    if (id) {
      fetchData(Number(id));
    }
  }, [id]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchData = async (tmdbId: number) => {
    setIsLoading(true);
    try {
      const [detailsRes, statusRes] = await Promise.all([
        api.get(`/movies/${tmdbId}/details`),
        api.get(`/movies/${tmdbId}/status`),
      ]);
      setMovie(detailsRes.data);
      setStatus(statusRes.data ? statusRes.data : null);
    } catch (error) {
      showToast("Failed to load movie details.");
    } finally {
      setIsLoading(false);
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
    } catch (error) {
      showToast("Error updating movie.");
    }
  };

  const handleMarkWatched = async () => {
    if (!movie) return;
    try {
      await api.post(`/movies/watchlist/${movie.id}/watched`);
      showToast("Marked as Watched!");
      fetchData(movie.id);
    } catch (error) {
      showToast("Error updating status.");
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
    } catch (error) {
      showToast("Error saving rating.");
    }
  };
  const handleRemove = async () => {
    if (!movie) return;
    try {
      await api.delete(`/movies/watchlist/${movie.id}`);
      showToast("Removed from your list.");
      setStatus(null);
    } catch (error) {
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
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        Loading...
      </div>
    );
  if (!movie)
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        Movie not found.
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
      <header className="flex items-center justify-between p-6 border-b border-gray-800 bg-gray-900/80 backdrop-blur-md sticky top-0 z-40">
        <Link
          to="/search"
          className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent"
        >
          Movie Tracker 🎬
        </Link>
        <button
          onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-white transition font-bold"
        >
          ← Back
        </button>
      </header>

      <div className="relative w-full h-[40vh] sm:h-[50vh] bg-gray-800">
        {backdropUrl && (
          <>
            <img
              src={backdropUrl}
              alt="Backdrop"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/60 to-transparent"></div>
          </>
        )}
      </div>

      <div className="max-w-5xl mx-auto px-6 -mt-32 relative z-10 flex flex-col md:flex-row gap-8">
        <div className="flex-shrink-0 mx-auto md:mx-0 w-48 sm:w-64">
          {posterUrl ? (
            <img
              src={posterUrl}
              alt={movie.title}
              className="w-full rounded-2xl shadow-2xl border border-gray-700"
            />
          ) : (
            <div className="w-full h-96 bg-gray-800 rounded-2xl flex items-center justify-center border border-gray-700">
              No poster
            </div>
          )}
        </div>

        <div className="flex-grow flex flex-col pt-4 md:pt-32">
          <h1 className="text-4xl font-bold text-white mb-2">{movie.title}</h1>
          <div className="flex flex-wrap gap-4 text-sm text-gray-400 mb-6 items-center">
            <span>{movie.release_date?.split("-")[0]}</span>
            <span>•</span>
            <span>{movie.runtime} min</span>
            <span>•</span>
            <span className="flex items-center gap-1 text-yellow-500 font-bold">
              ⭐ {movie.vote_average.toFixed(1)}
            </span>
            <span>•</span>
            <div className="flex gap-2 flex-wrap">
              {movie.genres.map((g) => (
                <span
                  key={g.id}
                  className="bg-gray-800 px-3 py-1 rounded-md border border-gray-700"
                >
                  {g.name}
                </span>
              ))}
            </div>
          </div>

          <p className="text-gray-300 text-lg leading-relaxed mb-8">
            {movie.overview}
          </p>

          <div className="bg-gray-800/60 border border-gray-700 p-6 rounded-2xl max-w-lg shadow-xl">
            <h3 className="text-lg font-bold text-white mb-5">Your List</h3>

            {!status ? (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => handleAddNewMovie(false)}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition active:scale-95 shadow-md"
                  >
                    + Watchlist
                  </button>
                  <button
                    onClick={() => {
                      setPendingAction("new_watched");
                      setIsRatingModalOpen(true);
                    }}
                    className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl transition active:scale-95 shadow-md"
                  >
                    ✓ Watched
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`border px-4 py-2 rounded-lg font-bold ${status.isWatched ? "bg-green-500/20 text-green-400 border-green-500/50" : "bg-blue-500/20 text-blue-400 border-blue-500/50"}`}
                  >
                    {status.isWatched ? "Watched" : "📌 In Plans"}
                  </span>

                  {!status.isWatched && (
                    <button
                      onClick={() => {
                        setPendingAction("update_watched");
                        setIsRatingModalOpen(true);
                      }}
                      className="text-sm px-4 py-2 bg-gray-700 hover:bg-green-600 text-white font-bold rounded-lg transition border border-gray-600"
                    >
                      ✓ Mark as Watched
                    </button>
                  )}

                  <button
                    onClick={handleRemove}
                    className="text-sm px-4 py-2 bg-red-900/30 text-red-400 hover:bg-red-600 hover:text-white font-bold rounded-lg transition"
                  >
                    Remove
                  </button>
                </div>

                <div className="pt-2">
                  <p className="text-sm text-gray-400 mb-2">Your Rating:</p>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => handleRate(star)}
                        className={`text-3xl transition-transform hover:scale-125 ${
                          (status.rating || 0) >= star
                            ? "text-yellow-400"
                            : "text-gray-600 hover:text-yellow-400/50"
                        }`}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-gray-800 border border-gray-700 p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center relative animate-in zoom-in-95 duration-300">
            <button
              onClick={handleModalCancel}
              className="absolute top-4 right-5 text-gray-500 hover:text-white text-xl transition"
            >
              ✕
            </button>

            <h3 className="text-2xl font-bold text-white mb-2">
              Rate this movie
            </h3>
            <p className="text-gray-400 mb-8 text-sm">
              How many stars would you give "{movie.title}"?
            </p>

            <div className="flex justify-center gap-2 mb-8">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => handleModalRate(star)}
                  className="text-4xl text-gray-600 hover:text-yellow-400 transition-transform hover:scale-125"
                >
                  ★
                </button>
              ))}
            </div>

            <button
              onClick={handleModalSkip}
              className="text-gray-500 hover:text-white transition text-sm underline underline-offset-4"
            >
              Skip and just mark as watched
            </button>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-10 right-10 bg-gray-800 border border-gray-700 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 fade-in duration-300 z-[60]">
          <span className="font-semibold">{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

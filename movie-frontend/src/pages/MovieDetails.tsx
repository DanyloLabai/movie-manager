import { useEffect, useRef, useState } from "react";
import {
  useParams,
  useNavigate,
  Link,
  useSearchParams,
} from "react-router-dom";
import { api } from "../api";
import LogoImg from "../assets/logo.png";

interface WatchProvider {
  provider_id: number;
  provider_name: string;
  logo_path: string;
}

interface WatchProvidersData {
  link?: string;
  flatrate?: WatchProvider[];
  rent?: WatchProvider[];
  buy?: WatchProvider[];
}

interface CastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
}

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
  watchProviders?: WatchProvidersData;
  productionCountries?: string[];
  cast?: CastMember[];
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

      setHoveredStar(0);
      setModalHoveredStar(0);
      setIsRatingModalOpen(false);
      setPendingAction(null);

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
        releaseDate: movie.release_date,
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
      setHoveredStar(0);
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
    setModalHoveredStar(0);
    if (pendingAction === "new_watched") await handleAddNewMovie(true, star);
    else if (pendingAction === "update_watched") await handleRate(star);
    setPendingAction(null);
  };

  const handleModalSkip = async () => {
    setIsRatingModalOpen(false);
    setModalHoveredStar(0);
    if (pendingAction === "new_watched") await handleAddNewMovie(true, null);
    else if (pendingAction === "update_watched") await handleMarkWatched();
    setPendingAction(null);
  };

  const isReleased = (dateStr?: string) => {
    if (!dateStr) return true;
    return new Date(dateStr) <= new Date();
  };

  if (isLoading)
    return (
      <div className="min-h-screen bg-[#12100e] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#c8963c] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );

  if (!movie)
    return (
      <div className="min-h-screen bg-[#12100e] text-[#f0e6cc] flex items-center justify-center">
        <Link to="/search" className="text-[#c8963c] font-bold hover:underline">
          Movie not found. Back to Search
        </Link>
      </div>
    );

  const released = isReleased(movie.release_date);

  const posterUrl = movie.poster_path
    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
    : null;
  const backdropUrl = movie.backdrop_path
    ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}`
    : null;

  return (
    <div className="min-h-[100dvh] bg-[#12100e] font-sans text-[#f0e6cc] relative pb-24 overscroll-none selection:bg-[#c8963c] selection:text-[#12100e]">
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-[#c8963c]/20 bg-[#12100e]/90 backdrop-blur-md sticky top-0 z-40 shadow-lg shadow-[#c8963c]/5 pt-[env(safe-area-inset-top,12px)]">
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
              Movie Tracker
            </span>
          </div>
        </Link>
        <button
          onClick={() => {
            const fromTab = searchParams.get("fromTab");
            if (fromTab) {
              navigate(`/watchlist?tab=${fromTab}`);
            } else {
              navigate(-1);
            }
          }}
          className="flex items-center gap-1.5 text-xs font-black uppercase text-[#f0e6cc]/50 hover:text-[#c8963c] transition active:scale-95"
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

      <div className="relative w-full h-[35vh] sm:h-[50vh] bg-[#1a1714]">
        {backdropUrl && (
          <>
            <img
              src={backdropUrl}
              alt="Backdrop"
              className="w-full h-full object-cover opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#12100e] via-[#12100e]/50 to-transparent" />
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
                className="w-full rounded-2xl shadow-2xl border border-[#c8963c]/30"
              />
            ) : (
              <div className="w-full aspect-[2/3] rounded-2xl bg-[#1a1714] border border-[#c8963c]/20" />
            )}
          </div>

          <div className="flex-1 min-w-0 pb-1">
            <span className="inline-block mb-2 px-2 py-0.5 bg-[#1a1714] border border-[#c8963c]/30 rounded-md text-[9px] text-[#f0e6cc]/60 font-black uppercase tracking-widest">
              {mediaType === "tv" ? "TV Show" : "Movie"}
            </span>
            <h1 className="text-xl font-black text-[#f0e6cc] tracking-tight leading-tight mb-2 line-clamp-3">
              {movie.title}
            </h1>
            <div className="flex flex-wrap gap-2 text-[10px] text-[#f0e6cc]/60 font-bold items-center">
              <span className="text-[#f0e6cc]">
                {movie.release_date?.split("-")[0]}
              </span>
              <span className="text-[#c8963c]/50">•</span>
              <span>{movie.runtime || "0"} min</span>
              {released && (
                <span className="text-[#c8963c] px-2 py-0.5 bg-[#c8963c]/10 rounded-md border border-[#c8963c]/20 font-black">
                  ★ {movie.vote_average?.toFixed(1)}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {movie.genres?.slice(0, 3).map((g) => (
                <span
                  key={g.id}
                  className="text-[9px] text-[#f0e6cc]/50 uppercase tracking-widest font-black"
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
              <div className="absolute -inset-1 bg-gradient-to-b from-[#c8963c]/20 to-[#9a732a]/20 rounded-[2.5rem] blur-xl opacity-50 group-hover:opacity-100 transition duration-1000" />
              <img
                src={posterUrl || ""}
                alt={movie.title}
                className="relative w-full rounded-[2rem] shadow-2xl border border-[#c8963c]/30 bg-[#1a1714] transition-transform duration-500 group-hover:scale-[1.02]"
              />
            </div>
            <ActionPanel
              status={status}
              hoveredStar={hoveredStar}
              setHoveredStar={setHoveredStar}
              released={released}
              onAddWatchlist={() => handleAddNewMovie(false)}
              onWatched={() => {
                setPendingAction("new_watched");
                setIsRatingModalOpen(true);
              }}
              onToggleFavorite={handleToggleFavorite}
              onRate={handleRate}
              onRemove={handleRemove}
            />

            {movie.watchProviders &&
              (movie.watchProviders.flatrate ||
                movie.watchProviders.rent ||
                movie.watchProviders.buy) && (
                <WatchProvidersBlock
                  providers={movie.watchProviders}
                  movieTitle={movie.title}
                />
              )}
          </div>

          <div className="col-span-8 lg:col-span-9 flex flex-col pt-32 md:pt-40">
            <h1 className="text-4xl sm:text-6xl font-black text-[#f0e6cc] mb-4 tracking-tighter">
              {movie.title}
              <span className="ml-4 inline-block px-2.5 py-1 bg-[#1a1714] border border-[#c8963c]/30 rounded-lg text-xs align-middle text-[#f0e6cc]/60 font-bold uppercase tracking-widest">
                {mediaType === "tv" ? "TV SHOW" : "MOVIE"}
              </span>
            </h1>

            <div className="flex flex-col gap-3 mb-8">
              <div className="flex flex-wrap gap-4 text-xs sm:text-sm text-[#f0e6cc]/60 items-center font-bold">
                <span className="text-[#f0e6cc]">
                  {movie.release_date
                    ? new Date(movie.release_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "N/A"}
                </span>
                <span className="w-1.5 h-1.5 bg-[#c8963c]/50 rounded-full" />
                <span>{movie.runtime || "0"} min</span>
                {released && (
                  <>
                    <span className="w-1.5 h-1.5 bg-[#c8963c]/50 rounded-full" />
                    <span className="text-[#c8963c] px-2 py-1 bg-[#c8963c]/10 rounded-lg border border-[#c8963c]/20 tracking-tighter font-black">
                      IMDB: {movie.vote_average?.toFixed(1)}
                    </span>
                  </>
                )}
                <div className="flex gap-2">
                  {movie.genres?.slice(0, 3).map((g) => (
                    <span
                      key={g.id}
                      className="text-[10px] text-[#f0e6cc]/50 uppercase tracking-widest"
                    >
                      {g.name}
                    </span>
                  ))}
                </div>
              </div>

              {movie.productionCountries &&
                movie.productionCountries.length > 0 && (
                  <div className="flex items-center gap-2 text-xs font-bold text-[#f0e6cc]/70">
                    <span title="Production Countries">🌎</span>
                    <span>{movie.productionCountries.join(", ")}</span>
                  </div>
                )}
            </div>

            <p className="text-[#f0e6cc]/80 text-base sm:text-lg leading-relaxed mb-12 max-w-4xl font-medium">
              {movie.overview}
            </p>

            {movie.cast && movie.cast.length > 0 && (
              <CastBlock cast={movie.cast} />
            )}

            {movie.trailerUrl && <TrailerBlock trailerUrl={movie.trailerUrl} />}
          </div>
        </div>

        <div className="sm:hidden mt-4 flex flex-col gap-4">
          {movie.productionCountries &&
            movie.productionCountries.length > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#f0e6cc]/70 bg-[#1a1714] border border-[#c8963c]/20 px-3 py-1.5 rounded-lg w-fit">
                <span title="Production Countries">🌎</span>
                <span>{movie.productionCountries.join(", ")}</span>
              </div>
            )}

          <p className="text-[#f0e6cc]/80 text-sm leading-relaxed font-medium">
            {movie.overview}
          </p>

          <div className="bg-[#1a1714]/80 border border-[#c8963c]/20 p-4 rounded-3xl shadow-xl backdrop-blur-md">
            {!status ? (
              <div className="flex gap-3">
                <button
                  onClick={() => handleAddNewMovie(false)}
                  className={`py-3 bg-[#12100e] border border-[#c8963c]/30 text-[#c8963c] rounded-2xl font-black text-[11px] uppercase tracking-wider hover:bg-[#c8963c]/10 transition active:scale-95 shadow-lg ${released ? "flex-1" : "w-full"}`}
                >
                  {released ? "+ Add" : "+ Add"}
                </button>
                {released && (
                  <button
                    onClick={() => {
                      setPendingAction("new_watched");
                      setIsRatingModalOpen(true);
                    }}
                    className="flex-1 py-3 bg-[#c8963c] text-[#12100e] rounded-2xl font-black text-[11px] uppercase tracking-wider hover:bg-[#e8c070] transition active:scale-95 shadow-lg"
                  >
                    ✓ Watched
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                      status.isWatched
                        ? "text-[#c8963c] bg-[#c8963c]/10 border-[#c8963c]/30"
                        : "text-[#f0e6cc]/60 bg-[#12100e] border-[#c8963c]/20"
                    }`}
                  >
                    {status.isWatched ? "✓ Watched" : "⋯ In Plans"}
                  </span>

                  {released ? (
                    <button
                      onClick={handleToggleFavorite}
                      className={`p-2.5 rounded-xl transition active:scale-90 border ${
                        status.isFavorite
                          ? "bg-red-500/20 text-red-500 border-red-500/30 shadow-lg"
                          : "bg-[#12100e] text-[#f0e6cc]/30 border-[#c8963c]/20 hover:text-red-500"
                      }`}
                    >
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                      </svg>
                    </button>
                  ) : (
                    <div
                      className="p-2.5 rounded-xl bg-[#12100e] text-[#c8963c] border border-[#c8963c]/20"
                      title="Not released yet"
                    >
                      ⏳
                    </div>
                  )}
                </div>

                {released && (
                  <div>
                    <p className="text-[9px] font-black text-[#f0e6cc]/50 mb-2 uppercase tracking-widest">
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
                          className={`text-3xl transition-all duration-150 active:scale-90 ${
                            (hoveredStar || status.rating || 0) >= s
                              ? "text-[#c8963c] drop-shadow-[0_0_8px_rgba(200,150,60,0.5)]"
                              : "text-[#f0e6cc]/20 hover:text-[#c8963c]/50"
                          }`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleRemove}
                  className="w-full py-2 bg-red-900/20 text-red-500 rounded-xl text-[9px] font-black uppercase tracking-widest border border-red-500/30 hover:bg-red-600 hover:text-[#f0e6cc] transition active:scale-95"
                >
                  Remove from list
                </button>
              </div>
            )}
          </div>

          {movie.cast && movie.cast.length > 0 && (
            <CastBlock cast={movie.cast} />
          )}

          {movie.watchProviders &&
            (movie.watchProviders.flatrate ||
              movie.watchProviders.rent ||
              movie.watchProviders.buy) && (
              <WatchProvidersBlock
                providers={movie.watchProviders}
                movieTitle={movie.title}
              />
            )}

          {movie.trailerUrl && (
            <div className="mt-2">
              <div className="flex items-center gap-3 mb-3">
                <h3 className="text-sm font-black text-[#f0e6cc] uppercase tracking-widest italic">
                  Trailer
                </h3>
                <div className="h-px flex-grow bg-gradient-to-r from-[#c8963c]/30 to-transparent" />
              </div>
              <div className="relative aspect-video rounded-2xl overflow-hidden border border-[#c8963c]/30 bg-[#12100e] shadow-xl">
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

      {/* Recommendations Slider */}
      {recommendations.length > 0 && (
        <div className="mt-10 sm:mt-20 max-w-7xl mx-auto">
          <div className="flex items-center justify-between px-4 sm:px-6 mb-4 sm:mb-8">
            <div className="flex items-center gap-4">
              <h3 className="text-lg sm:text-2xl font-black text-[#f0e6cc] uppercase tracking-tighter italic">
                More Like This
              </h3>
              <div className="hidden sm:block h-[1px] w-24 bg-[#c8963c]/20" />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => scrollSlider("left")}
                disabled={!canScrollLeft}
                className={`w-9 h-9 rounded-xl flex items-center justify-center border transition active:scale-90 ${
                  canScrollLeft
                    ? "bg-[#1a1714] border-[#c8963c]/30 text-[#c8963c] hover:bg-[#c8963c]/10"
                    : "bg-[#12100e] border-[#c8963c]/10 text-[#f0e6cc]/20 cursor-not-allowed"
                }`}
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
                className={`w-9 h-9 rounded-xl flex items-center justify-center border transition active:scale-90 ${
                  canScrollRight
                    ? "bg-[#1a1714] border-[#c8963c]/30 text-[#c8963c] hover:bg-[#c8963c]/10"
                    : "bg-[#12100e] border-[#c8963c]/10 text-[#f0e6cc]/20 cursor-not-allowed"
                }`}
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
                className="group flex-shrink-0 w-36 sm:w-44 snap-start bg-[#1a1714] rounded-2xl sm:rounded-[2rem] overflow-hidden border border-[#c8963c]/20 hover:border-[#c8963c]/70 transition-all duration-300 hover:-translate-y-1 shadow-lg"
              >
                <div className="aspect-[2/3] relative overflow-hidden">
                  {m.posterUrl ? (
                    <img
                      src={m.posterUrl}
                      alt={m.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#12100e] flex items-center justify-center text-[9px] text-[#f0e6cc]/30 font-bold uppercase tracking-widest">
                      No Image
                    </div>
                  )}
                </div>
                <div className="p-3 sm:p-4">
                  <h4 className="text-[10px] sm:text-xs font-bold text-[#f0e6cc] truncate group-hover:text-[#c8963c] transition-colors uppercase tracking-tight">
                    {m.title}
                  </h4>
                  <p className="text-[8px] sm:text-[9px] text-[#f0e6cc]/50 mt-0.5 font-black uppercase tracking-widest">
                    {m.releaseYear}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {isRatingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#12100e]/90 backdrop-blur-xl p-4">
          <div className="bg-[#1a1714] border border-[#c8963c]/30 p-8 sm:p-10 rounded-[2.5rem] sm:rounded-[3.5rem] shadow-2xl w-full max-w-sm text-center relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#c8963c] to-[#9a732a]" />
            <button
              onClick={() => {
                setIsRatingModalOpen(false);
                setModalHoveredStar(0);
              }}
              className="absolute top-5 right-6 text-[#f0e6cc]/50 hover:text-[#c8963c] transition text-xl active:scale-90"
            >
              ✕
            </button>
            <h3 className="text-xl sm:text-2xl font-black text-[#c8963c] mb-2 uppercase tracking-tighter">
              How was it?
            </h3>
            <p className="text-[#f0e6cc]/60 text-[10px] mb-8 uppercase tracking-[0.2em] font-bold px-4">
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
                  className={`text-4xl sm:text-5xl transition-all duration-150 active:scale-90 ${
                    modalHoveredStar >= s
                      ? "text-[#c8963c] drop-shadow-[0_0_12px_rgba(200,150,60,0.5)]"
                      : "text-[#f0e6cc]/20"
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
            <button
              onClick={handleModalSkip}
              className="text-[10px] text-[#f0e6cc]/50 hover:text-[#c8963c] transition font-black uppercase tracking-[0.3em] border-b border-transparent hover:border-[#c8963c]/50 pb-1"
            >
              Skip Rating
            </button>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-10 sm:w-auto bg-[#1a1714] border border-[#c8963c]/50 text-[#c8963c] px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 z-[60] backdrop-blur-md">
          <div className="w-1.5 h-1.5 bg-[#c8963c] rounded-full animate-pulse flex-shrink-0" />
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
  released,
  onAddWatchlist,
  onWatched,
  onToggleFavorite,
  onRate,
  onRemove,
}: {
  status: UserMovieStatus | null;
  hoveredStar: number;
  setHoveredStar: (n: number) => void;
  released: boolean;
  onAddWatchlist: () => void;
  onWatched: () => void;
  onToggleFavorite: () => void;
  onRate: (s: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="bg-[#1a1714] border border-[#c8963c]/20 p-6 rounded-[2rem] shadow-2xl backdrop-blur-md">
      {!status ? (
        <div className="flex flex-col gap-3">
          <button
            onClick={onAddWatchlist}
            className="w-full py-3.5 bg-[#12100e] border border-[#c8963c]/30 text-[#c8963c] rounded-2xl font-black text-[10px] uppercase tracking-wider hover:bg-[#c8963c]/10 transition active:scale-95 shadow-lg"
          >
            {released ? "Add" : "Add"}
          </button>

          {released && (
            <button
              onClick={onWatched}
              className="w-full py-3.5 bg-[#c8963c] text-[#12100e] rounded-2xl font-black text-[10px] uppercase tracking-wider hover:bg-[#e8c070] transition active:scale-95 shadow-lg"
            >
              Watched
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <span
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border ${
                status.isWatched
                  ? "text-[#c8963c] bg-[#c8963c]/10 border-[#c8963c]/30"
                  : "text-[#f0e6cc]/60 bg-[#12100e] border-[#c8963c]/20"
              }`}
            >
              {status.isWatched ? "Watched" : "In Plans"}
            </span>

            {released ? (
              <button
                onClick={onToggleFavorite}
                className={`p-2.5 rounded-xl transition border ${
                  status.isFavorite
                    ? "bg-red-500/20 text-red-500 border-red-500/30 shadow-lg"
                    : "bg-[#12100e] text-[#f0e6cc]/30 border-[#c8963c]/20 hover:text-red-500"
                }`}
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              </button>
            ) : (
              <div
                className="p-2.5 rounded-xl bg-[#12100e] text-[#c8963c] border border-[#c8963c]/20"
                title="Not released yet"
              >
                ⏳
              </div>
            )}
          </div>

          {released && (
            <div className="pt-4 border-t border-[#c8963c]/20">
              <p className="text-[10px] font-black text-[#f0e6cc]/50 mb-3 uppercase tracking-widest">
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
                    className={`text-2xl transition-all duration-200 transform hover:scale-125 ${
                      (hoveredStar || status.rating || 0) >= s
                        ? "text-[#c8963c] drop-shadow-[0_0_8px_rgba(200,150,60,0.5)]"
                        : "text-[#f0e6cc]/20 hover:text-[#c8963c]/50"
                    }`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={onRemove}
            className="w-full py-2.5 bg-red-900/20 text-red-500 rounded-xl text-[9px] font-black uppercase tracking-widest border border-red-500/30 hover:bg-red-600 hover:text-[#f0e6cc] transition active:scale-95"
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
    <div className="w-full max-w-2xl mt-8">
      <div className="flex items-center gap-4 mb-6">
        <h3 className="text-lg font-black text-[#f0e6cc] uppercase tracking-widest italic">
          Trailer
        </h3>
        <div className="h-[1px] flex-grow bg-gradient-to-r from-[#c8963c]/30 to-transparent" />
      </div>
      <div className="relative group">
        <div className="absolute -inset-1 bg-[#c8963c]/10 rounded-[2rem] blur-xl opacity-0 group-hover:opacity-100 transition duration-700" />
        <div className="relative aspect-video rounded-[2rem] overflow-hidden border border-[#c8963c]/30 bg-[#12100e] shadow-2xl transition-transform duration-500 group-hover:scale-[1.01]">
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

function WatchProvidersBlock({
  providers,
  movieTitle,
}: {
  providers: WatchProvidersData;
  movieTitle: string;
}) {
  const defaultLink = providers.link;

  const getSmartLink = (providerName: string, title: string) => {
    const query = encodeURIComponent(title);
    const name = providerName.toLowerCase();

    if (name.includes("netflix"))
      return `https://www.netflix.com/search?q=${query}`;
    if (name.includes("amazon") || name.includes("prime"))
      return `https://www.primevideo.com/search/ref=atv_sr_sug_1?phrase=${query}`;
    if (name.includes("apple"))
      return `https://tv.apple.com/search?term=${query}`;
    if (name.includes("youtube"))
      return `https://www.youtube.com/results?search_query=${query}+movie`;
    if (name.includes("google play"))
      return `https://play.google.com/store/search?q=${query}&c=movies`;
    if (name.includes("megogo"))
      return `https://megogo.net/ua/search?q=${query}`;
    if (name.includes("sweet.tv")) return `https://sweet.tv/search?q=${query}`;
    if (name.includes("kyivstar") || name.includes("київстар"))
      return `https://tv.kyivstar.ua/ua/search?q=${query}`;
    if (name.includes("volia"))
      return `https://tv.volia.com/search?query=${query}`;

    return defaultLink || "#";
  };

  const renderProviderList = (title: string, list?: WatchProvider[]) => {
    if (!list || list.length === 0) return null;
    return (
      <div className="mb-4 last:mb-0">
        <h4 className="text-[9px] font-black text-[#c8963c]/70 uppercase tracking-[0.2em] mb-2">
          {title}
        </h4>
        <div className="flex flex-wrap gap-2">
          {list.map((p) => (
            <a
              key={p.provider_id}
              href={getSmartLink(p.provider_name, movieTitle)}
              target="_blank"
              rel="noopener noreferrer"
              title={`Watch on ${p.provider_name}`}
              className="block transition-transform hover:scale-110 hover:-translate-y-0.5"
            >
              <img
                src={`https://image.tmdb.org/t/p/w92${p.logo_path}`}
                alt={p.provider_name}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl shadow-md border border-[#c8963c]/20"
              />
            </a>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-[#1a1714] border border-[#c8963c]/20 p-5 rounded-[2rem] shadow-xl backdrop-blur-md w-full mt-6">
      <h3 className="text-xs font-black text-[#f0e6cc] uppercase tracking-widest mb-4">
        Where to Watch
      </h3>

      {renderProviderList("Stream", providers.flatrate)}
      {renderProviderList("Rent", providers.rent)}
      {renderProviderList("Buy", providers.buy)}

      {providers.link && (
        <div className="mt-2 pt-3 border-t border-[#c8963c]/10 text-center">
          <a
            href={providers.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[8px] text-[#f0e6cc]/40 hover:text-[#c8963c] transition-colors uppercase tracking-widest font-bold"
          >
            Powered by JustWatch &rarr;
          </a>
        </div>
      )}
    </div>
  );
}

function CastBlock({ cast }: { cast: CastMember[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo =
        direction === "left"
          ? scrollLeft - clientWidth / 2
          : scrollLeft + clientWidth / 2;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: "smooth" });
    }
  };

  return (
    <div className="w-full max-w-4xl mb-12">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4 flex-grow">
          <h3 className="text-lg font-black text-[#f0e6cc] uppercase tracking-widest italic">
            Top Cast
          </h3>
          <div className="h-[1px] flex-grow bg-gradient-to-r from-[#c8963c]/30 to-transparent max-w-[200px]" />
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => scroll("left")}
            className="w-7 h-7 rounded-full bg-[#1a1714] border border-[#c8963c]/30 text-[#c8963c] flex items-center justify-center hover:bg-[#c8963c]/10 active:scale-95 transition-all"
          >
            &larr;
          </button>
          <button
            onClick={() => scroll("right")}
            className="w-7 h-7 rounded-full bg-[#1a1714] border border-[#c8963c]/30 text-[#c8963c] flex items-center justify-center hover:bg-[#c8963c]/10 active:scale-95 transition-all"
          >
            &rarr;
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto scrollbar-hide snap-x pb-4"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {cast.map((actor) => (
          <Link
            key={actor.id}
            to={`/actor/${actor.id}`}
            className="flex-shrink-0 w-24 sm:w-28 snap-start group block cursor-pointer"
          >
            <div className="w-24 h-36 sm:w-28 sm:h-40 rounded-2xl overflow-hidden bg-[#1a1714] border border-[#c8963c]/20 mb-2 shadow-md group-hover:border-[#c8963c]/80 group-hover:shadow-[0_0_15px_rgba(200,150,60,0.2)] transition-all duration-300">
              {actor.profile_path ? (
                <img
                  src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`}
                  alt={actor.name}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-[#f0e6cc]/20">
                  <svg
                    className="w-8 h-8 mb-1"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
              )}
            </div>
            <p className="text-[10px] sm:text-xs font-bold text-[#f0e6cc] leading-tight truncate group-hover:text-[#c8963c] transition-colors">
              {actor.name}
            </p>
            <p
              className="text-[9px] text-[#c8963c]/70 truncate mt-0.5"
              title={actor.character}
            >
              {actor.character}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

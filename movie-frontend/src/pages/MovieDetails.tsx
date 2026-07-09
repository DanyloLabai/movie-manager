import { useEffect, useRef, useState } from "react";
import {
  useParams,
  useNavigate,
  Link,
  useSearchParams,
} from "react-router-dom";
import * as moviesApi from "../api/movies.api";
import LogoImg from "../assets/logo.png";
import { useLang } from "../context/LanguageContext";
import type {
  MovieDetails as MovieDetailsType,
  RecommendedMovie as RecommendedMovieType,
  UserMovieStatus as UserMovieStatusType,
  WatchProvider as WatchProviderType,
  WatchProvidersData as WatchProvidersDataType,
  CastMember as CastMemberType,
  FriendWatched as FriendWatchedType,
} from "../types/movie.types";

const TMDB_IMG = "https://image.tmdb.org/t/p";

const resolveImage = (
  path: string | null | undefined,
  size: string,
): string | null => {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${TMDB_IMG}/${size}${path}`;
};

const normalizeProviders = (
  raw: WatchProviderType[] | WatchProvidersDataType | null | undefined,
): WatchProvidersDataType | null => {
  if (!raw) return null;
  if (Array.isArray(raw)) return { flatrate: raw };
  return raw as WatchProvidersDataType;
};

export default function MovieDetails() {
  const { t } = useLang();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const mediaType = searchParams.get("type") || "movie";
  const navigate = useNavigate();

  const [movie, setMovie] = useState<MovieDetailsType | null>(null);
  const [status, setStatus] = useState<UserMovieStatusType | null>(null);
  const [recommendations, setRecommendations] = useState<
    RecommendedMovieType[]
  >([]);
  const [friendsWatched, setFriendsWatched] = useState<FriendWatchedType[]>(
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
    if (!id) return;
    const tmdbId = Number(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setMovie(null);
    setRecommendations([]);
    setFriendsWatched([]);
    setStatus(null);
    setIsLoading(true);
    setHoveredStar(0);
    setModalHoveredStar(0);
    setIsRatingModalOpen(false);
    setPendingAction(null);

    (async () => {
      try {
        const [details, statusRes, recs, friendsRes] = await Promise.all([
          (await import("../api/movies.api")).getMovieDetails(
            tmdbId,
            mediaType,
          ),
          (await import("../api/movies.api"))
            .getStatus(tmdbId)
            .catch(() => null),
          (await import("../api/movies.api"))
            .getSimilar(tmdbId, mediaType)
            .catch(() => []),
          (await import("../api/movies.api"))
            .getFriendsWatched(tmdbId, mediaType)
            .catch(() => []),
        ]);
        if (details) {
          setMovie(details);
          setStatus(statusRes ?? null);
          setRecommendations(recs ?? []);
          setFriendsWatched(friendsRes ?? []);
        }
      } catch {
        setMovie(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [id, mediaType]);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchData = async (tmdbId: number) => {
    try {
      const [details, statusRes, recs] = await Promise.all([
        moviesApi.getMovieDetails(tmdbId, mediaType),
        moviesApi.getStatus(tmdbId).catch(() => null),
        moviesApi.getSimilar(tmdbId, mediaType).catch(() => []),
      ]);
      if (details) {
        setMovie(details);
        setStatus(statusRes ?? null);
        setRecommendations(recs ?? []);
      }
    } catch {
      setMovie(null);
    } finally {
      setIsLoading(false);
    }
  };

  const updateStatusCache = (newStatus: UserMovieStatusType | null) => {
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
      const posterUrl = resolveImage(movie.posterPath, "w500");
      await moviesApi.addToWatchlist({
        tmdbId: movie.id,
        title: movie.title,
        posterUrl,
        mediaType,
        releaseDate: movie.releaseDate,
      });
      if (initialRating) {
        await moviesApi.rateMovie(movie.id, initialRating);
        showToast(t("movie_added_rated"));
      } else if (markWatched) {
        await moviesApi.markWatched(movie.id);
        showToast(t("movie_marked_watched"));
      } else {
        showToast(t("movie_added"));
      }
      fetchData(movie.id);
    } catch {
      showToast(t("movie_error_updating"));
    }
  };

  const handleMarkWatched = async () => {
    if (!movie) return;
    try {
      await moviesApi.markWatched(movie.id);
      showToast(t("movie_marked_watched"));
      fetchData(movie.id);
    } catch {
      showToast(t("movie_error"));
    }
  };

  const handleToggleFavorite = async () => {
    if (!movie || !status) return;
    try {
      await moviesApi.toggleFavorite(movie.id);
      updateStatusCache({ ...status, isFavorite: !status.isFavorite });
      showToast(t("movie_fav_updated"));
    } catch {
      showToast(t("movie_failed"));
    }
  };

  const handleRate = async (star: number) => {
    if (!movie) return;
    const newRating = status?.rating === star ? 0 : star;
    try {
      await moviesApi.rateMovie(movie.id, newRating);
      showToast(
        newRating === 0 ? t("movie_rating_cleared") : t("movie_rating_saved"),
      );
      setHoveredStar(0);
      fetchData(movie.id);
    } catch {
      showToast(t("movie_error"));
    }
  };

  const handleRemove = async () => {
    if (!movie) return;
    try {
      await moviesApi.removeFromWatchlist(movie.id);
      showToast(t("movie_removed"));
      updateStatusCache(null);
    } catch {
      showToast(t("movie_error"));
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

  const isReleased = (dateStr?: string | null) => {
    if (!dateStr) return true;
    return new Date(dateStr) <= new Date();
  };

  if (isLoading)
    return (
      <div className="min-h-screen bg-[#12100e] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#c8963c] border-t-transparent rounded-full animate-spin" />
      </div>
    );

  if (!movie)
    return (
      <div className="min-h-screen bg-[#12100e] text-[#f0e6cc] flex items-center justify-center">
        <Link to="/search" className="text-[#c8963c] font-bold hover:underline">
          {t("movie_not_found")}
        </Link>
      </div>
    );

  const released = isReleased(movie.releaseDate);
  const posterUrl = resolveImage(movie.posterPath, "w500");
  const backdropUrl = resolveImage(movie.backdropPath, "original");
  const providers = normalizeProviders(movie.watchProviders);
  const hasProviders =
    providers && (providers.flatrate || providers.rent || providers.buy);

  const releaseYear = movie.releaseDate?.split("-")[0] ?? t("common_na");
  const releaseDateFormatted = movie.releaseDate
    ? new Date(movie.releaseDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : t("common_na");

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
              {t("app_tagline")}
            </span>
          </div>
        </Link>
        <button
          onClick={() => {
            const fromTab = searchParams.get("fromTab");
            if (fromTab) navigate(`/watchlist?tab=${fromTab}`);
            else navigate(-1);
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
          {t("common_back")}
        </button>
      </header>

      {/* Backdrop */}
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
        {/* Mobile header */}
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
              {mediaType === "tv" ? t("common_tv") : t("common_movie")}
            </span>
            <h1 className="text-xl font-black text-[#f0e6cc] tracking-tight leading-tight mb-2 line-clamp-3">
              {movie.title}
            </h1>
            <div className="flex flex-wrap gap-2 text-[10px] text-[#f0e6cc]/60 font-bold items-center">
              <span className="text-[#f0e6cc]">{releaseYear}</span>
              <span className="text-[#c8963c]/50">•</span>
              <span>
                {movie.runtime || "0"} {t("stats_min")}
              </span>
              {released && (
                <span className="text-[#c8963c] px-2 py-0.5 bg-[#c8963c]/10 rounded-md border border-[#c8963c]/20 font-black">
                  ★ {movie.voteAverage?.toFixed(1)}
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

        {/* Desktop layout */}
        <div className="hidden sm:grid grid-cols-12 gap-8 lg:gap-12">
          <div className="col-span-4 lg:col-span-3 flex flex-col gap-6">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-b from-[#c8963c]/20 to-[#9a732a]/20 rounded-[2.5rem] blur-xl opacity-50 group-hover:opacity-100 transition duration-1000" />
              {posterUrl ? (
                <img
                  src={posterUrl}
                  alt={movie.title}
                  className="relative w-full rounded-[2rem] shadow-2xl border border-[#c8963c]/30 bg-[#1a1714] transition-transform duration-500 group-hover:scale-[1.02]"
                />
              ) : (
                <div className="w-full aspect-[2/3] rounded-[2rem] bg-[#1a1714] border border-[#c8963c]/20" />
              )}
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

            {hasProviders && (
              <WatchProvidersBlock
                providers={providers!}
                movieTitle={movie.title}
              />
            )}
          </div>

          <div className="col-span-8 lg:col-span-9 flex flex-col pt-32 md:pt-40">
            <h1 className="text-4xl sm:text-6xl font-black text-[#f0e6cc] mb-4 tracking-tighter">
              {movie.title}
              <span className="ml-4 inline-block px-2.5 py-1 bg-[#1a1714] border border-[#c8963c]/30 rounded-lg text-xs align-middle text-[#f0e6cc]/60 font-bold uppercase tracking-widest">
                {mediaType === "tv"
                  ? t("common_tv").toUpperCase()
                  : t("common_movie").toUpperCase()}
              </span>
            </h1>

            <div className="flex flex-col gap-3 mb-8">
              <div className="flex flex-wrap gap-4 text-xs sm:text-sm text-[#f0e6cc]/60 items-center font-bold">
                <span className="text-[#f0e6cc]">{releaseDateFormatted}</span>
                <span className="w-1.5 h-1.5 bg-[#c8963c]/50 rounded-full" />
                <span>
                  {movie.runtime || "0"} {t("stats_min")}
                </span>
                {released && (
                  <>
                    <span className="w-1.5 h-1.5 bg-[#c8963c]/50 rounded-full" />
                    <span className="text-[#c8963c] px-2 py-1 bg-[#c8963c]/10 rounded-lg border border-[#c8963c]/20 tracking-tighter font-black">
                      {t("movie_imdb")} {movie.voteAverage?.toFixed(1)}
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
                    <svg
                      className="w-4 h-4 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      title={t("movie_production_countries")}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
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

        {/* Mobile content */}
        <div className="sm:hidden mt-4 flex flex-col gap-4">
          {movie.productionCountries &&
            movie.productionCountries.length > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#f0e6cc]/70 bg-[#1a1714] border border-[#c8963c]/20 px-3 py-1.5 rounded-lg w-fit">
                <svg
                      className="w-4 h-4 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      title={t("movie_production_countries")}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
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
                  + {t("search_add")}
                </button>
                {released && (
                  <button
                    onClick={() => {
                      setPendingAction("new_watched");
                      setIsRatingModalOpen(true);
                    }}
                    className="flex-1 py-3 bg-[#c8963c] text-[#12100e] rounded-2xl font-black text-[11px] uppercase tracking-wider hover:bg-[#e8c070] transition active:scale-95 shadow-lg"
                  >
                    ✓ {t("watchlist_watched")}
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
                    {status.isWatched
                      ? `✓ ${t("watchlist_watched")}`
                      : t("movie_planned")}
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
                      title={t("common_unreleased")}
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
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                  )}
                </div>

                {released && (
                  <div>
                    <p className="text-[9px] font-black text-[#f0e6cc]/50 mb-2 uppercase tracking-widest">
                      {t("movie_your_rating")}
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
                  {t("watchlist_remove")}
                </button>
              </div>
            )}
          </div>

          {movie.cast && movie.cast.length > 0 && (
            <CastBlock cast={movie.cast} />
          )}

          {hasProviders && (
            <WatchProvidersBlock
              providers={providers!}
              movieTitle={movie.title}
            />
          )}

          {movie.trailerUrl && (
            <div className="mt-2">
              <div className="flex items-center gap-3 mb-3">
                <h3 className="text-sm font-black text-[#f0e6cc] uppercase tracking-widest italic">
                  {t("movie_trailer")}
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

      {/* Friends who watched this */}
      {friendsWatched.length > 0 && (
        <div className="mt-10 sm:mt-16 max-w-7xl mx-auto px-4 sm:px-6">
          <FriendsWatchedBlock friends={friendsWatched} />
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="mt-10 sm:mt-20 max-w-7xl mx-auto">
          <div className="flex items-center justify-between px-4 sm:px-6 mb-4 sm:mb-8">
            <div className="flex items-center gap-4">
              <h3 className="text-lg sm:text-2xl font-black text-[#f0e6cc] uppercase tracking-tighter italic">
                {t("movie_more_like_this")}
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
                      {t("common_na")}
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

      {/* Rating modal */}
      {isRatingModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div
            className="bg-[#1a1714] border border-[#c8963c]/30 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative animate-modal-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#c8963c] to-[#9a732a]" />
            <button
              onClick={() => {
                setIsRatingModalOpen(false);
                setModalHoveredStar(0);
              }}
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
            <div className="text-center">
              <h3 className="text-lg font-black text-[#c8963c] mb-1 uppercase tracking-wide">
                {t("movie_how_was_it")}
              </h3>
              <p className="text-sm text-[#f0e6cc]/60 mb-6">
                {t("movie_rate_desc")} "{movie?.title}" {t("movie_or_skip")}.
              </p>
              <div
                className="flex justify-center gap-1 mb-6"
                onMouseLeave={() => setModalHoveredStar(0)}
              >
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onMouseEnter={() => setModalHoveredStar(star)}
                    onClick={() => handleModalRate(star)}
                    className={`text-4xl transition-all duration-150 transform active:scale-125 p-1 ${modalHoveredStar >= star ? "text-[#c8963c]" : "text-[#f0e6cc]/20"}`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <button
                onClick={handleModalSkip}
                className="text-xs font-bold text-[#f0e6cc]/50 hover:text-[#c8963c] uppercase tracking-widest transition py-2 px-4"
              >
                {t("movie_skip_rating")}
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-10 sm:w-auto bg-[#1a1714] border border-[#c8963c]/50 text-[#c8963c] px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 z-[60] backdrop-blur-md animate-fade-in">
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
  status: UserMovieStatusType | null;
  hoveredStar: number;
  setHoveredStar: (n: number) => void;
  released: boolean;
  onAddWatchlist: () => void;
  onWatched: () => void;
  onToggleFavorite: () => void;
  onRate: (s: number) => void;
  onRemove: () => void;
}) {
  const { t } = useLang();
  return (
    <div className="bg-[#1a1714] border border-[#c8963c]/20 p-6 rounded-[2rem] shadow-2xl backdrop-blur-md">
      {!status ? (
        <div className="flex flex-col gap-3">
          <button
            onClick={onAddWatchlist}
            className="w-full py-3.5 bg-[#12100e] border border-[#c8963c]/30 text-[#c8963c] rounded-2xl font-black text-[10px] uppercase tracking-wider hover:bg-[#c8963c]/10 transition active:scale-95 shadow-lg"
          >
            {t("search_add")}
          </button>
          {released && (
            <button
              onClick={onWatched}
              className="w-full py-3.5 bg-[#c8963c] text-[#12100e] rounded-2xl font-black text-[10px] uppercase tracking-wider hover:bg-[#e8c070] transition active:scale-95 shadow-lg"
            >
              {t("watchlist_watched")}
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
              {status.isWatched
                ? t("watchlist_watched")
                : t("movie_planned").replace("⋯ ", "")}
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
                title={t("common_unreleased")}
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
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            )}
          </div>

          {released && (
            <div className="pt-4 border-t border-[#c8963c]/20">
              <p className="text-[10px] font-black text-[#f0e6cc]/50 mb-3 uppercase tracking-widest">
                {t("movie_rate_this")}
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
            {t("watchlist_remove")}
          </button>
        </div>
      )}
    </div>
  );
}

function TrailerBlock({ trailerUrl }: { trailerUrl: string }) {
  const { t } = useLang();
  return (
    <div className="w-full max-w-2xl mt-8">
      <div className="flex items-center gap-4 mb-6">
        <h3 className="text-lg font-black text-[#f0e6cc] uppercase tracking-widest italic">
          {t("movie_trailer")}
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
  providers: WatchProvidersDataType;
  movieTitle: string;
}) {
  const { t } = useLang();

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
    return providers.link || "#";
  };

  const renderProviderList = (title: string, list?: WatchProviderType[]) => {
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
        {t("movie_where_to_watch")}
      </h3>
      {renderProviderList(t("movie_stream"), providers.flatrate)}
      {renderProviderList(t("movie_rent"), providers.rent)}
      {renderProviderList(t("movie_buy"), providers.buy)}
      {providers.link && (
        <div className="mt-2 pt-3 border-t border-[#c8963c]/10 text-center">
          <a
            href={providers.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[8px] text-[#f0e6cc]/40 hover:text-[#c8963c] transition-colors uppercase tracking-widest font-bold"
          >
            {t("movie_powered_by")} JustWatch &rarr;
          </a>
        </div>
      )}
    </div>
  );
}

function FriendsWatchedBlock({ friends }: { friends: FriendWatchedType[] }) {
  const { t } = useLang();
  return (
    <div className="bg-[#1a1714] border border-[#c8963c]/20 p-4 sm:p-5 rounded-[2rem] shadow-xl backdrop-blur-md">
      <h3 className="text-xs sm:text-sm font-black text-[#f0e6cc] uppercase tracking-widest mb-4">
        {t("movie_friends_watched")}
      </h3>
      <div className="flex flex-wrap gap-3">
        {friends.map((friend) => (
          <Link
            key={friend.id}
            to={`/user/${friend.id}`}
            className="flex items-center gap-2.5 bg-[#12100e] border border-[#c8963c]/20 rounded-2xl pl-2 pr-3 py-2 hover:border-[#c8963c]/60 transition"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#c8963c] to-[#9a732a] flex items-center justify-center text-xs font-black text-[#12100e] overflow-hidden shrink-0">
              {friend.avatarUrl ? (
                <img
                  src={friend.avatarUrl}
                  alt={friend.username}
                  className="w-full h-full object-cover"
                />
              ) : (
                friend.username[0].toUpperCase()
              )}
            </div>
            <span className="text-xs font-bold text-[#f0e6cc] truncate max-w-[120px]">
              {friend.username}
            </span>
            {friend.rating ? (
              <span className="text-[10px] font-black text-[#c8963c] shrink-0">
                ★ {friend.rating}
              </span>
            ) : null}
          </Link>
        ))}
      </div>
    </div>
  );
}

function CastBlock({ cast }: { cast: CastMemberType[] }) {
  const { t } = useLang();
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;
    scrollRef.current.scrollTo({
      left:
        direction === "left"
          ? scrollLeft - clientWidth / 2
          : scrollLeft + clientWidth / 2,
      behavior: "smooth",
    });
  };

  return (
    <div className="w-full max-w-4xl mb-12">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4 flex-grow">
          <h3 className="text-lg font-black text-[#f0e6cc] uppercase tracking-widest italic">
            {t("movie_top_cast")}
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

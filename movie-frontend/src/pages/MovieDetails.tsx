import { useEffect, useRef, useState } from "react";
import {
  useParams,
  useNavigate,
  Link,
  useSearchParams,
} from "react-router-dom";
import * as moviesApi from "../api/movies.api";
import { useLang } from "../context/LanguageContext";
import { useAuth } from "../context/AuthContext";
import { useAuthPrompt } from "../context/AuthPromptContext";
import StarRating from "../components/StarRating";
import LogoIcon from "../components/LogoIcon";
import type {
  MovieDetails as MovieDetailsType,
  RecommendedMovie as RecommendedMovieType,
  UserMovieStatus as UserMovieStatusType,
  WatchProvider as WatchProviderType,
  WatchProvidersData as WatchProvidersDataType,
  CastMember as CastMemberType,
  FriendWatched as FriendWatchedType,
  SeasonInfo as SeasonInfoType,
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

function SectionHeader({
  label,
  onScrollLeft,
  onScrollRight,
  canScrollLeft = true,
  canScrollRight = true,
}: {
  label: string;
  onScrollLeft?: () => void;
  onScrollRight?: () => void;
  canScrollLeft?: boolean;
  canScrollRight?: boolean;
}) {
  return (
    <div className="flex items-center gap-3.5 mb-4">
      <span className="font-mono-ui text-[11px] sm:text-[11.5px] font-semibold tracking-[3px] text-[#d9ac54] uppercase whitespace-nowrap">
        {label}
      </span>
      <div className="flex-1 h-px bg-[rgba(217,172,84,.14)]" />
      {(onScrollLeft || onScrollRight) && (
        <div className="flex gap-2 shrink-0">
          {onScrollLeft && (
            <button
              onClick={onScrollLeft}
              disabled={!canScrollLeft}
              className="w-[26px] h-[26px] flex items-center justify-center rounded-full border border-white/[.15] text-[#8f8574] hover:border-[#d9ac54]/45 hover:text-[#d9ac54] transition active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          {onScrollRight && (
            <button
              onClick={onScrollRight}
              disabled={!canScrollRight}
              className="w-[26px] h-[26px] flex items-center justify-center rounded-full border border-white/[.15] text-[#8f8574] hover:border-[#d9ac54]/45 hover:text-[#d9ac54] transition active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function MovieDetails() {
  const { t } = useLang();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const mediaType = searchParams.get("type") || "movie";
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { open: openAuthPrompt } = useAuthPrompt();

  const [movie, setMovie] = useState<MovieDetailsType | null>(null);
  const [status, setStatus] = useState<UserMovieStatusType | null>(null);
  const [recommendations, setRecommendations] = useState<
    RecommendedMovieType[]
  >([]);
  const [friendsWatched, setFriendsWatched] = useState<FriendWatchedType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    "new_watched" | "update_watched" | null
  >(null);
  const [modalRating, setModalRating] = useState(0);

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
    if (!isAuthenticated) {
      openAuthPrompt();
      return;
    }
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

  const handleToggleFavorite = async () => {
    if (!movie || !status) return;
    if (!isAuthenticated) {
      openAuthPrompt();
      return;
    }
    try {
      await moviesApi.toggleFavorite(movie.id);
      updateStatusCache({ ...status, isFavorite: !status.isFavorite });
      showToast(t("movie_fav_updated"));
    } catch {
      showToast(t("movie_failed"));
    }
  };

  const handleMarkWatched = async () => {
    if (!movie) return;
    if (!isAuthenticated) {
      openAuthPrompt();
      return;
    }
    try {
      await moviesApi.markWatched(movie.id);
      showToast(t("movie_marked_watched"));
      fetchData(movie.id);
    } catch {
      showToast(t("movie_error"));
    }
  };

  const handleRate = async (rating: number) => {
    if (!movie) return;
    if (!isAuthenticated) {
      openAuthPrompt();
      return;
    }
    try {
      await moviesApi.rateMovie(movie.id, rating);
      showToast(
        rating === 0 ? t("movie_rating_cleared") : t("movie_rating_saved"),
      );
      fetchData(movie.id);
    } catch {
      showToast(t("movie_error"));
    }
  };

  const [progressSeason, setProgressSeason] = useState(1);
  const [progressEpisode, setProgressEpisode] = useState(1);

  useEffect(() => {
    setProgressSeason(status?.currentSeason || 1);
    setProgressEpisode(status?.currentEpisode || 1);
  }, [status?.currentSeason, status?.currentEpisode]);

  const handleSaveProgress = async () => {
    if (!movie || !status) return;
    if (!isAuthenticated) {
      openAuthPrompt();
      return;
    }
    try {
      await moviesApi.updateEpisodeProgress(
        movie.id,
        progressSeason,
        progressEpisode,
      );
      updateStatusCache({
        ...status,
        currentSeason: progressSeason,
        currentEpisode: progressEpisode,
      });
      showToast(t("movie_progress_saved"));
    } catch {
      showToast(t("movie_error"));
    }
  };

  const handleRemove = async () => {
    if (!movie) return;
    if (!isAuthenticated) {
      openAuthPrompt();
      return;
    }
    try {
      await moviesApi.removeFromWatchlist(movie.id);
      showToast(t("movie_removed"));
      updateStatusCache(null);
    } catch {
      showToast(t("movie_error"));
    }
  };

  const closeRatingModal = () => {
    setIsRatingModalOpen(false);
    setPendingAction(null);
    setModalRating(0);
  };

  const handleModalConfirm = async () => {
    const rating = modalRating > 0 ? modalRating : null;
    if (pendingAction === "new_watched") await handleAddNewMovie(true, rating);
    else if (pendingAction === "update_watched") {
      if (rating !== null) await handleRate(rating);
      else await handleMarkWatched();
    }
    closeRatingModal();
  };

  const isReleased = (dateStr?: string | null) => {
    if (!dateStr) return true;
    return new Date(dateStr) <= new Date();
  };

  const openWatchedModal = () => {
    if (!isAuthenticated) {
      openAuthPrompt();
      return;
    }
    setPendingAction(status ? "update_watched" : "new_watched");
    setModalRating(status?.rating || 0);
    setIsRatingModalOpen(true);
  };

  const goBack = () => {
    const fromTab = searchParams.get("fromTab");
    if (fromTab) navigate(`/watchlist?tab=${fromTab}`);
    else navigate(-1);
  };

  if (isLoading)
    return (
      <div className="min-h-screen bg-[#0f0d0a] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#14110d] border-t-[#d9ac54] rounded-full animate-spin" />
      </div>
    );

  if (!movie)
    return (
      <div className="min-h-screen bg-[#0f0d0a] text-[#f2ead9] flex items-center justify-center font-ui">
        <Link to="/search" className="text-[#d9ac54] font-bold hover:underline">
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
  const firstProvider =
    providers?.flatrate?.[0] || providers?.rent?.[0] || providers?.buy?.[0];

  const releaseYear = movie.releaseDate?.split("-")[0] ?? t("common_na");
  const releaseDateFormatted = movie.releaseDate
    ? new Date(movie.releaseDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : t("common_na");

  return (
    <div className="min-h-[100dvh] bg-[#0f0d0a] font-ui text-[#f2ead9] relative pb-24 overscroll-none selection:bg-[#d9ac54] selection:text-[#0f0d0a]">
      <div className="sm:hidden sticky top-0 z-40 bg-[#0f0d0a]/95 backdrop-blur-md border-b border-[rgba(217,172,84,.16)] pt-[env(safe-area-inset-top)]">
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
          <button
            onClick={goBack}
            className="font-mono-ui text-[10px] font-semibold tracking-[1.5px] text-[#8f8574] hover:text-[#d9ac54] transition uppercase"
          >
            ‹ {t("common_back")}
          </button>
        </header>
      </div>

      <div className="relative w-full h-[280px] sm:h-[420px] bg-[#14110d] overflow-hidden">
        {backdropUrl && (
          <>
            <img
              src={backdropUrl}
              alt=""
              aria-hidden="true"
              className="w-full h-full object-cover scale-105 blur-sm opacity-70"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f0d0a] via-[#0f0d0a]/80 to-transparent" />
            <div className="hidden sm:block absolute inset-0 bg-gradient-to-r from-[#0f0d0a]/75 via-[#0f0d0a]/30 to-transparent" />
          </>
        )}
        <button
          onClick={goBack}
          className="hidden sm:block absolute top-6 left-14 font-mono-ui text-[10.5px] font-semibold tracking-[2px] text-[#8f8574] hover:text-[#d9ac54] transition uppercase"
        >
          ‹ {t("common_back")}
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-14 relative z-10">
        <div className="flex gap-4 items-end mb-6 -mt-16 sm:hidden">
          <div className="flex-shrink-0 w-28">
            {posterUrl ? (
              <img
                src={posterUrl}
                alt={movie.title}
                className="w-full rounded-[8px] shadow-2xl"
              />
            ) : (
              <div className="w-full aspect-[2/3] rounded-[8px] bg-[#14110d]" />
            )}
          </div>
          <div className="flex-1 min-w-0 pb-1">
            <span className="inline-block mb-2 px-2 py-0.5 border border-[#d9ac54]/45 rounded-full font-mono-ui text-[9px] text-[#d9ac54] font-semibold uppercase tracking-[2px]">
              {mediaType === "tv" ? t("common_tv") : t("common_movie")}
            </span>
            <h1 className="text-xl font-bold text-[#f2ead9] tracking-tight leading-tight mb-2 line-clamp-3">
              {movie.title}
            </h1>
            <div className="flex flex-wrap gap-2 text-[10px] text-[#8f8574] font-semibold items-center">
              <span className="text-[#f2ead9]">{releaseYear}</span>
              <span className="text-[#645c4d]">•</span>
              <span>
                {movie.runtime || "0"} {t("stats_min")}
              </span>
              {released && (
                <span className="font-mono-ui text-[#d9ac54] font-bold">
                  ★ {movie.voteAverage?.toFixed(1)}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {movie.genres?.slice(0, 3).map((g) => (
                <span
                  key={g.id}
                  className="font-mono-ui text-[9px] text-[#8f8574] uppercase tracking-widest"
                >
                  {g.name}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="hidden sm:flex gap-9 items-end">
          <div className="w-[240px] shrink-0 -mb-[72px] relative z-10">
            {posterUrl ? (
              <img
                src={posterUrl}
                alt={movie.title}
                className="w-full rounded-[8px] shadow-2xl"
              />
            ) : (
              <div className="w-full aspect-[2/3] rounded-[8px] bg-[#14110d]" />
            )}
          </div>

          <div className="flex-1 min-w-0 flex flex-col gap-3 pb-7">
            <div className="flex items-center gap-4">
              <h1 className="text-5xl font-bold text-[#f2ead9] tracking-tight leading-none -tracking-[.5px]">
                {movie.title}
              </h1>
              <span className="font-mono-ui text-[9.5px] font-semibold tracking-[2px] text-[#d9ac54] border border-[#d9ac54]/45 rounded-full px-3 py-1.5 whitespace-nowrap">
                {mediaType === "tv" ? t("common_tv") : t("common_movie")}
              </span>
            </div>

            <div className="flex items-center gap-3.5 flex-wrap">
              <span className="font-semibold text-[13px] text-[#f2ead9]">
                {releaseDateFormatted}
              </span>
              <span className="text-[#645c4d]">·</span>
              <span className="text-[13px] text-[#c9c0ac]">
                {movie.runtime || "0"} {t("stats_min")}
              </span>
              {released && (
                <>
                  <span className="text-[#645c4d]">·</span>
                  <span className="font-mono-ui font-bold text-[13px] text-[#d9ac54]">
                    {t("movie_imdb")} {movie.voteAverage?.toFixed(1)}
                  </span>
                </>
              )}
              {movie.genres && movie.genres.length > 0 && (
                <>
                  <span className="text-[#645c4d]">·</span>
                  <span className="font-mono-ui text-[11px] font-medium tracking-[1.5px] text-[#8f8574] uppercase">
                    {movie.genres
                      .slice(0, 3)
                      .map((g) => g.name)
                      .join(" · ")}
                  </span>
                </>
              )}
            </div>

            <p className="text-[14.5px] leading-relaxed text-[#c9c0ac] max-w-[640px]">
              {movie.overview}
            </p>

            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              {released && (
                <button
                  onClick={openWatchedModal}
                  className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold text-[11.5px] tracking-[1.5px] uppercase transition active:scale-95 ${
                    status?.isWatched
                      ? "bg-[#d9ac54] hover:bg-[#e8c377] text-[#14110c]"
                      : "border border-white/[.18] hover:border-[#d9ac54]/45 hover:text-[#d9ac54] text-[#c9c0ac]"
                  }`}
                >
                  ✓ {t("watchlist_watched")}
                </button>
              )}
              {!status && (
                <button
                  onClick={() => handleAddNewMovie(false)}
                  className="flex items-center gap-2 px-6 py-3 border border-white/[.18] hover:border-[#d9ac54]/45 hover:text-[#d9ac54] rounded-full font-semibold text-[11.5px] tracking-[1.5px] text-[#c9c0ac] uppercase transition active:scale-95"
                >
                  + {t("search_add")}
                </button>
              )}
              {released ? (
                <button
                  onClick={handleToggleFavorite}
                  disabled={!status}
                  className={`w-[44px] h-[44px] rounded-full border flex items-center justify-center text-[15px] transition active:scale-90 disabled:opacity-30 ${
                    status?.isFavorite
                      ? "border-[#e0554d]/60 text-[#e0554d] bg-[#e0554d]/10"
                      : "border-[#d9ac54]/45 text-[#e0554d] hover:bg-[#d9ac54]/10"
                  }`}
                >
                  ♥
                </button>
              ) : (
                <div
                  className="w-[44px] h-[44px] rounded-full border border-[#d9ac54]/20 flex items-center justify-center text-[#d9ac54]"
                  title={t("common_unreleased")}
                >
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              )}
              {movie.trailerUrl && (
                <button
                  onClick={() =>
                    document
                      .getElementById("trailer-section")
                      ?.scrollIntoView({ behavior: "smooth", block: "start" })
                  }
                  className="flex items-center gap-2 px-6 py-3 border border-white/[.18] hover:border-[#d9ac54]/45 hover:text-[#d9ac54] rounded-full font-semibold text-[11.5px] tracking-[1.5px] text-[#c9c0ac] uppercase transition active:scale-95"
                >
                  ▶ {t("movie_trailer")}
                </button>
              )}
              {released && status?.isWatched && (
                <div className="flex items-center gap-2.5 ml-4">
                  <span className="font-mono-ui text-[10px] font-medium tracking-[2px] text-[#8f8574] uppercase">
                    {t("movie_your_rating")}
                  </span>
                  <div className="w-[130px]">
                    <StarRating size="sm" value={status.rating || 0} onRate={handleRate} />
                  </div>
                  <span className="font-semibold text-[13px] text-[#f2ead9]">
                    {status.rating || 0}/10
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {(hasProviders || (movie.productionCountries && movie.productionCountries.length > 0) || status) && (
          <div className="hidden sm:flex gap-9 mt-6">
            <div className="w-[240px] shrink-0" />
            <div className="flex-1 flex items-center gap-9 py-6 border-b border-[rgba(217,172,84,.16)]">
              {firstProvider && (
                <div className="flex items-center gap-2.5">
                  <span className="font-mono-ui text-[10px] font-medium tracking-[2px] text-[#8f8574] uppercase">
                    {t("movie_where_to_watch")}
                  </span>
                  <img
                    src={`https://image.tmdb.org/t/p/w92${firstProvider.logo_path}`}
                    alt={firstProvider.provider_name}
                    className="w-[30px] h-[30px] rounded-lg"
                  />
                  <span className="text-[12px] text-[#c9c0ac]">
                    {firstProvider.provider_name}
                  </span>
                </div>
              )}
              {movie.productionCountries && movie.productionCountries.length > 0 && (
                <>
                  {firstProvider && <div className="w-px h-6 bg-[rgba(217,172,84,.16)]" />}
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono-ui text-[10px] font-medium tracking-[2px] text-[#8f8574] uppercase">
                      {t("movie_production_countries")}
                    </span>
                    <span className="text-[12px] text-[#c9c0ac]">
                      {movie.productionCountries.join(", ")}
                    </span>
                  </div>
                </>
              )}
              {status?.isWatched && (
                <button
                  onClick={handleRemove}
                  className="ml-auto font-semibold text-[10.5px] tracking-[1.5px] text-[#e0554d] uppercase opacity-70 hover:opacity-100 transition"
                >
                  {t("watchlist_remove")} {t("watchlist_watched").toUpperCase()}
                </button>
              )}
            </div>
          </div>
        )}

        <div className="sm:hidden mt-4 flex flex-col gap-5">
          {movie.productionCountries &&
            movie.productionCountries.length > 0 && (
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#8f8574]">
                <span>{t("movie_production_countries")}:</span>
                <span className="text-[#c9c0ac]">{movie.productionCountries.join(", ")}</span>
              </div>
            )}

          <p className="text-[#c9c0ac] text-sm leading-relaxed">
            {movie.overview}
          </p>

          <ActionPanel
            status={status}
            released={released}
            onAddWatchlist={() => handleAddNewMovie(false)}
            onWatched={openWatchedModal}
            onToggleFavorite={handleToggleFavorite}
            onRate={handleRate}
            onRemove={handleRemove}
            mediaType={mediaType}
            seasons={movie.seasons}
            progressSeason={progressSeason}
            progressEpisode={progressEpisode}
            onProgressSeasonChange={(season) => {
              setProgressSeason(season);
              setProgressEpisode(1);
            }}
            onProgressEpisodeChange={setProgressEpisode}
            onSaveProgress={handleSaveProgress}
          />

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
              <SectionHeader label={t("movie_trailer")} />
              <div className="relative aspect-video rounded-[10px] overflow-hidden bg-[#0f0d0a]">
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

        <div className="hidden sm:block mt-11">
          {movie.cast && movie.cast.length > 0 && (
            <CastBlock cast={movie.cast} />
          )}
          {movie.trailerUrl && (
            <div className="mt-10">
              <TrailerBlock trailerUrl={movie.trailerUrl} />
            </div>
          )}
        </div>
      </div>

      {friendsWatched.length > 0 && (
        <div className="mt-10 max-w-7xl mx-auto px-4 sm:px-14">
          <FriendsWatchedBlock friends={friendsWatched} />
        </div>
      )}

      {recommendations.length > 0 && (
        <div className="mt-10 max-w-7xl mx-auto px-4 sm:px-14">
          <SectionHeader
            label={t("movie_more_like_this")}
            onScrollLeft={() => scrollSlider("left")}
            onScrollRight={() => scrollSlider("right")}
            canScrollLeft={canScrollLeft}
            canScrollRight={canScrollRight}
          />

          <div
            ref={sliderRef}
            className="flex gap-[18px] overflow-x-auto scrollbar-hide pb-4 snap-x snap-mandatory"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            onScroll={checkScroll}
          >
            {recommendations.map((m) => (
              <Link
                key={m.id}
                to={`/movie/${m.id}?type=${mediaType}`}
                className="group flex-shrink-0 w-[130px] sm:w-[140px] snap-start flex flex-col gap-2"
              >
                <div className="relative aspect-[2/3] rounded-[6px] overflow-hidden bg-[#0f0d0a]">
                  {m.posterUrl ? (
                    <img
                      src={m.posterUrl}
                      alt={m.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[9px] text-[#f2ead9]/30">
                      {t("common_na")}
                    </div>
                  )}
                </div>
                <h4 className="text-[12.5px] font-semibold text-[#f2ead9] truncate group-hover:text-[#d9ac54] transition-colors">
                  {m.title}
                </h4>
                <p className="font-mono-ui text-[10px] text-[#8f8574] -mt-1">
                  {m.releaseYear}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {isRatingModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div
            className="bg-[#14110d] border border-[#d9ac54]/25 rounded-2xl p-6 w-full max-w-sm shadow-2xl relative animate-modal-in font-ui"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeRatingModal}
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
            <div className="text-center">
              <h3 className="text-lg font-bold text-[#f2ead9] mb-1">
                {t("movie_how_was_it")}
              </h3>
              <p className="text-sm text-[#8f8574] mb-6">
                {t("movie_rate_desc")} "{movie?.title}"
              </p>
              <div className="mb-6">
                <StarRating
                  size="lg"
                  value={modalRating}
                  onRate={setModalRating}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={closeRatingModal}
                  className="flex-1 py-3 font-bold text-[#f2ead9] uppercase tracking-widest transition border border-white/[.15] hover:border-[#d9ac54]/45 rounded-full active:scale-[0.98] text-xs"
                >
                  {t("movie_rating_cancel")}
                </button>
                <button
                  onClick={handleModalConfirm}
                  className="flex-1 py-3 font-bold text-[#14110c] uppercase tracking-widest transition bg-[#d9ac54] hover:bg-[#e8c377] rounded-full active:scale-[0.98] text-xs"
                >
                  {t("movie_rating_ok")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-10 sm:w-auto bg-[#14110d] border border-[#d9ac54]/50 text-[#d9ac54] px-5 py-3.5 rounded-full shadow-2xl flex items-center gap-3 z-[60] backdrop-blur-md animate-fade-in">
          <div className="w-1.5 h-1.5 bg-[#d9ac54] rounded-full animate-pulse flex-shrink-0" />
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
  released,
  onAddWatchlist,
  onWatched,
  onToggleFavorite,
  onRate,
  onRemove,
  mediaType,
  seasons,
  progressSeason,
  progressEpisode,
  onProgressSeasonChange,
  onProgressEpisodeChange,
  onSaveProgress,
}: {
  status: UserMovieStatusType | null;
  released: boolean;
  onAddWatchlist: () => void;
  onWatched: () => void;
  onToggleFavorite: () => void;
  onRate: (s: number) => void;
  onRemove: () => void;
  mediaType: string;
  seasons?: SeasonInfoType[];
  progressSeason: number;
  progressEpisode: number;
  onProgressSeasonChange: (season: number) => void;
  onProgressEpisodeChange: (episode: number) => void;
  onSaveProgress: () => void;
}) {
  const { t } = useLang();
  return (
    <div>
      {!status ? (
        <div className="flex gap-3">
          <button
            onClick={onAddWatchlist}
            className={`py-3 border border-white/[.18] text-[#c9c0ac] rounded-full font-bold text-[11px] uppercase tracking-wider transition active:scale-95 ${released ? "flex-1" : "w-full"}`}
          >
            + {t("search_add")}
          </button>
          {released && (
            <button
              onClick={onWatched}
              className="flex-1 py-3 bg-[#d9ac54] hover:bg-[#e8c377] text-[#14110c] rounded-full font-bold text-[11px] uppercase tracking-wider transition active:scale-95"
            >
              ✓ {t("watchlist_watched")}
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span
              className={`px-3.5 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                status.isWatched
                  ? "text-[#d9ac54] bg-[#d9ac54]/10 border-[#d9ac54]/30"
                  : "text-[#8f8574] border-white/[.15]"
              }`}
            >
              {status.isWatched
                ? `✓ ${t("watchlist_watched")}`
                : t("movie_planned")}
            </span>

            {released ? (
              <button
                onClick={onToggleFavorite}
                className={`w-10 h-10 rounded-full border flex items-center justify-center transition active:scale-90 ${
                  status.isFavorite
                    ? "border-[#e0554d]/50 text-[#e0554d]"
                    : "border-white/[.15] text-[#8f8574] hover:text-[#e0554d]"
                }`}
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
              </button>
            ) : (
              <div
                className="w-10 h-10 rounded-full border border-white/[.12] text-[#d9ac54] flex items-center justify-center"
                title={t("common_unreleased")}
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
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            )}
          </div>

          {released && !status.isWatched && (
            <button
              onClick={onWatched}
              className="w-full py-3 bg-[#d9ac54] hover:bg-[#e8c377] text-[#14110c] rounded-full font-bold text-[11px] uppercase tracking-wider transition active:scale-95"
            >
              ✓ {t("watchlist_watched")}
            </button>
          )}

          {released && status.isWatched && (
            <div className="pt-4 border-t border-[rgba(217,172,84,.16)]">
              <p className="font-mono-ui text-[10px] font-medium text-[#8f8574] mb-3 uppercase tracking-widest">
                {t("movie_your_rating")}
              </p>
              <StarRating
                size="lg"
                value={status.rating || 0}
                onRate={onRate}
              />
            </div>
          )}

          {mediaType === "tv" && seasons && seasons.length > 0 && (
            <div className="pt-4 border-t border-[rgba(217,172,84,.16)]">
              <p className="font-mono-ui text-[10px] font-medium text-[#8f8574] mb-3 uppercase tracking-widest">
                {t("movie_episode_progress")}
              </p>
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <select
                    value={progressSeason}
                    onChange={(e) =>
                      onProgressSeasonChange(Number(e.target.value))
                    }
                    className="flex-1 min-w-0 pl-2 pr-5 py-2 bg-white/[.03] border border-[#d9ac54]/30 rounded-lg text-[#f2ead9] text-[13px] focus:outline-none focus:border-[#d9ac54] truncate"
                  >
                    {seasons.map((s) => (
                      <option key={s.seasonNumber} value={s.seasonNumber}>
                        {s.name || `${t("movie_season")} ${s.seasonNumber}`}
                      </option>
                    ))}
                  </select>
                  <select
                    value={progressEpisode}
                    onChange={(e) =>
                      onProgressEpisodeChange(Number(e.target.value))
                    }
                    className="flex-1 min-w-0 pl-2 pr-5 py-2 bg-white/[.03] border border-[#d9ac54]/30 rounded-lg text-[#f2ead9] text-[13px] focus:outline-none focus:border-[#d9ac54] truncate"
                  >
                    {Array.from(
                      {
                        length:
                          seasons.find((s) => s.seasonNumber === progressSeason)
                            ?.episodeCount || 1,
                      },
                      (_, i) => i + 1,
                    ).map((ep) => (
                      <option key={ep} value={ep}>
                        {t("movie_episode")} {ep}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={onSaveProgress}
                  disabled={
                    progressSeason === status.currentSeason &&
                    progressEpisode === status.currentEpisode
                  }
                  className="w-full py-2 bg-[#d9ac54] text-[#14110c] rounded-full font-bold text-[11px] uppercase tracking-wide hover:bg-[#e8c377] transition active:scale-95 disabled:opacity-30"
                >
                  {t("movie_save")}
                </button>
              </div>
              {status.currentSeason && status.currentEpisode && (
                <p className="text-[10px] text-[#d9ac54]/70 mt-1.5">
                  {t("movie_currently_watching")} S{status.currentSeason}E
                  {status.currentEpisode}
                </p>
              )}
            </div>
          )}

          <button
            onClick={onRemove}
            className="w-full py-2.5 border border-[#e0554d]/30 text-[#e0554d] rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-[#e0554d]/10 hover:border-[#e0554d]/60 transition active:scale-95"
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
    <div id="trailer-section" className="w-full max-w-[720px] scroll-mt-24">
      <SectionHeader label={t("movie_trailer")} />
      <div className="relative aspect-video rounded-[10px] overflow-hidden bg-[#0f0d0a] transition-shadow duration-300 hover:shadow-[0_0_0_1px_rgba(217,172,84,.5)]">
        <iframe
          src={`${trailerUrl}?rel=0&showinfo=0&modestbranding=1&autoplay=0`}
          title="Trailer"
          className="absolute inset-0 w-full h-full"
          allowFullScreen
        />
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
        <h4 className="font-mono-ui text-[9px] font-semibold text-[#8f8574] uppercase tracking-[0.2em] mb-2">
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
                className="w-9 h-9 rounded-lg"
              />
            </a>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="pt-5 border-t border-[rgba(217,172,84,.16)]">
      <h3 className="font-mono-ui text-[10px] font-semibold text-[#d9ac54] uppercase tracking-[2px] mb-4">
        {t("movie_where_to_watch")}
      </h3>
      {renderProviderList(t("movie_stream"), providers.flatrate)}
      {renderProviderList(t("movie_rent"), providers.rent)}
      {renderProviderList(t("movie_buy"), providers.buy)}
      {providers.link && (
        <div className="mt-2 pt-3 border-t border-[rgba(217,172,84,.12)] text-center">
          <a
            href={providers.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[9px] text-[#645c4d] hover:text-[#d9ac54] transition-colors uppercase tracking-widest font-semibold"
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
    <div>
      <SectionHeader label={t("movie_friends_watched")} />
      <div className="flex flex-wrap gap-3">
        {friends.map((friend) => (
          <Link
            key={friend.id}
            to={`/user/${friend.id}`}
            className="flex items-center gap-2.5 border border-[rgba(217,172,84,.2)] rounded-full pl-2 pr-3.5 py-2 hover:border-[#d9ac54]/50 transition"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#d9ac54] to-[#a87c2e] flex items-center justify-center text-xs font-bold text-[#14110c] overflow-hidden shrink-0">
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
            <span className="text-xs font-semibold text-[#f2ead9] truncate max-w-[120px]">
              {friend.username}
            </span>
            {friend.rating ? (
              <span className="font-mono-ui text-[10px] font-bold text-[#d9ac54] shrink-0">
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
    <div className="w-full">
      <SectionHeader
        label={t("movie_top_cast")}
        onScrollLeft={() => scroll("left")}
        onScrollRight={() => scroll("right")}
      />

      <div
        ref={scrollRef}
        className="flex gap-[26px] overflow-x-auto scrollbar-hide snap-x pb-4"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {cast.map((actor) => (
          <Link
            key={actor.id}
            to={`/actor/${actor.id}`}
            className="flex-shrink-0 w-[88px] sm:w-[112px] snap-start group block cursor-pointer text-center flex flex-col items-center gap-2"
          >
            <div className="w-[70px] h-[70px] sm:w-[88px] sm:h-[88px] rounded-full overflow-hidden bg-[#14110d] transition-shadow duration-200 group-hover:shadow-[0_0_0_2px_#d9ac54]">
              {actor.profile_path ? (
                <img
                  src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`}
                  alt={actor.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-[#f2ead9]/20">
                  <svg
                    className="w-8 h-8"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
              )}
            </div>
            <p className="text-[11px] sm:text-xs font-semibold text-[#f2ead9] leading-tight truncate group-hover:text-[#d9ac54] transition-colors">
              {actor.name}
            </p>
            <p
              className="text-[10px] sm:text-[10.5px] text-[#8f8574] truncate -mt-1"
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

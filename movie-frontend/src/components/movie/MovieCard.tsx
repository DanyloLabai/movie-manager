import { Link } from "react-router-dom";
import { useLang } from "../../context/LanguageContext";
import type { MovieCardProps } from "../../types/movie.types";

const isReleased = (movie: {
  releaseDate?: string | null;
  releaseYear?: string;
}) => {
  if (movie.releaseDate) return new Date(movie.releaseDate) <= new Date();
  if (movie.releaseYear && movie.releaseYear !== "N/A")
    return parseInt(movie.releaseYear) <= new Date().getFullYear();
  return true;
};

export const MovieCard = ({
  movie,
  favoriteIds,
  addedIds,
  watchedIds,
  onToggleFavorite,
  onAdd,
  onRemove,
}: MovieCardProps) => {
  const { t } = useLang();
  const released = isReleased(movie);
  const isWatched = watchedIds.includes(movie.id);
  const isInPlans = addedIds.includes(movie.id);

  return (
    <div className="group relative overflow-hidden bg-[#1a1714]/90 backdrop-blur-sm border border-[#c8963c]/20 shadow rounded-2xl flex flex-col hover:border-[#c8963c]/60 hover:-translate-y-1 hover:shadow-[0_12px_32px_-10px_rgba(200,150,60,0.4)] transition-all duration-300 h-full">
      {released ? (
        <button
          className="absolute top-1.5 left-1.5 z-10 w-7 h-7 flex items-center justify-center btn-glass btn-glass-dark rounded-full shadow-[0_2px_10px_-2px_rgba(0,0,0,0.6)] transition group/heart"
          onClick={() => onToggleFavorite(movie)}
        >
          <svg
            className={`w-3 h-3 transition ${favoriteIds.includes(movie.id) ? "text-red-500 fill-red-500" : "text-[#f0e6cc]/30 group-hover/heart:text-red-500"}`}
            fill={favoriteIds.includes(movie.id) ? "currentColor" : "none"}
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
        </button>
      ) : (
        <div className="absolute top-1.5 left-1.5 z-10 w-7 h-7 flex items-center justify-center bg-[#12100e]/90 rounded-full border border-[#c8963c]/50 text-[#c8963c]">
          <svg
            className="w-3.5 h-3.5"
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

      <Link
        to={`/movie/${movie.id}?type=${movie.mediaType}`}
        className="relative w-full aspect-[2/3] bg-[#12100e] block overflow-hidden"
      >
        {movie.posterUrl ? (
          <img
            src={movie.posterUrl}
            alt={movie.title}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full text-[9px] text-[#f0e6cc]/30">
            {t("search_no_poster")}
          </div>
        )}
      </Link>

      <div className="p-2.5 flex flex-col flex-grow bg-transparent">
        <Link to={`/movie/${movie.id}?type=${movie.mediaType}`}>
          <h4
            className="text-[11px] lg:text-[13px] font-bold mb-1 truncate text-[#f0e6cc] hover:text-[#c8963c] transition-colors"
            title={movie.title}
          >
            {movie.title}
          </h4>
        </Link>
        <p className="text-[8px] lg:text-[10px] text-[#f0e6cc]/50 mb-2 uppercase tracking-wider flex items-center gap-1 flex-wrap font-semibold">
          <span>
            {movie.releaseDate
              ? new Date(movie.releaseDate).toLocaleDateString("en-US", {
                  month: "short",
                  year: "numeric",
                })
              : movie.releaseYear}
          </span>
          {released && (
            <>
              <span>•</span>
              <span className="text-[#c8963c] font-bold">
                ★ {Number(movie.rating || 0).toFixed(1)}
              </span>
            </>
          )}
          <span className="ml-auto px-1 py-0.5 bg-[#2a241f] rounded text-[7px] lg:text-[9px] text-[#f0e6cc]/70 border border-[#c8963c]/20">
            {movie.mediaType === "tv" ? t("common_tv") : t("common_movie")}
          </span>
        </p>

        <div className="mt-auto pt-2 border-t border-[#c8963c]/20">
          {isInPlans ? (
            <button
              onClick={() => onRemove(movie)}
              className={`w-full py-1.5 font-bold rounded-lg uppercase text-[9px] lg:text-[11px] tracking-wider btn-glass flex items-center justify-center gap-1 active:scale-95 transition ${
                isWatched
                  ? "btn-glass-dark !border-green-500/40 text-green-500 hover:!border-green-500/70"
                  : "btn-glass-dark text-[#c8963c]"
              }`}
            >
              <span>✓</span> {t("search_added_btn")}
            </button>
          ) : (
            <button
              onClick={() => onAdd(movie)}
              className="w-full py-1.5 btn-glass btn-glass-dark text-[#c8963c] font-bold rounded-lg transition-all active:scale-95 uppercase text-[9px] lg:text-[11px] tracking-wider"
            >
              + {t("search_add")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

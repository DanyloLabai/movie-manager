import { useState } from "react";
import { Link } from "react-router-dom";
import { useLang } from "../../context/LanguageContext";
import AddMovieModal from "./AddMovieModal";
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
  onMarkWatched,
  onRemove,
}: MovieCardProps) => {
  const { t } = useLang();
  const released = isReleased(movie);
  const isInPlans = addedIds.includes(movie.id);
  const isWatched = watchedIds.includes(movie.id);
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="group flex flex-col gap-2 font-ui min-w-0">
      <div className="relative w-full aspect-[2/3] rounded-[6px] overflow-hidden bg-[#0f0d0a]">
        {released ? (
          <button
            className="absolute top-1.5 left-1.5 z-10 w-[22px] h-[22px] flex items-center justify-center bg-[rgba(15,13,10,.75)] rounded-full transition group/heart"
            onClick={() => onToggleFavorite(movie)}
          >
            <svg
              className={`w-3 h-3 transition ${favoriteIds.includes(movie.id) ? "text-red-500 fill-red-500" : "text-[#c9c0ac] group-hover/heart:text-red-500"}`}
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
          <div className="absolute top-1.5 left-1.5 z-10 w-[22px] h-[22px] flex items-center justify-center bg-[rgba(15,13,10,.75)] rounded-full text-[#d9ac54]">
            <svg
              className="w-3 h-3"
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
          className="block w-full h-full"
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
            <div className="flex items-center justify-center w-full h-full text-[9px] text-[#f2ead9]/30">
              {t("search_no_poster")}
            </div>
          )}
        </Link>
      </div>

      <Link to={`/movie/${movie.id}?type=${movie.mediaType}`}>
        <h4
          className="text-[12.5px] font-semibold text-[#f2ead9] truncate hover:text-[#d9ac54] transition-colors"
          title={movie.title}
        >
          {movie.title}
        </h4>
      </Link>

      <p className="font-mono-ui text-[10px] text-[#8f8574] -mt-1 truncate">
        {movie.releaseDate
          ? new Date(movie.releaseDate)
              .toLocaleDateString("en-US", { month: "short", year: "numeric" })
              .toUpperCase()
          : movie.releaseYear}
        {released && (
          <span className="text-[#d9ac54]">
            {" "}
            · ★ {Number(movie.rating || 0).toFixed(1)}
          </span>
        )}
      </p>

      <div className="mt-auto pt-2 border-t border-[rgba(217,172,84,.16)] text-center">
        {isWatched ? (
          <button
            onClick={() => onRemove(movie)}
            className="font-semibold text-[10px] tracking-[1.5px] text-[#d9ac54] hover:text-[#e8c377] transition uppercase"
          >
            ✓ {t("watchlist_watched")}
          </button>
        ) : isInPlans ? (
          <button
            onClick={() => onRemove(movie)}
            className="font-semibold text-[10px] tracking-[1.5px] text-[#d9ac54] hover:text-[#e8c377] transition uppercase"
          >
            ✓ {t("search_added_btn")}
          </button>
        ) : (
          <button
            onClick={() => setIsModalOpen(true)}
            className="font-semibold text-[10px] tracking-[1.5px] text-[#d9ac54] hover:text-[#e8c377] transition uppercase"
          >
            + {t("search_add")}
          </button>
        )}
      </div>

      {isModalOpen && (
        <AddMovieModal
          title={movie.title}
          onClose={() => setIsModalOpen(false)}
          onAddToWatchlist={() => {
            onAdd(movie);
            setIsModalOpen(false);
          }}
          onMarkWatched={(rating) => {
            onMarkWatched(movie, rating);
            setIsModalOpen(false);
          }}
        />
      )}
    </div>
  );
};

import { useRef } from "react";
import type { ReactNode } from "react";
import { useLang } from "../../context/LanguageContext";
import { MovieCard } from "./MovieCard";
import type { MovieResult } from "../../types/movie.types";

export type MovieCarouselProps = {
  title: string;
  badge?: string;
  badgeClass?: string;
  movies: MovieResult[];
  isLoading: boolean;
  fallback: ReactNode;
  emptyElement?: ReactNode;
  favoriteIds: number[];
  addedIds: number[];
  watchedIds: number[];
  onToggleFavorite: (item: MovieResult) => void;
  onAdd: (item: MovieResult) => void;
  onMarkWatched: (item: MovieResult, rating?: number | null) => void;
  onRemove: (item: MovieResult) => void;
  onFindSimilar?: (item: MovieResult) => void;
};

export const MovieCarousel = ({
  title,
  badge,
  badgeClass,
  movies,
  isLoading,
  fallback,
  emptyElement,
  favoriteIds,
  addedIds,
  watchedIds,
  onToggleFavorite,
  onAdd,
  onMarkWatched,
  onRemove,
  onFindSimilar,
}: MovieCarouselProps) => {
  const { t } = useLang();
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.75;
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <section>
      <div className="flex items-center gap-3.5 mb-4 min-w-0">
        <span className="font-mono-ui text-[11px] sm:text-[11.5px] font-semibold tracking-[3px] text-[#d9ac54] uppercase truncate min-w-0 shrink">
          {title}
        </span>
        {badge && <span className={badgeClass}>{badge}</span>}
        <div className="flex-1 h-px bg-[rgba(217,172,84,.14)]" />

        {!isLoading && movies?.length > 0 && (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => scroll("left")}
              className="w-[26px] h-[26px] flex items-center justify-center rounded-full border border-white/[.15] text-[#8f8574] hover:border-[#d9ac54]/45 hover:text-[#d9ac54] transition active:scale-95"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <button
              onClick={() => scroll("right")}
              className="w-[26px] h-[26px] flex items-center justify-center rounded-full border border-white/[.15] text-[#8f8574] hover:border-[#d9ac54]/45 hover:text-[#d9ac54] transition active:scale-95"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        fallback
      ) : movies && movies.length > 0 ? (
        <div
          ref={scrollRef}
          className="flex overflow-x-auto gap-3 pb-4 snap-x snap-mandatory [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-4 px-4 sm:mx-0 sm:px-0"
        >
          {movies.map((movie: MovieResult) => (
            <div
              key={movie.id}
              className="flex-none w-[140px] sm:w-[160px] lg:w-[180px] snap-start h-auto"
            >
              <MovieCard
                movie={movie}
                favoriteIds={favoriteIds}
                addedIds={addedIds}
                watchedIds={watchedIds}
                onToggleFavorite={onToggleFavorite}
                onAdd={onAdd}
                onMarkWatched={onMarkWatched}
                onRemove={onRemove}
                onFindSimilar={onFindSimilar}
              />
            </div>
          ))}
        </div>
      ) : (
        emptyElement || (
          <p className="text-[#f2ead9]/50 text-center text-sm">
            {t("search_empty")}
          </p>
        )
      )}
    </section>
  );
};

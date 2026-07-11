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
      <div className="flex justify-between items-center mb-4 border-b border-[#c8963c]/20 pb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xs sm:text-sm font-black text-[#c8963c] uppercase tracking-widest">
            {title}
          </h2>
          {badge && <span className={badgeClass}>{badge}</span>}
        </div>

        {!isLoading && movies?.length > 0 && (
          <div className="flex gap-1 sm:gap-2">
            <button
              onClick={() => scroll("left")}
              className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg border border-[#c8963c]/30 text-[#f0e6cc]/50 hover:text-[#c8963c] hover:border-[#c8963c] hover:bg-[#c8963c]/10 transition active:scale-95"
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
                  strokeWidth="2"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <button
              onClick={() => scroll("right")}
              className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg border border-[#c8963c]/30 text-[#f0e6cc]/50 hover:text-[#c8963c] hover:border-[#c8963c] hover:bg-[#c8963c]/10 transition active:scale-95"
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
                onRemove={onRemove}
                onFindSimilar={onFindSimilar}
              />
            </div>
          ))}
        </div>
      ) : (
        emptyElement || (
          <p className="text-[#f0e6cc]/50 text-center text-sm">
            {t("search_empty")}
          </p>
        )
      )}
    </section>
  );
};

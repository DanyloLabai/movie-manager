import { useLang } from "../../context/LanguageContext";
import { MovieCarousel } from "./MovieCarousel";
import type { MovieResult } from "../../types/movie.types";
import type { BecauseYouWatchedResponse } from "../../api/movies.api";

interface BecauseYouWatchedCarouselProps {
  basedOnMovie: BecauseYouWatchedResponse["basedOnMovie"];
  similarMovies: MovieResult[];
  favoriteIds: number[];
  addedIds: number[];
  watchedIds: number[];
  onToggleFavorite: (item: MovieResult) => void;
  onAdd: (item: MovieResult) => void;
  onRemove: (item: MovieResult) => void;
  onFindSimilar?: (item: MovieResult) => void;
}

export const BecauseYouWatchedCarousel = ({
  basedOnMovie,
  similarMovies,
  favoriteIds,
  addedIds,
  watchedIds,
  onToggleFavorite,
  onAdd,
  onRemove,
  onFindSimilar,
}: BecauseYouWatchedCarouselProps) => {
  const { t } = useLang();

  return (
    <MovieCarousel
      title={`${t("because_you_watched")} "${basedOnMovie.title}"`}
      movies={similarMovies}
      isLoading={false}
      fallback={null}
      favoriteIds={favoriteIds}
      addedIds={addedIds}
      watchedIds={watchedIds}
      onToggleFavorite={onToggleFavorite}
      onAdd={onAdd}
      onRemove={onRemove}
      onFindSimilar={onFindSimilar}
    />
  );
};

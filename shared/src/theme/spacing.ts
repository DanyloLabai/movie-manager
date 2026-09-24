// Extracted from movie-frontend's arbitrary-value gap-[..]/px-[..] classes
// that recur across the movie grid (MovieCard, Watchlist) and pill buttons.
export const spacing = {
  cardGapX: 18, // gap-x-[18px] – movie grid column gap
  cardGapY: 26, // gap-y-[26px] – movie grid row gap
  cardStack: 9, // gap-[9px] – vertical gap inside a watchlist card
  pillPaddingX: 18, // px-[18px] – pill button horizontal padding (add/details buttons)
} as const;

export type SpacingToken = keyof typeof spacing;

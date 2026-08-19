// Extracted from movie-frontend's arbitrary-value rounded-[..] classes and
// Tailwind's default radius scale (rounded-2xl) as actually used there.
export const radius = {
  xs: 5, // rounded-[5px] – AiChat poster thumbnail
  sm: 6, // rounded-[6px] – movie poster corners (MovieCard, Watchlist grid)
  md: 10, // rounded-[10px] – AiChat movie-result card, watchlist empty-state box
  lg: 14, // rounded-[14px] – friends modal
  xl: 16, // rounded-2xl – rating modal, toasts
  full: 9999, // rounded-full – buttons, pills, avatars
} as const;

export type RadiusToken = keyof typeof radius;

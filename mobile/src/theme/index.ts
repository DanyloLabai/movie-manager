import { colors, fontWeight, shadows } from '@movie-manager/shared';

export { colors, fontWeight, shadows };

// RN-specific constants that don't belong in the platform-agnostic shared
// package (spacing scale, border radius) — kept small on purpose, expand as
// screens actually need more.
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  // Mirrors shared/src/theme/radius.ts's `full` — pill-shaped buttons/inputs.
  full: 9999,
} as const;

// RN needs one concrete loaded font-file name per style, unlike web's
// fontFamily stack — this is the "Archivo_700Bold" file loaded by
// useAppFonts, used only for the LUMEN wordmark (see useAppFonts.ts).
export const fontFamily = {
  brand: 'Archivo_700Bold',
} as const;

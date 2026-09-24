// Extracted from movie-frontend's src/index.css @layer components (.font-ui,
// .font-mono-ui) and the font-weight classes actually used on top of them.
export const fontFamily = {
  ui: '"Archivo", "Manrope", sans-serif', // .font-ui
  mono: '"JetBrains Mono", monospace', // .font-mono-ui
} as const;

export const fontWeight = {
  medium: '500', // font-medium – e.g. AuthLayout's mono subtitle
  semibold: '600',
  bold: '700',
  black: '900',
} as const;

export type FontFamilyToken = keyof typeof fontFamily;
export type FontWeightToken = keyof typeof fontWeight;

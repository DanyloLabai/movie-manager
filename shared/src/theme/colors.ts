// Extracted from movie-frontend's hardcoded Tailwind arbitrary-value classes
// (e.g. bg-[#12100e], text-[#c8963c]) and src/index.css — there's no existing
// theme-token file there to import from, since the web app never centralized
// these. Grepped for every #rrggbb literal in movie-frontend/src and kept the
// values that recur across many files (one-off colors were left out).
export const colors = {
  background: '#12100e',
  backgroundElevated: '#1a1714',
  backgroundDeep: '#0f0d0a',
  // Modal/panel surface (e.g. rating modal, friends modal `bg-[#14110d]`).
  // Was previously '#14110c', which is actually `textOnAccent` below.
  surfaceMuted: '#14110d',
  // Full-black scrim used behind small badges/icons layered over poster art
  // (`bg-[rgba(15,13,10,.75)]`) — backgroundDeep at 75% opacity.
  overlayScrim: 'rgba(15, 13, 10, 0.75)',

  textPrimary: '#f0e6cc',
  textSecondary: '#f2ead9',
  // Secondary/hover-state light gray (e.g. default heart icon, hover text) —
  // distinct from textSecondary and textMuted.
  textSubtle: '#c9c0ac',
  textMuted: '#8f8574',
  textFaint: '#645c4d',
  // Dark text used on gold/accent-colored surfaces (buttons, selection highlight).
  textOnAccent: '#14110c',

  accent: '#c8963c',
  // Darker gold used in gradients (avatar circles, usage bars).
  accentDeep: '#a87c2e',
  accentBright: '#d9ac54',
  accentHighlight: '#e8c377',

  // Error/destructive hover state (e.g. delete buttons).
  danger: '#e0554d',

  border: 'rgba(217, 172, 84, 0.35)',
  // Most common divider/border opacity (headers, tab bars, card dividers).
  borderSubtle: 'rgba(217, 172, 84, 0.16)',
} as const;

export type ColorToken = keyof typeof colors;

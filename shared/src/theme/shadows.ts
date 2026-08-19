// Extracted verbatim from movie-frontend's src/index.css @layer components
// (.glow-gold-*, .btn-glass-gold, .btn-glass-dark).
export const shadows = {
  glowGoldSm: '0 0 16px -4px rgba(200, 150, 60, 0.35)',
  glowGold: '0 8px 30px -8px rgba(200, 150, 60, 0.4)',
  glowGoldLg: '0 0 40px -8px rgba(200, 150, 60, 0.55)',
  btnGlassGold:
    'inset 0 1px 0 rgba(255, 255, 255, 0.35), 0 8px 20px -8px rgba(200, 150, 60, 0.5)',
  btnGlassGoldHover:
    'inset 0 1px 0 rgba(255, 255, 255, 0.45), 0 10px 28px -6px rgba(200, 150, 60, 0.7)',
  btnGlassDark: 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
} as const;

export type ShadowToken = keyof typeof shadows;

// Ported from movie-frontend/src/data/journeyLotr.ts. Coordinates live in the
// map artwork's own 960×740 space, so the same numbers work at any rendered
// size. `id` doubles as the i18n key under profile:journey.stops.<id>.
export interface JourneyStop {
  id: string;
  threshold: number;
  x: number;
  y: number;
  isFinale?: boolean;
}

const ROUTE: Omit<JourneyStop, 'threshold'>[] = [
  { id: 'shire', x: 106, y: 337 },
  { id: 'hobbiton', x: 134, y: 323 },
  { id: 'buckland', x: 192, y: 342 },
  { id: 'old_forest', x: 202, y: 309 },
  { id: 'bree', x: 269, y: 275 },
  { id: 'weathertop', x: 336, y: 251 },
  { id: 'fords_of_bruinen', x: 398, y: 232 },
  { id: 'rivendell', x: 432, y: 193 },
  { id: 'caradhras', x: 442, y: 280 },
  { id: 'moria', x: 456, y: 385 },
  { id: 'lothlorien', x: 518, y: 395 },
  { id: 'anduin', x: 504, y: 481 },
  { id: 'amon_hen', x: 490, y: 529 },
  { id: 'emyn_muil', x: 552, y: 544 },
  { id: 'dead_marshes', x: 624, y: 481 },
  { id: 'black_gate', x: 805, y: 548 },
  { id: 'ithilien', x: 680, y: 630 },
  { id: 'cirith_ungol', x: 802, y: 674 },
  { id: 'gorgoroth', x: 872, y: 614 },
  { id: 'mount_doom', x: 878, y: 570, isFinale: true },
];

// Triangular thresholds: stop n unlocks at n(n+1)/2 movies, so early stops come
// quickly and the finale takes real dedication.
export const LOTR_STOPS: JourneyStop[] = ROUTE.map((stop, i) => ({
  ...stop,
  threshold: ((i + 1) * (i + 2)) / 2,
}));

export const JOURNEY_VIEWBOX = { w: 960, h: 740 };

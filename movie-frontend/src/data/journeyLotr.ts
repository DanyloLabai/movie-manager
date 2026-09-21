import type { TranslationKey } from "../context/LanguageContext";

export interface JourneyStop {
  id: string;
  nameKey: TranslationKey;
  threshold: number;
  x: number;
  y: number;
  isFinale?: boolean;
}

const ROUTE: Omit<JourneyStop, "threshold">[] = [
  { id: "shire", nameKey: "journey_stop_shire", x: 106, y: 337 },
  { id: "hobbiton", nameKey: "journey_stop_hobbiton", x: 134, y: 323 },
  { id: "buckland", nameKey: "journey_stop_buckland", x: 192, y: 342 },
  { id: "old_forest", nameKey: "journey_stop_old_forest", x: 202, y: 309 },
  { id: "bree", nameKey: "journey_stop_bree", x: 269, y: 275 },
  { id: "weathertop", nameKey: "journey_stop_weathertop", x: 336, y: 251 },
  {
    id: "fords_of_bruinen",
    nameKey: "journey_stop_fords_of_bruinen",
    x: 398,
    y: 232,
  },
  { id: "rivendell", nameKey: "journey_stop_rivendell", x: 432, y: 193 },
  { id: "caradhras", nameKey: "journey_stop_caradhras", x: 442, y: 280 },
  { id: "moria", nameKey: "journey_stop_moria", x: 456, y: 385 },
  { id: "lothlorien", nameKey: "journey_stop_lothlorien", x: 518, y: 395 },
  { id: "anduin", nameKey: "journey_stop_anduin", x: 504, y: 481 },
  { id: "amon_hen", nameKey: "journey_stop_amon_hen", x: 490, y: 529 },
  { id: "emyn_muil", nameKey: "journey_stop_emyn_muil", x: 552, y: 544 },
  { id: "dead_marshes", nameKey: "journey_stop_dead_marshes", x: 624, y: 481 },
  { id: "black_gate", nameKey: "journey_stop_black_gate", x: 805, y: 548 },
  { id: "ithilien", nameKey: "journey_stop_ithilien", x: 680, y: 630 },
  { id: "cirith_ungol", nameKey: "journey_stop_cirith_ungol", x: 802, y: 674 },
  { id: "gorgoroth", nameKey: "journey_stop_gorgoroth", x: 872, y: 614 },
  {
    id: "mount_doom",
    nameKey: "journey_stop_mount_doom",
    x: 878,
    y: 570,
    isFinale: true,
  },
];

export const LOTR_STOPS: JourneyStop[] = ROUTE.map((stop, i) => ({
  ...stop,
  threshold: ((i + 1) * (i + 2)) / 2,
}));

export const JOURNEY_VIEWBOX = { w: 960, h: 740 };

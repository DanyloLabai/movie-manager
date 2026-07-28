import type { ActivityActionType, ActivityDay } from "../api/users.api";
import type { TranslationKey } from "../context/LanguageContext";

export type { ActivityActionType, ActivityDay };

export interface HeatmapDay extends ActivityDay {
  inYear: boolean;
}

// 5 shades from the card background up to the full accent color, used for
// both the grid squares and the "Less ... More" legend.
export const ACTIVITY_LEVEL_CLASSES = [
  "bg-white/[.045]",
  "bg-[#3a2f1a]",
  "bg-[#6b5426]",
  "bg-[#a5822f]",
  "bg-[#d9ac54]",
];

export function getActivityLevel(count: number): number {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

export const ACTIVITY_ACTION_ICONS: Record<ActivityActionType, string> = {
  watched: "\u{1F441}️",
  added_watchlist: "➕",
  rated: "⭐",
  favorited: "❤️",
};

export function activityActionLabel(
  actionType: ActivityActionType,
  t: (key: TranslationKey) => string,
): string {
  switch (actionType) {
    case "watched":
      return t("feed_watched");
    case "added_watchlist":
      return t("feed_added_watchlist");
    case "rated":
      return t("feed_rated");
    case "favorited":
      return t("feed_favorited");
  }
}

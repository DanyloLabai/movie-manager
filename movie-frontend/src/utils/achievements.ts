import type { TranslationKey } from "../context/LanguageContext";

type T = (key: TranslationKey) => string;

export function getUserRank(watchedCount: number, t: T): string {
  if (watchedCount >= 100) return t("rank_film_legend");
  if (watchedCount >= 50) return t("rank_cinema_curator");
  if (watchedCount >= 20) return t("rank_cinephile");
  if (watchedCount >= 5) return t("rank_movie_enthusiast");
  return t("rank_cinema_guest");
}

export interface Achievement {
  id: string;
  isUnlocked: boolean;
  text: string;
  requirement: string;
  current: number;
  needed: number;
}

export function getAchievementsList(
  counts: { favoritesCount: number; watchedCount: number; totalCount: number },
  t: T,
): Achievement[] {
  const { favoritesCount, watchedCount, totalCount } = counts;
  return [
    {
      id: "first_blood",
      isUnlocked: totalCount > 0,
      text: t("achievement_first_blood_text"),
      requirement: t("achievement_first_blood_req"),
      current: totalCount,
      needed: 1,
    },
    {
      id: "critic",
      isUnlocked: favoritesCount >= 5,
      text: t("achievement_critic_text"),
      requirement: t("achievement_critic_req"),
      current: favoritesCount,
      needed: 5,
    },
    {
      id: "cinephile",
      isUnlocked: watchedCount >= 10,
      text: t("achievement_cinephile_text"),
      requirement: t("achievement_cinephile_req"),
      current: watchedCount,
      needed: 10,
    },
    {
      id: "collector",
      isUnlocked: totalCount >= 20,
      text: t("achievement_collector_text"),
      requirement: t("achievement_collector_req"),
      current: totalCount,
      needed: 20,
    },
    {
      id: "tastemaker",
      isUnlocked: favoritesCount >= 20,
      text: t("achievement_tastemaker_text"),
      requirement: t("achievement_tastemaker_req"),
      current: favoritesCount,
      needed: 20,
    },
    {
      id: "filmbuff",
      isUnlocked: watchedCount >= 50,
      text: t("achievement_filmbuff_text"),
      requirement: t("achievement_filmbuff_req"),
      current: watchedCount,
      needed: 50,
    },
    {
      id: "librarian",
      isUnlocked: totalCount >= 100,
      text: t("achievement_librarian_text"),
      requirement: t("achievement_librarian_req"),
      current: totalCount,
      needed: 100,
    },
  ];
}

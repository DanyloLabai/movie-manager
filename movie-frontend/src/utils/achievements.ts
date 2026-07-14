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

export interface AchievementCounts {
  favoritesCount: number;
  watchedCount: number;
  totalCount: number;
  quizSolvedCount?: number;
  quizPerfectCount?: number;
  quizCurrentStreak?: number;
}

export function getAchievementsList(
  counts: AchievementCounts,
  t: T,
): Achievement[] {
  const {
    favoritesCount,
    watchedCount,
    totalCount,
    quizSolvedCount = 0,
    quizPerfectCount = 0,
    quizCurrentStreak = 0,
  } = counts;
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
    {
      id: "quiz_first_win",
      isUnlocked: quizSolvedCount >= 1,
      text: t("achievement_quiz_first_win_text"),
      requirement: t("achievement_quiz_first_win_req"),
      current: quizSolvedCount,
      needed: 1,
    },
    {
      id: "quiz_perfectionist",
      isUnlocked: quizPerfectCount >= 1,
      text: t("achievement_quiz_perfectionist_text"),
      requirement: t("achievement_quiz_perfectionist_req"),
      current: quizPerfectCount,
      needed: 1,
    },
    {
      id: "quiz_streak_7",
      isUnlocked: quizCurrentStreak >= 7,
      text: t("achievement_quiz_streak_7_text"),
      requirement: t("achievement_quiz_streak_7_req"),
      current: quizCurrentStreak,
      needed: 7,
    },
    {
      id: "quiz_streak_30",
      isUnlocked: quizCurrentStreak >= 30,
      text: t("achievement_quiz_streak_30_text"),
      requirement: t("achievement_quiz_streak_30_req"),
      current: quizCurrentStreak,
      needed: 30,
    },
    {
      id: "quiz_veteran",
      isUnlocked: quizSolvedCount >= 50,
      text: t("achievement_quiz_veteran_text"),
      requirement: t("achievement_quiz_veteran_req"),
      current: quizSolvedCount,
      needed: 50,
    },
  ];
}

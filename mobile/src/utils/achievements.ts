// Ported from movie-frontend/src/utils/achievements.ts. Text/requirement
// strings are resolved via the i18next singleton (not a hook) since these
// are plain functions — the calling component's own useTranslation() call
// forces the re-render that picks up a language change.
import i18n from '../i18n';

export function getUserRank(watchedCount: number): string {
  if (watchedCount >= 100) return i18n.t('quiz:ranks.filmLegend');
  if (watchedCount >= 50) return i18n.t('quiz:ranks.cinemaCurator');
  if (watchedCount >= 20) return i18n.t('quiz:ranks.cinephile');
  if (watchedCount >= 5) return i18n.t('quiz:ranks.movieEnthusiast');
  return i18n.t('quiz:ranks.cinemaGuest');
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

export function getAchievementsList(counts: AchievementCounts): Achievement[] {
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
      id: 'first_blood',
      isUnlocked: totalCount > 0,
      text: i18n.t('quiz:achievements.first_blood.text'),
      requirement: i18n.t('quiz:achievements.first_blood.requirement'),
      current: totalCount,
      needed: 1,
    },
    {
      id: 'critic',
      isUnlocked: favoritesCount >= 5,
      text: i18n.t('quiz:achievements.critic.text'),
      requirement: i18n.t('quiz:achievements.critic.requirement'),
      current: favoritesCount,
      needed: 5,
    },
    {
      id: 'cinephile',
      isUnlocked: watchedCount >= 10,
      text: i18n.t('quiz:achievements.cinephile.text'),
      requirement: i18n.t('quiz:achievements.cinephile.requirement'),
      current: watchedCount,
      needed: 10,
    },
    {
      id: 'collector',
      isUnlocked: totalCount >= 20,
      text: i18n.t('quiz:achievements.collector.text'),
      requirement: i18n.t('quiz:achievements.collector.requirement'),
      current: totalCount,
      needed: 20,
    },
    {
      id: 'tastemaker',
      isUnlocked: favoritesCount >= 20,
      text: i18n.t('quiz:achievements.tastemaker.text'),
      requirement: i18n.t('quiz:achievements.tastemaker.requirement'),
      current: favoritesCount,
      needed: 20,
    },
    {
      id: 'filmbuff',
      isUnlocked: watchedCount >= 50,
      text: i18n.t('quiz:achievements.filmbuff.text'),
      requirement: i18n.t('quiz:achievements.filmbuff.requirement'),
      current: watchedCount,
      needed: 50,
    },
    {
      id: 'librarian',
      isUnlocked: totalCount >= 100,
      text: i18n.t('quiz:achievements.librarian.text'),
      requirement: i18n.t('quiz:achievements.librarian.requirement'),
      current: totalCount,
      needed: 100,
    },
    {
      id: 'quiz_first_win',
      isUnlocked: quizSolvedCount >= 1,
      text: i18n.t('quiz:achievements.quiz_first_win.text'),
      requirement: i18n.t('quiz:achievements.quiz_first_win.requirement'),
      current: quizSolvedCount,
      needed: 1,
    },
    {
      id: 'quiz_perfectionist',
      isUnlocked: quizPerfectCount >= 1,
      text: i18n.t('quiz:achievements.quiz_perfectionist.text'),
      requirement: i18n.t('quiz:achievements.quiz_perfectionist.requirement'),
      current: quizPerfectCount,
      needed: 1,
    },
    {
      id: 'quiz_streak_7',
      isUnlocked: quizCurrentStreak >= 7,
      text: i18n.t('quiz:achievements.quiz_streak_7.text'),
      requirement: i18n.t('quiz:achievements.quiz_streak_7.requirement'),
      current: quizCurrentStreak,
      needed: 7,
    },
    {
      id: 'quiz_streak_30',
      isUnlocked: quizCurrentStreak >= 30,
      text: i18n.t('quiz:achievements.quiz_streak_30.text'),
      requirement: i18n.t('quiz:achievements.quiz_streak_30.requirement'),
      current: quizCurrentStreak,
      needed: 30,
    },
    {
      id: 'quiz_veteran',
      isUnlocked: quizSolvedCount >= 50,
      text: i18n.t('quiz:achievements.quiz_veteran.text'),
      requirement: i18n.t('quiz:achievements.quiz_veteran.requirement'),
      current: quizSolvedCount,
      needed: 50,
    },
  ];
}

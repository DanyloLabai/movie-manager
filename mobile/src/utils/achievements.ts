// Ported from movie-frontend/src/utils/achievements.ts, with translation
// keys inlined as plain English (mobile has no i18n layer yet).

export function getUserRank(watchedCount: number): string {
  if (watchedCount >= 100) return 'Film Legend';
  if (watchedCount >= 50) return 'Cinema Curator';
  if (watchedCount >= 20) return 'Cinephile';
  if (watchedCount >= 5) return 'Movie Enthusiast';
  return 'Cinema Guest';
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
      text: 'First Blood',
      requirement: 'Add 1 movie to watchlist or mark as watched',
      current: totalCount,
      needed: 1,
    },
    {
      id: 'critic',
      isUnlocked: favoritesCount >= 5,
      text: 'Critic',
      requirement: 'Add 5 movies to favorites',
      current: favoritesCount,
      needed: 5,
    },
    {
      id: 'cinephile',
      isUnlocked: watchedCount >= 10,
      text: 'Cinephile',
      requirement: 'Mark 10 movies as watched',
      current: watchedCount,
      needed: 10,
    },
    {
      id: 'collector',
      isUnlocked: totalCount >= 20,
      text: 'Collector',
      requirement: 'Collect 20 movies total (watched + watchlist)',
      current: totalCount,
      needed: 20,
    },
    {
      id: 'tastemaker',
      isUnlocked: favoritesCount >= 20,
      text: 'Tastemaker',
      requirement: 'Add 20 movies to favorites',
      current: favoritesCount,
      needed: 20,
    },
    {
      id: 'filmbuff',
      isUnlocked: watchedCount >= 50,
      text: 'Film Buff',
      requirement: 'Mark 50 movies as watched',
      current: watchedCount,
      needed: 50,
    },
    {
      id: 'librarian',
      isUnlocked: totalCount >= 100,
      text: 'Librarian',
      requirement: 'Collect 100 movies total (watched + watchlist)',
      current: totalCount,
      needed: 100,
    },
    {
      id: 'quiz_first_win',
      isUnlocked: quizSolvedCount >= 1,
      text: 'Quiz Rookie',
      requirement: 'Solve your first daily quiz',
      current: quizSolvedCount,
      needed: 1,
    },
    {
      id: 'quiz_perfectionist',
      isUnlocked: quizPerfectCount >= 1,
      text: 'Perfectionist',
      requirement: 'Solve a quiz with no hints and one guess',
      current: quizPerfectCount,
      needed: 1,
    },
    {
      id: 'quiz_streak_7',
      isUnlocked: quizCurrentStreak >= 7,
      text: 'Week Streak',
      requirement: 'Reach a 7-day quiz streak',
      current: quizCurrentStreak,
      needed: 7,
    },
    {
      id: 'quiz_streak_30',
      isUnlocked: quizCurrentStreak >= 30,
      text: 'Month Streak',
      requirement: 'Reach a 30-day quiz streak',
      current: quizCurrentStreak,
      needed: 30,
    },
    {
      id: 'quiz_veteran',
      isUnlocked: quizSolvedCount >= 50,
      text: 'Quiz Veteran',
      requirement: 'Solve 50 daily quizzes',
      current: quizSolvedCount,
      needed: 50,
    },
  ];
}

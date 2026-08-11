import { describe, it, expect, vi } from "vitest";
import { getUserRank, getAchievementsList } from "./achievements";

const t = vi.fn((key: string) => key);

describe("getUserRank", () => {
  it("returns cinema guest for a new user with 0 watched", () => {
    expect(getUserRank(0, t)).toBe("rank_cinema_guest");
  });

  it("returns movie enthusiast at the 5-watched threshold", () => {
    expect(getUserRank(5, t)).toBe("rank_movie_enthusiast");
  });

  it("returns cinephile at the 20-watched threshold", () => {
    expect(getUserRank(20, t)).toBe("rank_cinephile");
  });

  it("returns cinema curator at the 50-watched threshold", () => {
    expect(getUserRank(50, t)).toBe("rank_cinema_curator");
  });

  it("returns film legend at the 100-watched threshold", () => {
    expect(getUserRank(100, t)).toBe("rank_film_legend");
  });

  it("does not round up just below a threshold", () => {
    expect(getUserRank(4, t)).toBe("rank_cinema_guest");
    expect(getUserRank(19, t)).toBe("rank_movie_enthusiast");
    expect(getUserRank(49, t)).toBe("rank_cinephile");
    expect(getUserRank(99, t)).toBe("rank_cinema_curator");
  });
});

describe("getAchievementsList", () => {
  const emptyCounts = { favoritesCount: 0, watchedCount: 0, totalCount: 0 };

  it("marks every achievement locked when all counts are zero", () => {
    const achievements = getAchievementsList(emptyCounts, t);
    expect(achievements.every((a) => !a.isUnlocked)).toBe(true);
  });

  it("unlocks achievements whose thresholds are met and keeps others locked", () => {
    const achievements = getAchievementsList(
      { favoritesCount: 5, watchedCount: 10, totalCount: 20 },
      t,
    );
    const byId = Object.fromEntries(achievements.map((a) => [a.id, a]));

    expect(byId.first_blood.isUnlocked).toBe(true);
    expect(byId.critic.isUnlocked).toBe(true);
    expect(byId.cinephile.isUnlocked).toBe(true);
    expect(byId.collector.isUnlocked).toBe(true);
    expect(byId.tastemaker.isUnlocked).toBe(false);
    expect(byId.filmbuff.isUnlocked).toBe(false);
    expect(byId.librarian.isUnlocked).toBe(false);
  });

  it("defaults quiz counts to 0 when omitted", () => {
    const achievements = getAchievementsList(emptyCounts, t);
    const byId = Object.fromEntries(achievements.map((a) => [a.id, a]));

    expect(byId.quiz_first_win.current).toBe(0);
    expect(byId.quiz_first_win.isUnlocked).toBe(false);
    expect(byId.quiz_streak_7.isUnlocked).toBe(false);
  });

  it("unlocks quiz achievements based on provided quiz counts", () => {
    const achievements = getAchievementsList(
      {
        ...emptyCounts,
        quizSolvedCount: 50,
        quizPerfectCount: 1,
        quizCurrentStreak: 30,
      },
      t,
    );
    const byId = Object.fromEntries(achievements.map((a) => [a.id, a]));

    expect(byId.quiz_first_win.isUnlocked).toBe(true);
    expect(byId.quiz_perfectionist.isUnlocked).toBe(true);
    expect(byId.quiz_streak_7.isUnlocked).toBe(true);
    expect(byId.quiz_streak_30.isUnlocked).toBe(true);
    expect(byId.quiz_veteran.isUnlocked).toBe(true);
  });
});

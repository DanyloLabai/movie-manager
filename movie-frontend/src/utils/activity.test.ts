import { describe, it, expect, vi } from "vitest";
import { getActivityLevel, activityActionLabel } from "./activity";

const t = vi.fn((key: string) => key);

describe("getActivityLevel", () => {
  it("returns level 0 for zero or negative counts", () => {
    expect(getActivityLevel(0)).toBe(0);
    expect(getActivityLevel(-1)).toBe(0);
  });

  it("returns level 1 for exactly one", () => {
    expect(getActivityLevel(1)).toBe(1);
  });

  it("returns level 2 for the 2-3 range", () => {
    expect(getActivityLevel(2)).toBe(2);
    expect(getActivityLevel(3)).toBe(2);
  });

  it("returns level 3 for the 4-6 range", () => {
    expect(getActivityLevel(4)).toBe(3);
    expect(getActivityLevel(6)).toBe(3);
  });

  it("returns level 4 for anything above 6", () => {
    expect(getActivityLevel(7)).toBe(4);
    expect(getActivityLevel(100)).toBe(4);
  });
});

describe("activityActionLabel", () => {
  it("maps each action type to its translation key", () => {
    expect(activityActionLabel("watched", t)).toBe("feed_watched");
    expect(activityActionLabel("added_watchlist", t)).toBe(
      "feed_added_watchlist",
    );
    expect(activityActionLabel("rated", t)).toBe("feed_rated");
    expect(activityActionLabel("favorited", t)).toBe("feed_favorited");
    expect(activityActionLabel("rewatched", t)).toBe("feed_rewatched");
  });
});

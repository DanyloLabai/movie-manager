import { describe, it, expect } from "vitest";
import { getCurrentStopIndex, isStopRevealed } from "./journey";
import { LOTR_STOPS } from "../data/journeyLotr";

describe("getCurrentStopIndex", () => {
  it("returns -1 when totalCount is below every threshold", () => {
    expect(getCurrentStopIndex(0, LOTR_STOPS)).toBe(-1);
  });

  it("returns the index of the last threshold met", () => {
    expect(getCurrentStopIndex(LOTR_STOPS[0].threshold, LOTR_STOPS)).toBe(0);
    expect(getCurrentStopIndex(LOTR_STOPS[2].threshold, LOTR_STOPS)).toBe(2);
    expect(getCurrentStopIndex(LOTR_STOPS[3].threshold - 1, LOTR_STOPS)).toBe(
      2,
    );
  });

  it("returns the final index once totalCount reaches the last threshold", () => {
    const lastThreshold = LOTR_STOPS[LOTR_STOPS.length - 1].threshold;
    expect(getCurrentStopIndex(lastThreshold, LOTR_STOPS)).toBe(
      LOTR_STOPS.length - 1,
    );
    expect(getCurrentStopIndex(lastThreshold + 999, LOTR_STOPS)).toBe(
      LOTR_STOPS.length - 1,
    );
  });
});

describe("isStopRevealed", () => {
  it("reveals the current stop and exactly one stop ahead", () => {
    const currentIndex = 3;
    expect(isStopRevealed(3, currentIndex)).toBe(true);
    expect(isStopRevealed(4, currentIndex)).toBe(true);
    expect(isStopRevealed(5, currentIndex)).toBe(false);
  });

  it("reveals only the first stop when nothing is unlocked yet", () => {
    expect(isStopRevealed(0, -1)).toBe(true);
    expect(isStopRevealed(1, -1)).toBe(false);
  });
});

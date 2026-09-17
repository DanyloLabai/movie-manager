import type { JourneyStop } from "../data/journeyLotr";

export function getCurrentStopIndex(
  totalCount: number,
  stops: JourneyStop[],
): number {
  return stops.reduce(
    (acc, stop, i) => (totalCount >= stop.threshold ? i : acc),
    -1,
  );
}

export function isStopRevealed(
  stopIndex: number,
  currentIndex: number,
): boolean {
  return stopIndex <= currentIndex + 1;
}

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { formatTimeAgo } from "./time";

const t = vi.fn((key: string) => key);

describe("formatTimeAgo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'just now' for a timestamp less than a minute ago", () => {
    const iso = new Date("2026-01-01T11:59:30Z").toISOString();
    expect(formatTimeAgo(iso, t)).toBe("time_just_now");
  });

  it("returns minutes for a timestamp under an hour ago", () => {
    const iso = new Date("2026-01-01T11:45:00Z").toISOString();
    expect(formatTimeAgo(iso, t)).toBe("15time_minutes_short");
  });

  it("returns hours for a timestamp under a day ago", () => {
    const iso = new Date("2026-01-01T06:00:00Z").toISOString();
    expect(formatTimeAgo(iso, t)).toBe("6time_hours_short");
  });

  it("returns days for a timestamp a day or more ago", () => {
    const iso = new Date("2025-12-29T12:00:00Z").toISOString();
    expect(formatTimeAgo(iso, t)).toBe("3time_days_short");
  });

  it("treats a future timestamp as 'just now' (negative/zero minutes)", () => {
    const iso = new Date("2026-01-01T12:05:00Z").toISOString();
    expect(formatTimeAgo(iso, t)).toBe("time_just_now");
  });
});

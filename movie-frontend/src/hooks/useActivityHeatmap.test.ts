import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useActivityHeatmap } from "./useActivityHeatmap";
import * as usersApi from "../api/users.api";
import type { ActivityDay } from "../api/users.api";

vi.mock("../api/users.api");

const mockedGetActivityHeatmap = vi.mocked(usersApi.getActivityHeatmap);

const CURRENT_YEAR = new Date().getFullYear();

const sampleDays: ActivityDay[] = [
  { date: "2026-01-01", count: 2, actions: [] },
];

describe("useActivityHeatmap", () => {
  beforeEach(() => {
    mockedGetActivityHeatmap.mockReset();
  });

  it("does not fetch when disabled", () => {
    renderHook(() => useActivityHeatmap(false));
    expect(mockedGetActivityHeatmap).not.toHaveBeenCalled();
  });

  it("fetches activity for the current year when enabled", async () => {
    mockedGetActivityHeatmap.mockResolvedValue(sampleDays);

    const { result } = renderHook(() => useActivityHeatmap(true));

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockedGetActivityHeatmap).toHaveBeenCalledWith(CURRENT_YEAR);
    expect(result.current.days).toEqual(sampleDays);
    expect(result.current.year).toBe(CURRENT_YEAR);
  });

  it("falls back to an empty list on fetch failure", async () => {
    mockedGetActivityHeatmap.mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() => useActivityHeatmap(true));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.days).toEqual([]);
  });

  it("navigates between years and refetches", async () => {
    mockedGetActivityHeatmap.mockResolvedValue(sampleDays);

    const { result } = renderHook(() => useActivityHeatmap(true));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.canGoNext).toBe(false);

    act(() => {
      result.current.goToPreviousYear();
    });
    await waitFor(() =>
      expect(mockedGetActivityHeatmap).toHaveBeenLastCalledWith(
        CURRENT_YEAR - 1,
      ),
    );
    expect(result.current.year).toBe(CURRENT_YEAR - 1);
    expect(result.current.canGoNext).toBe(true);

    act(() => {
      result.current.goToNextYear();
    });
    await waitFor(() =>
      expect(mockedGetActivityHeatmap).toHaveBeenLastCalledWith(CURRENT_YEAR),
    );
    expect(result.current.year).toBe(CURRENT_YEAR);
  });

  it("does not advance past the current year", async () => {
    mockedGetActivityHeatmap.mockResolvedValue(sampleDays);

    const { result } = renderHook(() => useActivityHeatmap(true));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.goToNextYear();
    });

    expect(result.current.year).toBe(CURRENT_YEAR);
  });
});

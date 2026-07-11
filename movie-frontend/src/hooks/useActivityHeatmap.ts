import { useCallback, useEffect, useState } from "react";
import * as usersApi from "../api/users.api";
import type { ActivityDay } from "../api/users.api";

const CURRENT_YEAR = new Date().getFullYear();

export function useActivityHeatmap(enabled: boolean) {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [days, setDays] = useState<ActivityDay[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchActivity = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await usersApi.getActivityHeatmap(year);
      setDays(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [year]);

  useEffect(() => {
    if (enabled) fetchActivity();
  }, [enabled, fetchActivity]);

  const goToPreviousYear = useCallback(() => setYear((y) => y - 1), []);
  const goToNextYear = useCallback(
    () => setYear((y) => Math.min(y + 1, CURRENT_YEAR)),
    [],
  );

  return {
    days,
    isLoading,
    year,
    goToPreviousYear,
    goToNextYear,
    canGoNext: year < CURRENT_YEAR,
  } as const;
}

export default useActivityHeatmap;

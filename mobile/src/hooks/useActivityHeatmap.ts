import { useCallback, useEffect, useState } from 'react';
import { getActivityHeatmap, type ActivityDay } from '../api/users.api';

const CURRENT_YEAR = new Date().getFullYear();

export function useActivityHeatmap(enabled: boolean) {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [days, setDays] = useState<ActivityDay[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchActivity = useCallback(async () => {
    setIsLoading(true);
    try {
      setDays(await getActivityHeatmap(year));
    } catch {
      // Best-effort — heatmap just stays empty.
    } finally {
      setIsLoading(false);
    }
  }, [year]);

  useEffect(() => {
    if (enabled) void fetchActivity();
  }, [enabled, fetchActivity]);

  return {
    days,
    isLoading,
    year,
    goToPreviousYear: () => setYear((y) => y - 1),
    goToNextYear: () => setYear((y) => Math.min(y + 1, CURRENT_YEAR)),
    canGoNext: year < CURRENT_YEAR,
  } as const;
}

export default useActivityHeatmap;

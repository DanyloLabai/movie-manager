import { useCallback, useEffect, useState } from "react";
import * as usersApi from "../api/users.api";
import type { ActivityDay } from "../api/users.api";

export function useActivityHeatmap(enabled: boolean) {
  const [year] = useState(() => new Date().getFullYear());
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

  return { days, isLoading, year } as const;
}

export default useActivityHeatmap;

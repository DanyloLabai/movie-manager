export function logError(context: string) {
  return (error: unknown): void => {
    if (import.meta.env.DEV) {
      console.warn(`[${context}]`, error);
    }
  };
}

export function logFallback<T>(context: string, fallback: T) {
  return (error: unknown): T => {
    logError(context)(error);
    return fallback;
  };
}

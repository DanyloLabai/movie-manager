// STORAGE_KEYS not needed here

type CacheEntry<T> = { value: T; expiresAt?: number };

export function getCachedItem<T>(key: string) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed.value as T;
  } catch {
    return null;
  }
}

export function setCachedItem<T>(key: string, value: T, ttlMs?: number) {
  const entry: CacheEntry<T> = { value };
  if (ttlMs) entry.expiresAt = Date.now() + ttlMs;
  try {
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // ignore
  }
}

export default { getCachedItem, setCachedItem };

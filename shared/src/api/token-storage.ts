// Injected by the caller so this package never hardcodes a storage backend —
// movie-frontend (if it opts in later) would supply a localStorage-backed
// adapter, mobile supplies one backed by expo-secure-store. Always
// Promise-returning so both a sync backend (localStorage) and an inherently
// async one (expo-secure-store) satisfy the same interface.
export interface TokenStorage {
  getAccessToken(): Promise<string | null>;
  setAccessToken(token: string | null): Promise<void>;
  getRefreshToken(): Promise<string | null>;
  setRefreshToken(token: string | null): Promise<void>;
  getUser<T = unknown>(): Promise<T | null>;
  setUser(user: unknown | null): Promise<void>;
  clear(): Promise<void>;
}

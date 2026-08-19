import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { AuthUser } from '@movie-manager/shared';
import { secureTokenStorage } from '../storage/secureTokenStorage';
import { setForceLogoutHandler } from '../api/client';
import { logout as logoutRequest } from '../api/auth.api';

interface LoginParams {
  accessToken: string;
  refreshToken?: string | null;
  user: AuthUser;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (params: LoginParams) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  // Starts true — RootNavigator waits for this before rendering Auth vs Main,
  // otherwise a returning user would flash the login screen every launch
  // while secure storage is read.
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [storedToken, storedUser] = await Promise.all([
        secureTokenStorage.getAccessToken(),
        secureTokenStorage.getUser<AuthUser>(),
      ]);
      if (storedToken && storedUser) {
        setUser(storedUser);
      }
      setIsLoading(false);
    })();
  }, []);

  const login = useCallback(async ({ accessToken, refreshToken, user: newUser }: LoginParams) => {
    await secureTokenStorage.setAccessToken(accessToken);
    if (refreshToken) await secureTokenStorage.setRefreshToken(refreshToken);
    await secureTokenStorage.setUser(newUser);
    setUser(newUser);
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch {
      // Best-effort — still clear local state even if the server call fails
      // (e.g. already-expired session, offline).
    }
    await secureTokenStorage.clear();
    setUser(null);
  }, []);

  // Wires the shared api client's onForceLogout (fired when a 401 survives a
  // refresh attempt) back into this context. Module-level indirection
  // because the client is a plain singleton created outside React — see
  // mobile/src/api/client.ts.
  useEffect(() => {
    setForceLogoutHandler(() => {
      void secureTokenStorage.clear();
      setUser(null);
    });
    return () => setForceLogoutHandler(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, isLoading, isAuthenticated: !!user, login, logout }),
    [user, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

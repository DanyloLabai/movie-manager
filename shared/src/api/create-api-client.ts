import axios, { type AxiosInstance, type AxiosRequestHeaders } from 'axios';
import type { TokenStorage } from './token-storage';

export interface CreateApiClientOptions {
  baseURL: string;
  // Explicitly passed in by the caller rather than sniffed (e.g.
  // `navigator.product === 'ReactNative'`) — keeps this package
  // platform-agnostic and testable.
  platform: 'web' | 'mobile';
  tokenStorage: TokenStorage;
  // Navigation/redirect side effect on an unrecoverable 401, supplied by the caller.
  onForceLogout?: () => void;
}

const AUTH_ENDPOINTS = ['/auth/signin', '/auth/signup', '/auth/refresh'];

// Web-branch is written and mirrors movie-frontend's existing
// src/api/index.ts (cookie-based refresh via withCredentials) so a future
// opt-in there is a drop-in swap, but it's unused/untested until movie-frontend
// actually adopts this client — this task doesn't touch movie-frontend.
//
// Mobile-branch needs a different refresh mechanism: movie-backend's refresh
// endpoint currently reads the refresh token ONLY from an httpOnly cookie
// (movie-backend/src/auth/auth-jwt-strategy.ts), which React Native has no
// equivalent of. That requires a small backend change (body-token fallback,
// gated behind an `X-Client-Platform: mobile` header) — see the mobile auth
// plan. Until that backend change lands, the mobile branch below will not be
// able to refresh a token; access-token-only auth still works.
export function createApiClient(options: CreateApiClientOptions): AxiosInstance {
  const { baseURL, platform, tokenStorage, onForceLogout } = options;

  const api = axios.create({
    baseURL,
    withCredentials: platform === 'web',
  });

  if (platform === 'mobile') {
    api.defaults.headers.common['X-Client-Platform'] = 'mobile';
  }

  api.interceptors.request.use(async (config) => {
    const token = await tokenStorage.getAccessToken();
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      } as AxiosRequestHeaders;
    }
    return config;
  });

  let refreshPromise: Promise<string | null> | null = null;

  async function refreshAccessToken(): Promise<string | null> {
    if (!refreshPromise) {
      refreshPromise = (async () => {
        try {
          const body =
            platform === 'mobile'
              ? { refresh_token: await tokenStorage.getRefreshToken() }
              : undefined;
          const res = await api.post('/auth/refresh', body);
          const newAccessToken = res.data?.access_token as string | undefined;
          if (!newAccessToken) return null;

          await tokenStorage.setAccessToken(newAccessToken);
          if (res.data?.user) await tokenStorage.setUser(res.data.user);
          // Refresh tokens rotate on every use server-side (auth.service.ts
          // storeRefreshToken) — mobile must persist the new one from every
          // refresh response, not just the one from sign-in.
          if (platform === 'mobile' && res.data?.refresh_token) {
            await tokenStorage.setRefreshToken(res.data.refresh_token as string);
          }
          api.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
          return newAccessToken;
        } catch {
          return null;
        } finally {
          refreshPromise = null;
        }
      })();
    }
    return refreshPromise;
  }

  async function forceLogout() {
    await tokenStorage.clear();
    delete api.defaults.headers.common['Authorization'];
    onForceLogout?.();
  }

  api.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;
      const isAuthEndpoint =
        typeof originalRequest?.url === 'string' &&
        AUTH_ENDPOINTS.some((endpoint) => originalRequest.url.includes(endpoint));

      if (
        error.response?.status === 401 &&
        originalRequest &&
        !originalRequest._retry &&
        !isAuthEndpoint
      ) {
        originalRequest._retry = true;
        const newToken = await refreshAccessToken();

        if (newToken) {
          originalRequest.headers = {
            ...originalRequest.headers,
            Authorization: `Bearer ${newToken}`,
          };
          return api(originalRequest);
        }

        await forceLogout();
      }

      return Promise.reject(error);
    },
  );

  return api;
}

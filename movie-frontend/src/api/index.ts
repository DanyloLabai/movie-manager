import axios from "axios";
import type { AxiosRequestHeaders } from "axios";
import { STORAGE_KEYS } from "../constants/storage";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
});

export const apiEventBus = new EventTarget();

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
  if (token) {
    if (!config.headers) config.headers = {} as AxiosRequestHeaders;
    (config.headers as AxiosRequestHeaders)["Authorization"] =
      `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = api
      .post("/auth/refresh")
      .then((res) => {
        const newToken = res.data?.access_token as string | undefined;
        if (newToken) {
          localStorage.setItem(STORAGE_KEYS.TOKEN, newToken);
          if (res.data?.user) {
            localStorage.setItem(
              STORAGE_KEYS.USER,
              JSON.stringify(res.data.user),
            );
          }
          api.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
          return newToken;
        }
        return null;
      })
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

function forceLogout() {
  localStorage.removeItem(STORAGE_KEYS.TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER);
  delete api.defaults.headers.common["Authorization"];
  window.location.href = "/login";
}

api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const isAuthEndpoint =
      typeof originalRequest?.url === "string" &&
      (originalRequest.url.includes("/auth/signin") ||
        originalRequest.url.includes("/auth/signup") ||
        originalRequest.url.includes("/auth/refresh"));

    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthEndpoint
    ) {
      const hadToken = !!localStorage.getItem(STORAGE_KEYS.TOKEN);
      if (!hadToken) {
        // Guest hitting an authenticated-only endpoint (e.g. background
        // calls on the public search page)- let the caller handle it
        // instead of bouncing a never-logged-in visitor to /login.
        return Promise.reject(error);
      }

      originalRequest._retry = true;
      const newToken = await refreshAccessToken();

      if (newToken) {
        originalRequest.headers = {
          ...originalRequest.headers,
          Authorization: `Bearer ${newToken}`,
        };
        return api(originalRequest);
      }

      forceLogout();
    }

    return Promise.reject(error);
  },
);

export default api;

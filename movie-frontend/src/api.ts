import axios from "axios";
import { STORAGE_KEYS } from "./constants/storage";

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second
const RETRY_STATUS_CODES = [429, 503, 504]; // Rate limit, Service unavailable, Gateway timeout

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
});

// Track retry attempts per request
const retryCount = new Map<string, number>();

// EventTarget for notifications
export const apiEventBus = new EventTarget();

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

api.interceptors.response.use(
  (response) => {
    // Clear retry count on success
    if (response.config) {
      const key = `${response.config.method}:${response.config.url}`;
      retryCount.delete(key);
    }
    return response;
  },
  async (error) => {
    const config = error.config;

    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER);
      delete api.defaults.headers.common["Authorization"];

      // Redirect to login
      window.location.href = "/login";
    }

    if (error.response?.status === 403) {
      // Forbidden - insufficient permissions
      console.error("Access denied:", error.response.data);
    }

    if (
      error.response &&
      RETRY_STATUS_CODES.includes(error.response.status) &&
      config
    ) {
      // Rate limiting or service unavailable - retry with exponential backoff
      const key = `${config.method}:${config.url}`;
      const attempts = retryCount.get(key) || 0;

      if (attempts < MAX_RETRIES) {
        retryCount.set(key, attempts + 1);
        const delay = RETRY_DELAY * Math.pow(2, attempts); // Exponential backoff: 1s, 2s, 4s

        const statusCode = error.response.status;
        const statusText =
          statusCode === 429
            ? "Rate limited"
            : statusCode === 503
              ? "Service unavailable"
              : "Gateway timeout";

        console.warn(
          `${statusText}. Retrying in ${delay}ms (attempt ${attempts + 1}/${MAX_RETRIES})`,
        );

        // Emit retry event for UI notification
        apiEventBus.dispatchEvent(
          new CustomEvent("api:retry", {
            detail: {
              status: statusCode,
              attempt: attempts + 1,
              maxAttempts: MAX_RETRIES,
              delay,
            },
          }),
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
        return api(config);
      } else {
        // All retries failed
        retryCount.delete(key);
        const statusCode = error.response.status;
        const statusText =
          statusCode === 429
            ? "Too many requests. Please try again in a few minutes."
            : statusCode === 503
              ? "Service unavailable. Please try again later."
              : "Gateway timeout. Please try again.";

        error.response.data.message = statusText;

        // Emit failure event
        apiEventBus.dispatchEvent(
          new CustomEvent("api:maxRetriesExceeded", {
            detail: {
              status: statusCode,
              message: statusText,
            },
          }),
        );
      }
    }

    return Promise.reject(error);
  },
);

import axios from "axios";
import { STORAGE_KEYS } from "./constants/storage";

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
});

// Track retry attempts
const retryCount = new Map<string, number>();

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
  (response) => response,
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

    if (error.response?.status === 429) {
      // Too Many Requests - Rate limiting
      const key = `${config.method}:${config.url}`;
      const attempts = retryCount.get(key) || 0;

      if (attempts < MAX_RETRIES) {
        retryCount.set(key, attempts + 1);
        const delay = RETRY_DELAY * Math.pow(2, attempts); // Exponential backoff

        console.warn(
          `Rate limited. Retrying in ${delay}ms (attempt ${attempts + 1}/${MAX_RETRIES})`,
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
        return api(config);
      } else {
        retryCount.delete(key);
        error.response.data.message =
          "Too many requests. Please try again in a few minutes.";
      }
    }

    return Promise.reject(error);
  },
);

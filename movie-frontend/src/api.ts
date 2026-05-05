import axios from "axios";
import { STORAGE_KEYS } from "./constants/storage";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
});

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
  (error) => {
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

    return Promise.reject(error);
  },
);

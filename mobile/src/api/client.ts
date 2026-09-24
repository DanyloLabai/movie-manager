import { Platform } from 'react-native';
import { createApiClient } from '@movie-manager/shared';
import { secureTokenStorage } from '../storage/secureTokenStorage';

// EXPO_PUBLIC_-prefixed vars are inlined at build time by Expo (same idea as
// Vite's VITE_ prefix) — set this in mobile/.env for a physical device
// (your machine's LAN IP, e.g. http://192.168.1.20:3000/api), since
// "localhost" on a physical device means the phone itself, not your
// computer. The fallbacks below only work for emulators/simulators:
// Android's emulator maps 10.0.2.2 to the host machine, iOS's simulator
// shares the host's network so "localhost" works directly.
const DEFAULT_BASE_URL =
  Platform.OS === 'android' ? 'http://10.0.2.2:3000/api' : 'http://localhost:3000/api';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? DEFAULT_BASE_URL;

// The shared axios interceptor calls this on an unrecoverable 401 (refresh
// failed too). Set by AuthContext on mount — module-level indirection
// because this client is a plain module-scope singleton, outside React.
let forceLogoutHandler: (() => void) | null = null;

export function setForceLogoutHandler(handler: (() => void) | null) {
  forceLogoutHandler = handler;
}

export const api = createApiClient({
  baseURL: API_BASE_URL,
  platform: 'mobile',
  tokenStorage: secureTokenStorage,
  onForceLogout: () => forceLogoutHandler?.(),
});

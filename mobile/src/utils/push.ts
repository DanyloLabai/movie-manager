import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as pushApi from '../api/push.api';

// Mirrors movie-frontend's utils/push.ts state shape
// (isPushSupported/isPushSubscribed/enable/disable) so SettingsScreen wires
// up the same way movie-frontend's Settings.tsx does, using Expo's push
// service instead of browser VAPID web-push.
export function isPushSupported(): boolean {
  // Push tokens don't exist on simulators/emulators, and getExpoPushTokenAsync
  // needs a projectId that isn't configured yet (see app.json) — see
  // getProjectId() below for how that surfaces to the caller.
  return Device.isDevice;
}

function getProjectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
}

// expo-notifications' NotificationPermissionsStatus type (extends an
// `expo`-package-re-exported PermissionResponse) doesn't resolve its
// `granted`/`status` fields correctly against this install's type
// versions, even though both exist at runtime — cast through this minimal
// shape instead of fighting the library's types.
type PermissionResult = { granted: boolean };

async function hasPermission(): Promise<boolean> {
  const result = (await Notifications.getPermissionsAsync()) as unknown as PermissionResult;
  return result.granted;
}

async function requestPermission(): Promise<boolean> {
  const result = (await Notifications.requestPermissionsAsync()) as unknown as PermissionResult;
  return result.granted;
}

export async function isPushSubscribed(): Promise<boolean> {
  if (!isPushSupported()) return false;
  return hasPermission();
}

export async function enablePushNotifications(): Promise<boolean> {
  if (!isPushSupported()) return false;

  const projectId = getProjectId();
  if (!projectId) {
    throw new Error(
      'Push notifications need an EAS project ID in app.json (run `eas init`) before they can be enabled.',
    );
  }

  const granted = (await hasPermission()) || (await requestPermission());
  if (!granted) return false;

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await pushApi.subscribeExpoPush(token);
  return true;
}

export async function disablePushNotifications(): Promise<void> {
  if (!isPushSupported()) return;
  const projectId = getProjectId();
  if (!projectId) return;

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await pushApi.unsubscribeExpoPush(token).catch(() => {});
}

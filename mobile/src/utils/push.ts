import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import * as pushApi from "../api/push.api";
import { logError } from "./logError";

export function isPushSupported(): boolean {
  return Device.isDevice;
}

function getProjectId(): string | undefined {
  return Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
}

type PermissionResult = { granted: boolean };

async function hasPermission(): Promise<boolean> {
  const result =
    (await Notifications.getPermissionsAsync()) as unknown as PermissionResult;
  return result.granted;
}

async function requestPermission(): Promise<boolean> {
  const result =
    (await Notifications.requestPermissionsAsync()) as unknown as PermissionResult;
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
      "Push notifications need an EAS project ID in app.json (run `eas init`) before they can be enabled.",
    );
  }

  const granted = (await hasPermission()) || (await requestPermission());
  if (!granted) return false;

  const { data: token } = await Notifications.getExpoPushTokenAsync({
    projectId,
  });
  await pushApi.subscribeExpoPush(token);
  return true;
}

export async function disablePushNotifications(): Promise<void> {
  if (!isPushSupported()) return;
  const projectId = getProjectId();
  if (!projectId) return;

  const { data: token } = await Notifications.getExpoPushTokenAsync({
    projectId,
  });
  await pushApi
    .unsubscribeExpoPush(token)
    .catch(logError("push: pushApi.unsubscribeExpoPush"));
}

import type { TranslationKey } from "../context/LanguageContext";

export function formatTimeAgo(
  iso: string,
  t: (key: TranslationKey) => string,
): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return t("time_just_now");
  if (minutes < 60) return `${minutes}${t("time_minutes_short")}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}${t("time_hours_short")}`;
  const days = Math.floor(hours / 24);
  return `${days}${t("time_days_short")}`;
}

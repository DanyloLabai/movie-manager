import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiEventBus } from "../api/index";
import * as usersApi from "../api/users.api";
import * as moviesApi from "../api/movies.api";
import type { FriendRequest } from "../api/users.api";
import type { AppNotification } from "../api/movies.api";
import { useLang } from "../context/LanguageContext";
import type { TranslationKey } from "../context/LanguageContext";
import LogoIcon from "../components/LogoIcon";

const NOTIFICATIONS_PAGE_SIZE = 30;

type FilterKey = "all" | "friends" | "achievements" | "releases";

const FILTER_TYPES: Record<FilterKey, AppNotification["type"][] | null> = {
  all: null,
  friends: ["friend_request", "friend_accepted"],
  achievements: ["achievement"],
  releases: ["release"],
};

function formatTimeAgo(
  iso: string,
  t: (key: TranslationKey) => string,
): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return t("time_just_now");
  if (minutes < 60) return `${minutes}${t("time_minutes_short")}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}${t("time_hours_short")}`;
  return `${Math.floor(hours / 24)}${t("time_days_short")}`;
}

export default function Notifications() {
  const { t } = useLang();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [hasMoreNotifications, setHasMoreNotifications] = useState(false);
  const [isLoadingMoreNotifications, setIsLoadingMoreNotifications] =
    useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

  const fetchAll = async () => {
    try {
      const [reqs, notifs] = await Promise.all([
        usersApi.getFriendRequests(),
        moviesApi.getNotifications({ limit: NOTIFICATIONS_PAGE_SIZE }),
      ]);
      setRequests(reqs || []);
      setNotifications(notifs || []);
      setHasMoreNotifications(
        (notifs?.length || 0) === NOTIFICATIONS_PAGE_SIZE,
      );
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const loadMoreNotifications = async () => {
    if (isLoadingMoreNotifications || !hasMoreNotifications) return;
    setIsLoadingMoreNotifications(true);
    try {
      const notifs = await moviesApi.getNotifications({
        limit: NOTIFICATIONS_PAGE_SIZE,
        offset: notifications.length,
      });
      setNotifications((prev) => [...prev, ...(notifs || [])]);
      setHasMoreNotifications(
        (notifs?.length || 0) === NOTIFICATIONS_PAGE_SIZE,
      );
    } catch (error) {
      console.error("Failed to load more notifications:", error);
    } finally {
      setIsLoadingMoreNotifications(false);
    }
  };

  const unreadNotifCount = notifications.filter((n) => !n.isRead).length;
  const unreadThisWeekCount = notifications.filter((n) => {
    if (n.isRead) return false;
    const days = (Date.now() - new Date(n.createdAt).getTime()) / 86400000;
    return days <= 7;
  }).length;

  const handleAccept = async (id: number) => {
    setProcessingId(id);
    try {
      await usersApi.acceptFriendRequest(id);
      setRequests((prev) => prev.filter((r) => r.id !== id));
      apiEventBus.dispatchEvent(new CustomEvent("notifications:updated"));
    } catch (error) {
      console.error("Failed to accept friend request:", error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (id: number) => {
    setProcessingId(id);
    try {
      await usersApi.declineFriendRequest(id);
      setRequests((prev) => prev.filter((r) => r.id !== id));
      apiEventBus.dispatchEvent(new CustomEvent("notifications:updated"));
    } catch (error) {
      console.error("Failed to decline friend request:", error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleNotificationClick = (n: AppNotification) => {
    if (!n.isRead) {
      moviesApi.markNotificationRead(n.id).catch(() => {});
      setNotifications((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)),
      );
      apiEventBus.dispatchEvent(new CustomEvent("notifications:updated"));
    }
    if (n.url) {
      navigate(n.url);
    } else if (n.tmdbId) {
      navigate(`/movie/${n.tmdbId}?type=${n.mediaType || "movie"}`);
    }
  };

  const NOTIFICATION_ICONS: Record<AppNotification["type"], string> = {
    release: "◷",
    achievement: "🏆",
    friend_request: "👥",
    friend_accepted: "👥",
  };

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const groupByDate = (items: AppNotification[]) => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    const today: AppNotification[] = [];
    const yday: AppNotification[] = [];
    const older: AppNotification[] = [];

    items.forEach((n) => {
      const d = new Date(n.createdAt);
      if (isSameDay(d, now)) today.push(n);
      else if (isSameDay(d, yesterday)) yday.push(n);
      else older.push(n);
    });

    return [
      { key: "today", label: t("notif_today"), items: today, isToday: true },
      {
        key: "yesterday",
        label: t("notif_yesterday"),
        items: yday,
        isToday: false,
      },
      { key: "older", label: t("notif_older"), items: older, isToday: false },
    ].filter((g) => g.items.length > 0);
  };

  const handleMarkAllRead = async () => {
    try {
      await moviesApi.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      apiEventBus.dispatchEvent(new CustomEvent("notifications:updated"));
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  };

  const allowedTypes = FILTER_TYPES[activeFilter];
  const filteredNotifications = allowedTypes
    ? notifications.filter((n) => allowedTypes.includes(n.type))
    : notifications;
  const showRequests =
    requests.length > 0 && (activeFilter === "all" || activeFilter === "friends");

  return (
    <div className="min-h-[100dvh] bg-[#0f0d0a] font-ui text-[#f2ead9] relative selection:bg-[#d9ac54] selection:text-[#14110c]">
      <div className="sm:hidden sticky top-0 z-40 bg-[#0f0d0a]/95 backdrop-blur-md border-b border-[rgba(217,172,84,.16)] mb-6 pt-[env(safe-area-inset-top)]">
        <header className="flex flex-row items-center justify-between gap-3 py-4 px-4 w-full">
          <Link
            to="/search"
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity shrink-0"
          >
            <span className="font-ui font-bold text-[17px] tracking-[4px] text-[#d9ac54]">
              LUMEN
            </span>
            <LogoIcon />
          </Link>
          <button
            onClick={() => navigate(-1)}
            className="font-mono-ui text-[10px] font-semibold tracking-[1.5px] text-[#8f8574] hover:text-[#d9ac54] transition uppercase"
          >
            ‹ {t("common_back")}
          </button>
        </header>
      </div>

      <main className="max-w-2xl mx-auto px-4 sm:px-8 pb-24 sm:pb-12 sm:pt-9">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl sm:text-2xl font-bold tracking-[3px] uppercase text-[#f2ead9]">
              {t("notif_bell_title")}
            </h2>
            <p className="text-[11.5px] text-[#8f8574] font-medium">
              {unreadThisWeekCount > 0
                ? `${unreadThisWeekCount} ${t("notif_subtitle")}`
                : t("notif_subtitle")}
            </p>
          </div>
          {unreadNotifCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="shrink-0 font-mono-ui text-[10px] font-semibold tracking-[1.5px] text-[#8f8574] hover:text-[#d9ac54] uppercase border border-white/[.12] hover:border-[#d9ac54]/45 rounded-full px-3.5 py-2 transition"
            >
              {t("notif_mark_all_read")}
            </button>
          )}
        </div>

        <div className="flex gap-1 border-b border-[rgba(217,172,84,.16)] mb-2 overflow-x-auto scrollbar-hide">
          {(
            [
              ["all", t("notif_filter_all")],
              ["friends", t("notif_filter_friends")],
              ["achievements", t("notif_filter_achievements")],
              ["releases", t("notif_filter_releases")],
            ] as [FilterKey, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveFilter(key)}
              className={`relative shrink-0 px-4 py-2.5 font-semibold text-[11px] tracking-[1.5px] uppercase transition-colors ${
                activeFilter === key
                  ? "text-[#d9ac54]"
                  : "text-[#8f8574] hover:text-[#c9c0ac]"
              }`}
            >
              {label}
              {activeFilter === key && (
                <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-[#d9ac54]" />
              )}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <div className="w-8 h-8 border-4 border-[#14110d] border-t-[#d9ac54] rounded-full animate-spin" />
          </div>
        ) : requests.length === 0 && notifications.length === 0 ? (
          <div className="text-center text-[#8f8574] text-sm italic py-16">
            {t("notif_empty")}
          </div>
        ) : (
          <div className="pt-4">
            {showRequests && (
              <section className="mb-6">
                <h4 className="font-mono-ui text-[10px] font-semibold tracking-[2.5px] text-[#645c4d] uppercase pb-1">
                  {t("notif_friend_requests")}
                </h4>
                <div>
                  {requests.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center gap-4 py-4 border-b border-[rgba(217,172,84,.12)]"
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#d9ac54] to-[#a87c2e] flex items-center justify-center text-sm font-bold text-[#0f0d0a] overflow-hidden shrink-0">
                        {req.fromUser.avatarUrl ? (
                          <img
                            src={req.fromUser.avatarUrl}
                            className="w-full h-full object-cover"
                            alt={req.fromUser.username}
                          />
                        ) : (
                          req.fromUser.username[0].toUpperCase()
                        )}
                      </div>
                      <span className="flex-1 min-w-0 text-sm font-semibold text-[#f2ead9] truncate">
                        {req.fromUser.username}
                      </span>
                      <button
                        onClick={() => handleAccept(req.id)}
                        disabled={processingId === req.id}
                        className="shrink-0 text-[10px] font-bold text-[#14110c] bg-[#d9ac54] hover:bg-[#e8c377] px-3.5 py-2 rounded-full transition disabled:opacity-40 active:scale-95"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => handleDecline(req.id)}
                        disabled={processingId === req.id}
                        className="shrink-0 text-[10px] font-bold text-[#645c4d] hover:text-[#e0554d] px-2 py-2 transition disabled:opacity-40 active:scale-95"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {filteredNotifications.length > 0 &&
              groupByDate(filteredNotifications).map((group) => (
                <div key={group.key} className="mb-2">
                  <h5
                    className={`flex items-center gap-2 font-mono-ui text-[10px] font-semibold tracking-[2.5px] uppercase pb-1 ${
                      group.isToday ? "text-[#645c4d]" : "text-[#645c4d]"
                    }`}
                  >
                    {group.label}
                  </h5>
                  <div>
                    {group.items.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`flex items-center gap-4 py-4 border-b border-[rgba(217,172,84,.12)] cursor-pointer transition active:scale-[0.99] ${
                          n.isRead ? "opacity-65" : ""
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${n.isRead ? "" : "bg-[#d9ac54]"}`}
                        />
                        {n.posterUrl ? (
                          <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-[#0f0d0a]">
                            <img
                              src={n.posterUrl}
                              alt={n.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-full border border-[#d9ac54]/45 flex items-center justify-center text-[#d9ac54] text-base shrink-0">
                            {NOTIFICATION_ICONS[n.type] || "🔔"}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[13.5px] text-[#f2ead9] truncate">
                            {n.title}
                          </p>
                          <p className="font-mono-ui text-[11px] text-[#645c4d] truncate">
                            {formatTimeAgo(n.createdAt, t)}
                          </p>
                        </div>
                        <span className="shrink-0 font-semibold text-[10px] tracking-[1.5px] text-[#d9ac54] hover:text-[#e8c377] uppercase">
                          {t("notif_view")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

            {hasMoreNotifications && activeFilter === "all" && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={loadMoreNotifications}
                  disabled={isLoadingMoreNotifications}
                  className="px-5 py-2.5 border border-[#d9ac54]/40 hover:border-[#d9ac54] text-[#d9ac54] font-bold uppercase tracking-wider rounded-full transition text-[10px] disabled:opacity-50"
                >
                  {isLoadingMoreNotifications
                    ? t("common_loading_more")
                    : t("common_load_more")}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

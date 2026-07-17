import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import * as usersApi from "../api/users.api";
import * as moviesApi from "../api/movies.api";
import type { FriendRequest } from "../api/users.api";
import type { AppNotification } from "../api/movies.api";
import LogoImg from "../assets/logo.png";
import { useLang } from "../context/LanguageContext";
import type { TranslationKey } from "../context/LanguageContext";

const NOTIFICATIONS_PAGE_SIZE = 30;

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
    } catch {
      // ignore — page just shows empty state
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
    } catch {
      // ignore — user can retry
    } finally {
      setIsLoadingMoreNotifications(false);
    }
  };

  const unreadNotifCount = notifications.filter((n) => !n.isRead).length;

  const handleAccept = async (id: number) => {
    setProcessingId(id);
    try {
      await usersApi.acceptFriendRequest(id);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch {
      // leave it in the list; user can retry
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (id: number) => {
    setProcessingId(id);
    try {
      await usersApi.declineFriendRequest(id);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch {
      // leave it in the list; user can retry
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
    }
    if (n.url) {
      navigate(n.url);
    } else if (n.tmdbId) {
      navigate(`/movie/${n.tmdbId}?type=${n.mediaType || "movie"}`);
    }
  };

  const NOTIFICATION_ICONS: Record<AppNotification["type"], string> = {
    release: "🎬",
    achievement: "🏆",
    friend_request: "👥",
    friend_accepted: "👥",
  };

  const NOTIFICATION_ICON_BG: Record<AppNotification["type"], string> = {
    release: "bg-blue-500/15 text-blue-400",
    achievement: "bg-[#c8963c]/15 text-[#c8963c]",
    friend_request: "bg-emerald-500/15 text-emerald-400",
    friend_accepted: "bg-emerald-500/15 text-emerald-400",
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
      { key: "yesterday", label: t("notif_yesterday"), items: yday, isToday: false },
      { key: "older", label: t("notif_older"), items: older, isToday: false },
    ].filter((g) => g.items.length > 0);
  };

  const handleMarkAllRead = async () => {
    try {
      await moviesApi.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#12100e] font-sans text-[#f0e6cc] relative selection:bg-[#c8963c] selection:text-[#12100e]">
      <div className="sticky top-0 z-40 bg-[#12100e]/95 backdrop-blur-md border-b border-[#c8963c]/10 mb-6 pt-[env(safe-area-inset-top)]">
        <header className="flex items-center justify-between py-4 px-4 sm:px-12 w-full">
          <Link
            to="/search"
            className="flex items-center gap-3 sm:gap-4 hover:opacity-80 transition-opacity shrink-0"
          >
            <img
              src={LogoImg}
              alt="LUMEN™ Logo"
              className="h-9 sm:h-12 w-auto object-contain"
            />
            <div className="flex flex-col justify-center">
              <h1 className="text-xl sm:text-3xl font-black text-[#c8963c] tracking-widest uppercase leading-none">
                LUMEN
              </h1>
              <span className="text-[7px] sm:text-[8px] text-[#f0e6cc]/70 font-medium uppercase leading-none whitespace-nowrap tracking-[0.5em] sm:tracking-[0.6em] mt-1 block text-justify w-full">
                {t("app_tagline")}
              </span>
            </div>
          </Link>

          <button
            onClick={() => navigate(-1)}
            className="text-[10px] sm:text-xs font-bold text-[#f0e6cc]/60 hover:text-[#c8963c] transition uppercase tracking-wider shrink-0"
          >
            &lt; {t("common_back").toUpperCase()}
          </button>
        </header>
      </div>

      <main className="max-w-2xl mx-auto px-4 sm:px-8 pb-24 sm:pb-12">
        <div className="text-center mb-6 pb-4 border-b border-[#c8963c]/20">
          <h2 className="text-xl sm:text-2xl font-black text-[#c8963c] uppercase tracking-widest drop-shadow-md">
            {t("notif_bell_title")}
          </h2>
          <p className="text-[11px] sm:text-xs text-[#f0e6cc]/50 font-medium mt-1.5">
            {t("notif_subtitle")}
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <div className="w-8 h-8 border-4 border-[#1a1714] border-t-[#c8963c] rounded-full animate-spin" />
          </div>
        ) : requests.length === 0 && notifications.length === 0 ? (
          <div className="text-center text-[#f0e6cc]/50 text-sm italic py-16 border border-[#c8963c]/10 rounded-2xl border-dashed">
            {t("notif_empty")}
          </div>
        ) : (
          <div className="space-y-6">
            {requests.length > 0 && (
              <section>
                <h4 className="text-[10px] font-black uppercase tracking-widest text-[#c8963c] mb-3 px-1">
                  {t("notif_friend_requests")}
                </h4>
                <div className="space-y-2">
                  {requests.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center gap-3 bg-[#1a1714] p-3 rounded-xl border border-[#c8963c]/20"
                    >
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#c8963c] to-[#9a732a] flex items-center justify-center text-sm font-black text-[#12100e] overflow-hidden shrink-0">
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
                      <span className="flex-1 min-w-0 text-sm font-bold text-[#f0e6cc] truncate">
                        {req.fromUser.username}
                      </span>
                      <button
                        onClick={() => handleAccept(req.id)}
                        disabled={processingId === req.id}
                        className="shrink-0 text-[10px] font-black text-[#12100e] btn-glass btn-glass-gold px-3 py-2 rounded-lg transition disabled:opacity-40 active:scale-95"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => handleDecline(req.id)}
                        disabled={processingId === req.id}
                        className="shrink-0 text-[10px] font-black text-red-500/70 hover:text-red-500 px-2 py-2 transition disabled:opacity-40 active:scale-95"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {notifications.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3 px-1">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-[#c8963c]">
                    {t("notif_updates")}
                  </h4>
                  {unreadNotifCount > 0 && (
                    <button
                      onClick={handleMarkAllRead}
                      className="flex items-center gap-1.5 text-[9px] font-black text-[#c8963c] btn-glass btn-glass-dark uppercase tracking-wide transition px-3 py-1.5 rounded-full"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7M1 13l4 4L9.5 12.5" />
                      </svg>
                      {t("notif_mark_all_read")}
                    </button>
                  )}
                </div>
                {groupByDate(notifications).map((group) => (
                  <div key={group.key} className="mb-5 last:mb-0">
                    <h5
                      className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest mb-2 px-1 ${
                        group.isToday ? "text-[#c8963c]" : "text-[#f0e6cc]/40"
                      }`}
                    >
                      {group.isToday && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#c8963c]" />
                      )}
                      {group.label}
                    </h5>
                    <div className="space-y-2">
                      {group.items.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          className={`relative flex items-center gap-3 p-3 sm:p-4 rounded-xl border cursor-pointer transition active:scale-[0.99] overflow-hidden ${
                            n.isRead
                              ? "bg-[#1a1714] border-[#c8963c]/10 opacity-60"
                              : "glass-panel border-[#c8963c]/30 hover:border-[#c8963c]/60 hover:glow-gold-sm"
                          }`}
                        >
                          {!n.isRead && (
                            <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#c8963c] shadow-[0_0_8px_1px_rgba(200,150,60,0.6)]" />
                          )}
                          {n.posterUrl ? (
                            <div className="w-10 h-14 rounded-md overflow-hidden shrink-0 border border-[#c8963c]/20 bg-[#12100e]">
                              <img
                                src={n.posterUrl}
                                alt={n.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div
                              className={`w-11 h-11 rounded-full flex items-center justify-center text-lg shrink-0 ${NOTIFICATION_ICON_BG[n.type] || "bg-[#c8963c]/10 text-[#c8963c]"}`}
                            >
                              {NOTIFICATION_ICONS[n.type] || "🔔"}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-[#f0e6cc] truncate">
                              {n.title}
                            </p>
                            <p className="text-[9px] text-[#f0e6cc]/40 uppercase tracking-wide truncate">
                              {n.body ||
                                (n.type === "release"
                                  ? t("notif_released_today")
                                  : "")}
                            </p>
                          </div>
                          <span className="text-[9px] text-[#f0e6cc]/30 shrink-0">
                            {formatTimeAgo(n.createdAt, t)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {hasMoreNotifications && (
                  <div className="flex justify-center mt-4">
                    <button
                      onClick={loadMoreNotifications}
                      disabled={isLoadingMoreNotifications}
                      className="px-5 py-2 btn-glass btn-glass-dark text-[#c8963c] font-black uppercase tracking-wider rounded-xl transition text-[10px] disabled:opacity-50"
                    >
                      {isLoadingMoreNotifications
                        ? t("common_loading_more")
                        : t("common_load_more")}
                    </button>
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
